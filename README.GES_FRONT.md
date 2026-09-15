# BEET_TICKET_GES_FRONT — copia standalone (sin backend)

Esta carpeta es una copia completa e independiente de `frontend/`, preparada
para abrirse en VS Code y ejecutarse **sin el backend real**. Ninguna
página, componente, estilo o context fue rediseñado desde cero: la
identidad visual (tokens, sidebar, header, cards, badges, tablas, botones,
modales) es exactamente la misma que el resto del proyecto.

La estructura administrativa se reorganizó para reflejar el modelo real de
BEET:

```
BEET
│
├── Administrador
│   ├── GES              → /ges           (Storage central, cooperativas, transacciones globales)
│   ├── Súper admin      → /super-admin   (vista panorámica de todas las cooperativas + GES)
│   ├── Administrador    → /admin         (panel de su propia cooperativa + solicitar a GES)
│   └── Lector           → /lector        (solo lectura de su propia cooperativa)
│
└── Afiliado             → /portal        (cuenta activa) o /portal/registro (cuenta no activa)
```

## 1. Ruta de la carpeta

```
C:\Users\dairo\OneDrive\Escritorio\BEET_TICKET_V20\BEET_TICKET_GES_FRONT
```

## 2. Instalar dependencias

```bash
npm install
```

## 3. Ejecutar el proyecto

```bash
npm run dev
```

## 4. Puerto

Vite abre por defecto en **http://localhost:5173**. Si ese puerto está
ocupado, Vite elegirá automáticamente el siguiente disponible (5174, 5175…)
y lo mostrará en la terminal — usa la URL que imprima esa terminal.

## 5. Cómo entrar (sin usuario ni contraseña)

Al abrir `http://localhost:5173` ves únicamente dos caminos: **Administrador**
y **Afiliado** — como pide la definición funcional. No hay autenticación
real todavía, así que cada camino lleva a un selector temporal:

- **Administrador** → elige un usuario demo (**GES**, **Super Admin**,
  **Administrador** o **Lector**) y pulsa **Ingresar**. Te lleva directo a
  `/ges`, `/super-admin`, `/admin` o `/lector` según lo elegido — sin volver
  a mostrar ese menú de 5 roles en ningún otro lado. Este selector es
  explícitamente temporal: cuando exista el backend real en FastAPI, lo
  reemplaza el login real (`Login.jsx`, que sigue intacto en `/login`) y
  será el backend quien determine el rol y la cooperativa.
- **Afiliado** → elige **Cuenta activa** (entra directo al portal como Juan
  Pérez) o **Cuenta no activa** (va al formulario existente de activación,
  `/portal/registro`).

Para volver a elegir otra experiencia, usa **Cerrar sesión** desde el menú
de la experiencia actual — te devuelve al selector inicial sin necesidad de
parar/volver a correr `npm run dev`. Los formularios de login reales
(`/login`, `/portal/login`) siguen existiendo y funcionan igual (cualquier
contraseña, el correo determina quién eres — ver tabla abajo) por si
prefieres probarlos directamente.

### Usuarios demo (correo → rol)

| Correo | Rol | Cooperativa |
|---|---|---|
| `ges@beetticket.com` | GES | Ninguna — GES no pertenece a ninguna cooperativa |
| `superadmin@beetticket.com` | Súper administrador | Ninguna fija — elige una arriba en el header |
| `admin@beetticket.com` | Administrador | Cooperativa Bienestar |
| `lector@beetticket.com` | Lector (solo lectura) | Cooperativa Bienestar |
| `admin.union@beetticket.com` | Administrador | Cooperativa Unión |

### Afiliados demo (portal, `/portal/login`)

| Correo | Cooperativa | Nota |
|---|---|---|
| `juan.perez@correo.com` | Bienestar | Tiene cupo de crédito y tickets de ejemplo |
| `maria.gomez@correo.com` | Bienestar | Cupo activo, sin compras todavía |
| `diana.martinez@correo.com` | Bienestar | Cupo suspendido (para probar ese estado) |
| `sofia.castro@correo.com` | Unión | Sin cupo asignado |
| `andres.londono@correo.com` | Unión | Sin cupo asignado |

`pedro.ramirez@correo.com` existe pero está **inactivo** (mensaje de cuenta
inactiva al iniciar sesión). Para "Activa tu cuenta" con el formulario real,
usa documento `1000000009` y correo `nuevo.afiliado@correo.com`.

**Simulación de pasarela de tarjeta** (los mismos números que ya documenta
la propia pantalla de compra en modo desarrollo): una tarjeta terminada en
`0000` (o cualquier número no listado abajo) se aprueba; `0001` se rechaza
por fondos insuficientes; `0002` por tarjeta inválida; `0003` simula un
error/timeout de la pasarela.

## 6. Qué puedes probar en cada área

- **GES** (`/ges`) — Dashboard global (sin seleccionar cooperativa),
  Cooperativas (listado + detalle con pestañas Resumen/Inventario/
  Convenios/Transacciones/Actividad), **Storage** (qué tiene GES disponible
  por convenio, con detalle de a qué cooperativas se lo asignó), **Comprar
  bonos y boletas** (estado vacío — el proceso de compra a proveedores aún
  no está definido) y **Transacciones** (operaciones GES↔cooperativa, con
  administrador, forma de pago y aprobar/rechazar). GES nunca ve Afiliados,
  Cupos ni Configuración, y no puede entrar a `/super-admin`.
- **Súper admin** (`/super-admin`) — el mismo panel de cooperativa que
  Administrador, más **Usuarios** y un enlace **GES** que sí abre el panel
  completo de GES (`/ges`). Elige una cooperativa en el selector del header
  para ver sus datos (Bienestar / Unión / Horizonte — esta última inactiva
  y vacía).
- **Administrador** (`/admin`) — panel completo de Cooperativa Bienestar:
  Dashboard, **Convenios** (con switch Activo/Inactivo visible por fila),
  Inventario (de la cooperativa, distinto del Storage de GES), Afiliados,
  Cupos de crédito, Transacciones, Reportes, Documentos legales,
  Configuración, y **GES** — pero aquí "GES" es solo el formulario
  "Comprar bonos/boletas a GES" (Convenio + Cantidad + Solicitar), nunca el
  panel completo.
- **Lector** (`/lector`) — el mismo panel de cooperativa en modo solo
  lectura: sin GES, sin Configuración, sin botones de agregar/editar/
  eliminar/importar/activar/comprar.
- **Afiliado** (`/portal`) — catálogo, compra (tarjeta o cupo, con firma),
  tickets, cupo y perfil — sin cambios frente al portal original.

Los datos viven en memoria y se comparten entre todas las áreas durante la
misma sesión del navegador (por ejemplo, desactivar un convenio como
Administrador se refleja de inmediato en el catálogo del Afiliado). Se
reinician solo con una recarga completa de página — cerrar sesión o
navegar dentro de la app no los borra.

## Qué NO está simulado

- **Descargas de PDF** (tickets, documentos, vistas previas de plantilla) y
  **exportes a Excel** generan un archivo válido pero de contenido
  mínimo/genérico — sirven para comprobar que el botón funciona y algo se
  abre/descarga, no para revisar el diseño real del PDF/Excel.
- **Carga masiva de archivos** (afiliados, convenios, inventario) siempre
  responde con éxito sin leer el contenido real del archivo.
- El proceso comercial (crédito, bolsa, pasarela, precios, condiciones)
  entre GES, cooperativas y proveedores todavía no está definido — todo lo
  relacionado (Comprar bonos y boletas de GES, Solicitar a GES desde una
  cooperativa, "Forma de pago" en las transacciones de GES) es
  intencionalmente una simulación visual mínima, no una regla de negocio
  real.
- El texto de `Login.jsx` ("La autenticación se valida contra el backend
  real…") se dejó intacto a propósito — en esta copia esa frase ya no es
  literalmente cierta, pero el formulario funciona igual con los usuarios
  demo de la tabla de arriba.

## Cómo está armado (si necesitas ajustarlo)

- `src/services/mockDb.js` — datos semilla del panel de cooperativa/portal
  (usuarios administradores incl. GES, cooperativas, convenios, afiliados,
  inventario, cupos, transacciones, tickets, documentos, plantillas, logs).
- `src/pages/admin/ges/gesData.js` — datos semilla propios de GES (Storage,
  cooperativas — mismos id/nombre que `mockDb.js` para que ambas vistas
  hablen de las mismas entidades —, transacciones GES↔cooperativa).
  Completamente aislado: ningún archivo de GES importa `apiClient`/
  `mockDb.js`, y viceversa.
- `src/services/apiClient.js` — mismo objeto `apiClient`/`ApiError`/
  `adminTokenStore`/`afiliadoTokenStore`/`cooperativaScopeStore` que el
  original exportaba; por dentro, un router que resuelve cada endpoint
  contra `mockDb.js` en vez de hacer `fetch`.
- `src/hooks/useAreaBase.js` — resuelve el prefijo de ruta (`/admin`,
  `/lector`, `/super-admin`) según el rol autenticado; lo usan las páginas
  de cooperativa (Convenios, Inventario, Afiliados, Cupos, Transacciones,
  Reportes, Dashboard) porque el mismo componente se monta bajo los tres
  prefijos — misma lógica que `components/layout/Sidebar.jsx`.
- `src/components/layout/RequireRole.jsx` — protege cada área por rol
  (ej. `/ges` solo admite GES y Súper admin).
- `src/pages/Landing.jsx`, `EntrarAdministrador.jsx`, `EntrarAfiliado.jsx`
  — el punto de entrada y los dos selectores temporales descritos arriba.
