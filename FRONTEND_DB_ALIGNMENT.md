# FRONTEND_DB_ALIGNMENT.md

Alineación de `beet_front` con el modelo de base de datos PostgreSQL definido
para BEET. **No se implementó backend, endpoints reales, PostgreSQL,
migraciones ni autenticación real** — todo sigue funcionando con datos MOCK
en memoria (`src/services/mockDb.js` + `src/pages/admin/ges/gesData.js`),
enrutados por `src/services/apiClient.js`. El proyecto se sigue ejecutando
con los mismos comandos de siempre (`npm run dev`, `npm run build`).

## 1. Qué se encontró

El frontend ya tenía una arquitectura limpia (`services/*` como única puerta
de entrada a los datos, `apiClient.js` como "backend" simulado), pero su
modelo de datos conflaba varias entidades del modelo nuevo:

- **`convenios` (mock) mezclaba tres conceptos**: el convenio del catálogo
  maestro de GES, el producto vendible, y la relación cooperativa↔convenio
  con su precio. Un "convenio" en el admin ya tenía `precio_publico`/
  `precio_beet` directamente, como si cada convenio fuera un único producto.
- **No existía `productos_convenio`** — no había forma de representar que
  "Cine Colombia" tiene varios productos (Entrada 2D, Entrada 3D, etc.).
- **`unidadesInventario` y `transacciones` colgaban de `convenio_id`**, no de
  un producto.
- **GES's `Storage` (`gesData.js`) usaba números agregados** (`disponible:
  1000`) en vez de códigos individuales — contradice la sección 8 del
  modelo.
- **Estados prohibidos existían**: `transacciones.estado` incluía
  `RECHAZADA`; `unidadesInventario`/`tickets.estado` incluían `redimida` y
  `cancelada`.
- **`ConveniosList.jsx` (una página de admin) importaba directamente**
  `PROVEEDORES` desde `pages/admin/ges/gesData.js` — un acoplamiento
  página→página que saltaba la capa de servicios.
- El resto del frontend (roles GES/SUPER_ADMIN/ADMIN/LECTOR, portal de
  afiliado, cupos, plantillas, reportes) ya estaba razonablemente alineado
  con las reglas de negocio descritas.

## 2. Qué se modificó

### Capa de datos (mock) — `src/services/mockDb.js`

Reescrito para separar las 9 entidades del modelo:

| Export | Representa |
|---|---|
| `usuarios` (antes `admins`) | usuarios administrativos (`id_cooperativa` null para GES/SUPER_ADMIN) |
| `cooperativas` | sin cambios de fondo |
| `afiliados` | igual, ya pertenecía a una sola cooperativa |
| `conveniosCatalogo` | mirror liviano (`id` slug, `nombre`) del catálogo maestro de GES |
| `productosConvenio` | **nuevo** — `{id, id_convenio, nombre, descripcion, estado}`, varios por convenio |
| `cooperativasConvenios` (antes `convenios`) | fila que activa un convenio para una cooperativa: `precio_beet`, `precio_normal` (antes `precio_publico`), vigencia, estado |
| `unidadesInventario` | ahora `id_producto` + `id_cooperativa`, estado `DISPONIBLE\|ENTREGADA\|VENCIDA` (+ `BLOQUEADA` operativo) |
| `transacciones` | compra del afiliado — ver nota en sección 3 |
| `cupos`, `documentos`, `tickets`, `plantillas`, `logsAuditoria` | adaptados a los nuevos ids (`id_producto` en vez de `convenio_id`), sin cambios de reglas |

### Catálogo maestro de GES — `src/pages/admin/ges/gesData.js`

- `PROVEEDORES` (convenios) se amplió a 7 convenios para no dejar convenios
  "inventados" en el mock de cooperativa (Café Central, Teatro Nacional, Spa
  Relax ya existían como seed pero no estaban en el catálogo maestro).
- **`PRODUCTOS`** (nuevo): productos por convenio (`getProductos`,
  `getProducto`, `agregarProducto`, `toggleProducto`).
- **`STORAGE`** (nuevo): códigos individuales por producto
  (`{id, productoId, codigo, estado: 'DISPONIBLE'|'ASIGNADO'}`).
  `getInventarioCentral()` ahora devuelve una fila **por producto**, contando
  códigos reales — nunca un número inventado.
- `asignaciones`/`solicitudes` ahora se indexan por `productoId` (conservan
  `proveedorId`/`proveedorNombre` para mostrar el convenio).
- `crearSolicitudDesdeCooperativa` / `asignarInventario` siguen usando
  exclusivamente los estados `Pendiente`/`Completada` (nunca
  aprobar/rechazar).

### Router mock — `src/services/apiClient.js`

- `/api/convenios/*` ahora opera sobre `cooperativasConvenios`.
- **Nuevo** `/api/convenios/catalogo-maestro` (lista `conveniosCatalogo`) y
  `/api/convenios/productos?id_convenio=...` (lista `productosConvenio` de
  un convenio) — reemplazan el import directo a `gesData.js` desde
  `ConveniosList.jsx`.
- `/api/convenios/catalogo` (catálogo del afiliado) ahora devuelve **un ítem
  por producto** de cada convenio activo, con el precio heredado de
  `cooperativasConvenios`.
- `/api/inventario/*` y `/api/transacciones/comprar` ahora identifican
  **producto**, no convenio.
- `ejecutarCompra`: una tarjeta rechazada (terminada en `0001`/`0002`) o con
  timeout (`0003`) **ya no crea una fila de transacción** — lanza un
  `ApiError` directamente. Esto elimina el estado `RECHAZADA`, que no existe
  en el modelo (sección 11).

### Servicios — `convenioService.js`, `inventarioService.js`, `transaccionesService.js`

- `listarCatalogoMaestroConvenios()` y `listarProductosDeConvenio(idConvenio)`
  (nuevos).
- `listarInventario/resumenInventario/cargaInventario` reciben un `productoId`
  en vez de `convenioId`.
- `comprar()` envía `producto_id` en vez de `convenio_id`.

### Páginas afectadas

**GES** (`pages/admin/ges/*`, `ComprarBonosGes.jsx`): `Storage.jsx` y
`AsignarInventarioModal.jsx` ahora tienen selectores en cascada
Convenio→Producto; `ComprarBonosGes.jsx` (vista del admin de cooperativa)
igual; `CooperativaDetail.jsx` y `SolicitudesTable.jsx` muestran columna
Producto junto a Convenio; `GesDashboard.jsx` muestra Storage por producto;
`ConveniosCatalogo.jsx` ahora permite gestionar productos por convenio
(crear/activar/desactivar).

**Admin** (`pages/admin/convenios/*`, `inventario/*`, `transacciones/*`,
`reportes/Reportes.jsx`): `ConvenioForm.jsx` ahora elige el convenio de un
`Select` (catálogo maestro) al crear, y lo deja de solo lectura al editar
—solo se configuran precio BEET, precio normal, vigencia y estado, tal como
pide la sección 10—; `ConveniosList.jsx` ya no importa `gesData.js`
directamente; `InventarioConvenio.jsx`/`InventarioGeneral.jsx` agregan un
selector de producto y usan los nuevos estados en mayúscula;
`TransaccionesList.jsx`/`TransaccionDetail.jsx` ya no tienen la rama
`RECHAZADA`/`CANCELADA` (no pueden ocurrir) y muestran "Convenio · Producto".

**Portal del afiliado** (`pages/portal/*`, `components/portal/*`): el
catálogo (`Catalogo.jsx`, `BenefitCard.jsx`, `BenefitDetail.jsx`) ahora
muestra el producto con su convenio como marca; `PurchaseFlow.jsx` compra un
`producto_id` y un pago rechazado se maneja como error de API, no como una
transacción con `estado: 'RECHAZADA'`; `MyTickets.jsx`/`TicketDetail.jsx`
solo usan los estados `ENTREGADA`/`VENCIDA` (se eliminó la pestaña
"Utilizados/Redimida" — BEET no controla la redención, sección 13);
`MyDocuments.jsx`/`DocumentDetail.jsx` resuelven el convenio vía
`id_producto`.

**`components/ui/Badge.jsx`**: el mapa de estados se limpió a los valores
reales del modelo (`DISPONIBLE/ENTREGADA/VENCIDA/BLOQUEADA/ASIGNADO/
PENDIENTE/COMPLETADA/FIRMADO`), eliminando `RECHAZADA`, `APROBADA`,
`CANCELADA`, `redimida`, `cancelada`.

**`pages/admin/superadmin/superAdminData.js`**: adaptado a los nuevos
nombres de campo (`id_cooperativa`, `id_producto`) sin cambiar sus reglas.

## 3. Decisiones y supuestos (declarados, no inventados)

- **La "compra del afiliado" (tarjeta/cupo) no es la tabla `transacciones`
  del modelo de 9 tablas** — esa tabla es exclusivamente cooperativa↔GES
  (sección 11, ya representada en `gesData.js` como `solicitudes`). El
  registro de pago del afiliado (con `metodo_pago`, `codigos`,
  `referencia_pago`) es una simulación de pasarela preexistente en el
  frontend que el modelo dado no cubre todavía; se mantuvo como una entidad
  aparte, documentada explícitamente en `mockDb.js`, y se ajustó solo para
  no usar `convenio_id` (ahora `id_producto`) ni el estado prohibido
  `RECHAZADA`.
- **El precio vive en `cooperativas_convenios`, no en `productos_convenio`**
  — así lo define el esquema entregado (`productos_convenio` no tiene columna
  de precio). Esto significa que todos los productos de un mismo convenio
  comparten el mismo precio BEET/normal en una cooperativa. No se inventó un
  precio por producto porque el esquema no lo contempla; si el negocio
  necesita precios distintos por producto, es una extensión pendiente de
  definir.
- **`id_storage` no se modeló explícitamente en `unidadesInventario`** (mock
  de cooperativa) — el Storage central de GES vive en un universo mock
  aislado (`gesData.js`, ya documentado como tal desde antes de este
  trabajo). `unidadesInventario` referencia `id_producto` directamente. Con
  backend real, ambos universos serán la misma tabla y esta simplificación
  desaparece.
- **`BLOQUEADA` se conservó como estado operativo** de `unidadesInventario`
  (bloquear/desbloquear código, función ya existente en el admin) aunque no
  aparece en la lista de la sección 12 — no la prohíbe el modelo (a
  diferencia de `REDIMIDA`, que sí está explícitamente vetada), así que se
  dejó como una extensión operativa neutral, pendiente de confirmar con
  negocio si debe seguir existiendo.
- **`InventarioConvenio.jsx` sigue enrutado por el id de
  `cooperativas_convenios`** (`inventario/:convenioId`), no por producto —
  la página internamente resuelve los productos de ese convenio y dejar
  elegir cuál ver. Se eligió así para no tener que cambiar las rutas de
  `App.jsx` ni todos los enlaces hacia esta página; es un detalle de
  implementación, no de modelo de datos.
- **Cupos y pagos (sección 15)**: no se tocó ni se inventó ninguna regla
  financiera nueva (bolsa/crédito, pasarela real, contabilidad). Toda la UI
  de cupos se conservó tal cual.
- **Las cooperativas de GES (`gesData.js`) y las cooperativas del panel
  admin (`mockDb.js`) siguen siendo dos universos mock separados** que
  coinciden en id/nombre por convención (decisión preexistente al inicio de
  este trabajo, ya documentada en el código) — se unificarán naturalmente
  cuando exista una sola base de datos real.

## 4. Qué sigue siendo MOCK

Todo. No hay backend, PostgreSQL, ni endpoints reales. `mockDb.js` reinicia
sus datos en cada recarga de página. La carga de XML de Storage, las cargas
masivas (Excel/CSV) de convenios/afiliados/inventario, la pasarela de pago,
y las exportaciones a Excel siguen siendo simulaciones visuales, igual que
antes de este trabajo.

## 5. Pendiente para el backend / negocio

- Definir el mecanismo financiero real entre cooperativa↔GES y
  afiliado↔cooperativa (bolsa prepago, crédito, u otro) — sección 15.
- Definir si `productos_convenio` necesitará precio propio en el futuro, o
  si el precio a nivel de convenio (como está definido hoy) es definitivo.
- Definir cómo se relacionan formalmente el catálogo maestro de GES y el
  Storage central con la tabla `cooperativas_convenios`/`unidades_inventario`
  del lado de la cooperativa cuando exista una sola base de datos (hoy son
  mocks separados que coinciden por convención de ids/nombres).
- Confirmar si `BLOQUEADA` debe persistir como estado operativo de
  `unidades_inventario` o si se modela de otra forma.
- Implementar el procesamiento real del XML de proveedores en Storage (hoy
  es 100% simulación visual, no se generan códigos reales al subir el
  archivo).
