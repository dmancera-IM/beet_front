# BEET · Análisis y propuesta de base de datos PostgreSQL

Documento de **análisis y diseño**, no de implementación. No crea tablas, no
migra nada, no toca el frontend. Fuente: el código real de
`BEET_TICKET_GES_FRONT` (`src/services/mockDb.js`,
`src/pages/admin/ges/gesData.js`, y ~40 vistas admin/portal) más las reglas
de negocio de GES, Súper Admin, Cooperativa, Lector y Afiliado.

Nota importante encontrada en el propio código: varias vistas (`Configuracion.jsx`,
`ConvenioForm.jsx`, `CuposList.jsx`, `Catalogo.jsx`, `TicketCard.jsx`, `roles.js`)
tienen comentarios `// NOTE: unlike an earlier design assumption...` que citan
un esquema real ya validado (`backend/app/models/...`, `SCHEMA_NOTES.md`) de
una integración previa. Ese esquema real **ya rechazó** varias columnas que
parecía razonable tener (marca/categoría en convenios, periodicidad en cupos,
toggles de configuración de cooperativa, fecha de vencimiento por ticket).
Se usaron esas pistas como evidencia de peso en este análisis, no solo como
inferencia del frontend.

---

## A. Lo que está correcto en la propuesta inicial

1. **`usuarios` con `id_cooperativa` nullable** — correcto conceptualmente:
   GES y SUPER_ADMIN no pertenecen a cooperativa, ADMIN y LECTOR sí. Solo
   falta la restricción que lo garantice (ver sección D).
2. **`cooperativas` como entidad independiente, sin campos de afiliados/inventario embebidos** — correcto, es la base de todo el modelo.
3. **`afiliados` con `id_cooperativa`** — correcto: el afiliado siempre pertenece a una cooperativa (confirmado en `mockDb.afiliados`, nunca es null).
4. **Existencia de un `storage` separado de otras tablas** — correcto en concepto: GES necesita su propio almacenamiento, distinto del inventario de cooperativa. Solo el diseño de columnas es insuficiente (ver B).
5. **Separar `proveedor` de `convenio`** — correcto en concepto y alineado con el flujo `PROVEEDOR → CONVENIO`, aunque el frontend actual (`gesData.js`) los colapsa en una sola entidad `PROVEEDORES`. Vale la pena mantenerlos separados a nivel de BD aunque hoy el frontend no explote la diferencia — permite que un proveedor tenga más de un convenio en el futuro sin romper nada.

## B. Lo que debe cambiar

1. **Contraseñas en texto plano** (`usuarios.contraseña`, `afiliados.password`). Deben ser `password_hash` (bcrypt/argon2), nunca la contraseña real. Ninguna tabla debe llamarse ni tener una columna `contraseña` sin más.
2. **`proveedor.id_nombre_convenio`** es un antipatrón: un nombre no es una FK, y el nombre de una tabla relacionada nunca debe ser el nombre de una columna FK (debería ser `id_convenio`, y aun así sobra si el proveedor no necesita apuntar a "su" convenio — la relación ya existe desde `convenio.id_proveedor`).
3. **`convenio` (una sola tabla, plana) mezcla dos niveles distintos que las reglas de negocio separan explícitamente:**
   - el **catálogo maestro** (nombre, a qué proveedor pertenece, si GES lo tiene activo globalmente);
   - la **configuración por cooperativa** (precio BEET, precio normal, ahorro, vigencia, activo/inactivo *para esa cooperativa*).

   Esto es el hallazgo más importante del análisis. `mockDb.convenios` ya lo evidencia: cada fila tiene `cooperativa_id` + `nombre` + precios — es decir, si "Cine Colombia" tuviera 2 cooperativas, hoy se duplicaría el nombre/descripcion en 2 filas en vez de compartir el catálogo. Esto rompe la regla "las cooperativas no crean convenios, seleccionan del catálogo maestro" y no permite que GES desactive un convenio globalmente sin tocar cada copia. **Debe partirse en dos tablas** (ver D).
4. **`storage.estado` como columna simple no es suficiente.** La regla de negocio pide que el Storage eventualmente represente boletas/bonos *individuales* (código, vencimiento, si sigue en Storage, si fue asignado, si fue entregado) — no un conteo agregado. Hoy `gesData.js` solo maneja `disponible`/`asignado` como números agregados por proveedor; hay que diseñar ya la tabla a nivel de unidad para no migrar dos veces.
5. **`afiliados.cupo_asignado` como columna plana.** Ya lo señala el propio código: "el cupo puede no existir" (afiliado sin cupo es un estado válido, no un error) y el saldo se guarda **directamente como disponible**, no como acumulado de "usado". Una columna obligatoria en `afiliados` no permite representar "sin cupo" de forma limpia (NULL en una tabla no es lo mismo que la ausencia de una fila relacionada, y complica agregar historial de cupo más adelante). Debe ser una tabla aparte, 0 o 1 fila por afiliado.
6. **No existen tablas de transacción en la propuesta inicial**, pese a que son el corazón del sistema (compra de afiliado y solicitud cooperativa↔GES son dos flujos distintos, con distintos actores). Esto no es un "cambio" sino una ausencia — se detalla en C/D.
7. **Estados de unidad que violan la regla fundamental de redención.** El propio mock (`mockDb.unidadesInventario`, `mockDb.tickets`) usa un estado `'redimida'`. Por la regla de negocio ("BEET NO controla la redención... NO crear estados como REDIMIDA"), esto debe eliminarse del modelo: el estado final que BEET conoce es **`ENTREGADA`** (se le dio la boleta al afiliado). Lo que el proveedor haga después no es de BEET.

## C. Lo que falta

1. **Tabla de transacciones de compra del afiliado** (`transacciones`): quién compró, qué convenio, cantidad, método de pago, resultado de pago, referencia de pasarela, motivo de rechazo — todo esto ya vive en `mockDb.transacciones` pero no está en la propuesta inicial.
2. **Tabla de transacciones GES↔cooperativa** (`transacciones_ges`, hoy `gesData.solicitudes`): administrador que la hizo, cooperativa, convenio, cantidad, fecha, estado (`PENDIENTE`/`COMPLETADA`), forma de pago. Es una entidad distinta de la anterior — otros actores, otra relación — y la propuesta inicial no la contempla en absoluto.
3. **Relación cooperativa ↔ convenio del catálogo maestro** (tabla puente, ver B.3) — no existe en la propuesta.
4. **Cupo de la cooperativa frente a GES** (`gesData.cooperativas.cupoDisponible/cupoGastado`) — regla de negocio dice que es opcional y GES lo administra; no está en la propuesta inicial en absoluto.
5. **Documentos de asunción de deuda** (`mockDb.documentos`) — obligatorios para el flujo de compra a cuotas con cupo, con firma. No están en la propuesta.
6. **Plantillas de boleta/bono** (`mockDb.catalogoPlantillas`, `plantillasPersonalizadas`) — usadas por convenio-cooperativa para generar el diseño de la boleta. No están en la propuesta.
7. **Auditoría** (`mockDb.logsAuditoria`) — trazabilidad de quién hizo qué; existe en el mock, no en la propuesta.
8. **Preparación para carga de XML de proveedores** — no existe ninguna noción de "de dónde vino este registro de Storage" en la propuesta. Hay que dejar espacio para asociar unidades de Storage a un archivo XML de origen, sin implementar el parser todavía.
9. **Relación `usuarios_admin` (rol GES) — no hay tabla de "quién creó esta cooperativa/este usuario" para trazabilidad** (relevante porque GES puede crear cooperativas y usuarios admin en nombre de una cooperativa).

## D. Modelo relacional recomendado

Convención: `snake_case`, PK `id BIGSERIAL`, timestamps `created_at`/`updated_at` (`TIMESTAMPTZ DEFAULT now()`), booleans para estado binario, `CHECK` para enums cerrados y bien conocidos (más flexible que un tipo `ENUM` de Postgres si la lista puede crecer).

### 1. `cooperativas`
- **Propósito**: entidad raíz de una cooperativa (no GES, no Súper Admin).
- **Columnas**: `id PK`, `nombre`, `nit UNIQUE NOT NULL`, `estado BOOLEAN NOT NULL DEFAULT true`, `created_at`, `updated_at`.
- **FK**: ninguna (raíz del árbol).
- **Restricciones**: `nit` único e inmutable una vez asignado (regla de negocio: "el NIT se configura una sola vez").

### 2. `usuarios_admin`
- **Propósito**: usuarios internos de BEET (GES, Súper Admin, Admin de cooperativa, Lector).
- **Columnas**: `id PK`, `cooperativa_id FK → cooperativas NULL`, `nombre`, `correo UNIQUE NOT NULL`, `password_hash NOT NULL`, `rol NOT NULL`, `estado BOOLEAN DEFAULT true`, `created_at`, `updated_at`.
- **Restricciones**:
  - `CHECK (rol IN ('SUPER_ADMIN','GES','ADMIN','LECTOR'))`.
  - `CHECK ((rol IN ('SUPER_ADMIN','GES') AND cooperativa_id IS NULL) OR (rol IN ('ADMIN','LECTOR') AND cooperativa_id IS NOT NULL))` — esto es la regla de negocio hecha constraint: imposible guardar un GES con cooperativa o un ADMIN sin ella.
- **Índices**: `UNIQUE(correo)`, índice en `cooperativa_id`.

### 3. `afiliados`
- **Propósito**: usuarios del portal, siempre atados a una cooperativa.
- **Columnas**: `id PK`, `cooperativa_id FK → cooperativas NOT NULL`, `nombres`, `apellidos`, `documento`, `correo`, `telefono NULL`, `password_hash NULL` (NULL = cuenta creada por la cooperativa pero aún no activada por el afiliado), `estado BOOLEAN DEFAULT true`, `created_at`, `updated_at`.
- **Restricciones**: `UNIQUE(documento)`, `UNIQUE(correo)` — un documento/correo identifica a una sola persona en todo BEET, incluso si en teoría podría estar en más de una cooperativa (decisión de simplicidad; si el negocio confirma que una persona puede afiliarse a 2 cooperativas distintas con el mismo documento, se debería mover a `UNIQUE(cooperativa_id, documento)`).
- **No incluye** `cupo_asignado` — ver tabla `cupos_credito`.

### 4. `cupos_credito` (uno a uno opcional con `afiliados`)
- **Propósito**: representar el cupo de crédito de un afiliado — que puede no existir.
- **Columnas**: `id PK`, `afiliado_id FK → afiliados UNIQUE NOT NULL`, `cupo_total NUMERIC(12,2) NOT NULL`, `cupo_disponible NUMERIC(12,2) NOT NULL` (saldo real, no "usado" acumulado — así lo fijó el esquema real citado en el código), `estado BOOLEAN DEFAULT true`, `created_at`, `updated_at`.
- **Restricciones**: `CHECK (cupo_disponible >= 0 AND cupo_disponible <= cupo_total)`.
- **Derivado, no almacenado**: `cupo_utilizado = cupo_total - cupo_disponible` (calcularlo siempre en la consulta/servicio, no persistirlo).
- **Sin fila = sin cupo** — así se representa "cupo opcional" sin usar NULLs dispersos en `afiliados`.

### 5. `cupos_cooperativa` (uno a uno opcional con `cooperativas`)
- **Propósito**: cupo que la cooperativa contrató con GES — igualmente opcional.
- **Columnas**: `id PK`, `cooperativa_id FK → cooperativas UNIQUE NOT NULL`, `monto_contratado NUMERIC(14,2) NOT NULL`, `monto_disponible NUMERIC(14,2) NOT NULL`, `created_at`, `updated_at`.
- **Restricciones**: `CHECK (monto_disponible >= 0 AND monto_disponible <= monto_contratado)`.
- **Derivado**: `monto_gastado = monto_contratado - monto_disponible`.

### 6. `proveedores`
- **Propósito**: la empresa que entrega bonos/boletas a GES (Cine Colombia, Éxito...).
- **Columnas**: `id PK`, `nombre UNIQUE NOT NULL`, `estado BOOLEAN DEFAULT true`, `created_at`, `updated_at`.

### 7. `convenios_catalogo` (catálogo maestro, administrado por GES)
- **Propósito**: la oferta/convenio ofrecido por un proveedor — nivel global, el mismo para todo BEET.
- **Columnas**: `id PK`, `proveedor_id FK → proveedores NOT NULL`, `nombre NOT NULL`, `descripcion NULL`, `estado_global BOOLEAN DEFAULT true` (interruptor de GES, independiente del de cada cooperativa), `created_at`, `updated_at`.
- **Nota**: hoy el frontend de GES (`PROVEEDORES` en `gesData.js`) colapsa proveedor y convenio 1:1; este diseño lo soporta igual (un proveedor con un único convenio) y no bloquea que en el futuro un proveedor tenga varios convenios.

### 8. `convenios_cooperativa` (tabla puente + configuración)
- **Propósito**: qué convenio del catálogo maestro seleccionó una cooperativa, y cómo lo configuró para sus afiliados. Es la tabla que hoy el mock llama simplemente `convenios`.
- **Columnas**: `id PK`, `cooperativa_id FK → cooperativas NOT NULL`, `convenio_catalogo_id FK → convenios_catalogo NOT NULL`, `precio_publico NUMERIC(12,2) NOT NULL`, `precio_beet NUMERIC(12,2) NOT NULL`, `fecha_inicio DATE NOT NULL`, `fecha_fin DATE NULL`, `estado_cooperativa BOOLEAN DEFAULT true`, `created_at`, `updated_at`.
- **Restricciones**: `UNIQUE(cooperativa_id, convenio_catalogo_id)` — una cooperativa no puede tener el mismo convenio "seleccionado" dos veces. `CHECK (precio_beet <= precio_publico)`.
- **Derivado, no almacenado**: `ahorro = precio_publico - precio_beet` y `ahorro_pct` — se calculan al leer, tal y como ya lo hace `BenefitCard.jsx` en el frontend actual.
- Esta tabla es el "convenio" que ve el afiliado en su catálogo (`Catalogo.jsx`), no `convenios_catalogo`.

### 9. `plantillas_base` (catálogo fijo)
- **Propósito**: los diseños predefinidos de boleta (`Clásico`, `Moderno`...).
- **Columnas**: `clave TEXT PK`, `nombre NOT NULL`.
- Tabla de referencia pequeña y estática — podría incluso ser un `CHECK` en vez de tabla, pero como se listan en UI (`SeleccionarPlantillaModal`) es más limpio como tabla.

### 10. `plantillas_personalizadas`
- **Propósito**: plantillas HTML personalizadas creadas para un `convenio_cooperativa` específico.
- **Columnas**: `id PK`, `convenio_cooperativa_id FK → convenios_cooperativa NOT NULL`, `nombre NOT NULL`, `version INT NOT NULL DEFAULT 1`, `html TEXT NOT NULL`, `en_uso BOOLEAN DEFAULT false`, `created_at`, `updated_at`.
- **Restricción recomendada**: a nivel de aplicación, solo una plantilla `en_uso = true` por `convenio_cooperativa_id` (se puede forzar con un índice único parcial: `UNIQUE (convenio_cooperativa_id) WHERE en_uso`).

### 11. `archivos_xml` (preparación, no implementación del parser)
- **Propósito**: registrar cada archivo XML que un proveedor entrega a GES, como origen trazable de las unidades de Storage.
- **Columnas**: `id PK`, `proveedor_id FK → proveedores NOT NULL`, `convenio_catalogo_id FK → convenios_catalogo NULL`, `nombre_archivo NOT NULL`, `estado NOT NULL DEFAULT 'CARGADO'` (`CHECK IN ('CARGADO','PROCESADO','ERROR')`), `unidades_generadas INT DEFAULT 0`, `created_at`, `procesado_at NULL`.
- Esto permite que, cuando exista el parser real, cada fila de `unidades_inventario` generada desde un XML apunte a su archivo de origen (`unidades_inventario.archivo_xml_id`), sin necesidad de rediseñar nada.

### 12. `unidades_inventario` (la pieza central del rediseño)
- **Propósito**: cada bono/boleta individual, desde que GES la recibe hasta que se entrega al afiliado. Sustituye a la vez la tabla `storage` de la propuesta inicial, el "inventario de cooperativa" y los "tickets" del afiliado — son la **misma unidad en distintos momentos de su vida**, no tres conceptos distintos.
- **Columnas**:
  - `id PK`
  - `convenio_catalogo_id FK → convenios_catalogo NOT NULL` (identidad fija: a qué convenio pertenece la boleta, no cambia nunca)
  - `codigo TEXT UNIQUE NOT NULL` (ej. `CC001`)
  - `fecha_vencimiento DATE NULL`
  - `estado NOT NULL DEFAULT 'EN_STORAGE'` — `CHECK IN ('EN_STORAGE','ASIGNADA','ENTREGADA','BLOQUEADA','CANCELADA','VENCIDA')` — **sin `REDIMIDA`**, por la regla fundamental de negocio.
  - `cooperativa_id FK → cooperativas NULL` (se llena cuando GES asigna la unidad; mientras es NULL, está en Storage de GES)
  - `afiliado_id FK → afiliados NULL` (se llena cuando se entrega al afiliado)
  - `transaccion_id FK → transacciones NULL` (qué compra generó la entrega)
  - `archivo_xml_id FK → archivos_xml NULL` (origen, si vino de un XML; NULL si se cargó manualmente)
  - `created_at`, `updated_at`
- **Restricciones**:
  - `CHECK (estado != 'ASIGNADA' OR cooperativa_id IS NOT NULL)`
  - `CHECK (estado != 'ENTREGADA' OR (cooperativa_id IS NOT NULL AND afiliado_id IS NOT NULL AND transaccion_id IS NOT NULL))`
- **Los agregados que hoy se guardan como número** ("disponible", "asignado", "vendidas" en `gesData.js`, o `resumenInventarioDe` en `mockDb.js`) **se calculan con `COUNT(*) GROUP BY estado`** sobre esta tabla — nunca se almacenan. Esto resuelve directamente la advertencia de negocio "Storage ≠ Inventario": son la misma tabla, filtrada por `cooperativa_id IS NULL` (Storage GES) vs `cooperativa_id = X AND afiliado_id IS NULL` (inventario de esa cooperativa) vs `afiliado_id = Y` (tickets de ese afiliado).

### 13. `transacciones` (compra del afiliado)
- **Propósito**: cada compra que hace un afiliado en el portal.
- **Columnas**: `id PK`, `afiliado_id FK → afiliados NOT NULL`, `convenio_cooperativa_id FK → convenios_cooperativa NOT NULL`, `cantidad INT NOT NULL`, `precio_unitario NUMERIC(12,2) NOT NULL` (snapshot del `precio_beet` al momento de comprar — los precios cambian con el tiempo, no se debe recalcular desde `convenios_cooperativa` a futuro), `total NUMERIC(12,2) NOT NULL`, `metodo_pago NOT NULL` (`CHECK IN ('TARJETA','CUPO')`), `numero_cuotas INT NULL`, `estado NOT NULL` (`CHECK IN ('PENDIENTE','COMPLETADA','RECHAZADA','CANCELADA')`), `referencia_pago TEXT NULL`, `motivo_rechazo TEXT NULL`, `resultado_pago TEXT NULL`, `created_at`.
- **No tiene** columna `codigos` (array) — las boletas entregadas son las filas de `unidades_inventario` con `transaccion_id` apuntando a esta fila.
- **Restricción**: `CHECK (metodo_pago != 'CUPO' OR numero_cuotas IS NOT NULL)`.

### 14. `transacciones_ges` (solicitud/operación cooperativa ↔ GES)
- **Propósito**: cuando una cooperativa solicita/compra bonos a GES.
- **Columnas**: `id PK`, `cooperativa_id FK → cooperativas NOT NULL`, `convenio_catalogo_id FK → convenios_catalogo NOT NULL`, `administrador_id FK → usuarios_admin NOT NULL`, `cantidad INT NOT NULL`, `forma_pago TEXT NULL` (placeholder mínimo — ver sección "Pagos" más abajo), `estado NOT NULL DEFAULT 'PENDIENTE'` (`CHECK IN ('PENDIENTE','COMPLETADA')` — solo estos dos, tal como pide la regla de negocio), `created_at`.
- Cuando `estado = 'COMPLETADA'`, deben existir N filas nuevas en `unidades_inventario` con `cooperativa_id` asignado (N = `cantidad`) — a nivel de servicio/backend, no de constraint de BD.

### 15. `documentos_asuncion_deuda`
- **Propósito**: soporte legal de compras a cuotas con cupo.
- **Columnas**: `id PK`, `afiliado_id FK → afiliados NOT NULL`, `transaccion_id FK → transacciones UNIQUE NOT NULL`, `valor NUMERIC(12,2) NOT NULL`, `numero_cuotas INT NOT NULL`, `fecha_generacion TIMESTAMPTZ NOT NULL`, `fecha_firma TIMESTAMPTZ NULL`, `firma_archivo_url TEXT NULL` (la imagen PNG de la firma, guardada como archivo/objeto — no como base64 en una columna de BD), `estado NOT NULL DEFAULT 'PENDIENTE'` (`CHECK IN ('PENDIENTE','FIRMADO')`).
- **Nota**: `convenio_nombre` que aparece en el mock es derivado (`JOIN` a través de `transaccion → convenio_cooperativa → convenio_catalogo`), no se guarda duplicado.

### 16. `logs_auditoria`
- **Propósito**: trazabilidad de acciones administrativas.
- **Columnas**: `id PK`, `usuario_admin_id FK → usuarios_admin NULL`, `cooperativa_id FK → cooperativas NULL`, `accion TEXT NOT NULL`, `tabla_afectada TEXT NOT NULL`, `registro_id BIGINT NULL`, `created_at`.
- Se agrega `usuario_admin_id` (ausente en el mock actual) porque un log de auditoría sin quién hizo la acción tiene valor limitado.

### Tablas de la propuesta inicial que **no sobreviven** tal cual
- `storage` (propuesta inicial) → absorbida por `unidades_inventario` + `convenios_catalogo`.
- `convenio` (propuesta inicial, plana) → dividida en `convenios_catalogo` + `convenios_cooperativa`.
- `proveedor` (propuesta inicial, con `id_nombre_convenio`) → rediseñada como `proveedores`, sin la columna rota.

---

## E. Diagrama lógico

```text
proveedores
   └── convenios_catalogo ── (estado_global, GES)
            │
            ├── convenios_cooperativa ── (estado_cooperativa, precios, vigencia)
            │        │
            │        ├── plantillas_personalizadas
            │        └── transacciones ── unidades_inventario (afiliado_id, transaccion_id)
            │                  └── documentos_asuncion_deuda
            │
            ├── unidades_inventario (cooperativa_id NULL = Storage GES)
            └── transacciones_ges (cooperativa ↔ GES)

archivos_xml ──> unidades_inventario (origen)

cooperativas
   ├── usuarios_admin (rol ADMIN/LECTOR)
   ├── afiliados
   │      ├── cupos_credito
   │      ├── transacciones
   │      └── unidades_inventario (afiliado_id)
   ├── convenios_cooperativa
   ├── cupos_cooperativa
   ├── transacciones_ges
   ├── unidades_inventario (cooperativa_id, sin afiliado_id = inventario cooperativa)
   └── logs_auditoria

usuarios_admin (rol SUPER_ADMIN / GES, cooperativa_id = NULL)
   └── logs_auditoria / transacciones_ges.administrador_id
```

---

## F. Flujo de una boleta (de XML a entrega)

```text
1. XML llega de un proveedor
   → archivos_xml (nueva fila, estado 'CARGADO')

2. Se procesa (a futuro; hoy es simulación visual)
   → N filas nuevas en unidades_inventario
     (convenio_catalogo_id, codigo, fecha_vencimiento,
      estado = 'EN_STORAGE', cooperativa_id = NULL,
      archivo_xml_id = archivos_xml.id)
   → archivos_xml.estado = 'PROCESADO', unidades_generadas = N

3. GES asigna unidades a una cooperativa (Storage → Cooperativa)
   → UPDATE unidades_inventario
       SET cooperativa_id = X, estado = 'ASIGNADA'
     WHERE estado = 'EN_STORAGE' AND convenio_catalogo_id = ...
     LIMIT cantidad_solicitada
   → transacciones_ges (registro de la operación, estado 'COMPLETADA' si
     había suficiente inventario en 'EN_STORAGE', 'PENDIENTE' si no)

4. La cooperativa tiene ahora "inventario"
   → es la misma tabla unidades_inventario, filtrada por
     cooperativa_id = X AND afiliado_id IS NULL
     (no existe una tabla "inventario_cooperativa" separada)

5. El afiliado compra
   → transacciones (nueva fila: afiliado_id, convenio_cooperativa_id, cantidad...)
   → UPDATE unidades_inventario
       SET afiliado_id = Y, transaccion_id = Z, estado = 'ENTREGADA'
     WHERE cooperativa_id = X AND convenio_catalogo_id = ... AND estado = 'ASIGNADA'
     LIMIT cantidad_comprada

6. FIN para BEET.
   Ningún registro nuevo se crea después de este punto para esa unidad.
   BEET no sabe ni pregunta si el proveedor la redimió.
```

Tablas que participan, en orden: `archivos_xml` → `unidades_inventario` → `transacciones_ges` → `unidades_inventario` (mismo registro, cambia de dueño) → `transacciones` → `unidades_inventario` (mismo registro, entrega final) → opcionalmente `documentos_asuncion_deuda` si el pago fue con cupo a cuotas.

---

## G. Normalización

Verificado explícitamente contra la propuesta y el mock actual:

- ❌ `mockDb.transacciones[].codigos` es un **array dentro de una columna** (`['CIN-000001','CIN-000002']`). Se elimina: las boletas entregadas son las filas de `unidades_inventario` con `transaccion_id` apuntando a esa transacción.
- ❌ `gesData.cooperativas[].afiliados` (conteo) y `.conveniosActivos`/`.inventarioAsignado`/`.solicitudesPendientes` (agregados calculados en el propio `gesData.js` con `.map()`) — todos derivables con `COUNT`/`SUM` sobre `afiliados`, `convenios_cooperativa`, `unidades_inventario` y `transacciones_ges`. No se persisten.
- ❌ `resumenInventarioDe(convenioId)` en `mockDb.js` (conteo por estado) — se convierte en una consulta agregada sobre `unidades_inventario`, no en columnas.
- ❌ `afiliadoConCupo()` que "aplana" `cupo_total`/`cupo_disponible` sobre el afiliado — en la BD siguen siendo una tabla separada (`cupos_credito`); el aplanado ocurre solo en la capa de servicio/API, nunca en el esquema.
- ✅ Ninguna tabla propuesta guarda listas de IDs (`cooperativa.id_afiliados`, `cooperativa.convenios`, etc.) — todas las relaciones son FK + tabla puente donde corresponde (`convenios_cooperativa`).

## H. Recomendaciones PostgreSQL

- **PK**: `BIGSERIAL`/`GENERATED ALWAYS AS IDENTITY` en todas las tablas transaccionales (`unidades_inventario`, `transacciones`, `transacciones_ges` van a crecer mucho — evitar `INT` si hay dudas de volumen).
- **FK**: `ON DELETE RESTRICT` por defecto en todo lo financiero/transaccional (`transacciones`, `unidades_inventario`, `documentos_asuncion_deuda`) — nunca se debe poder borrar una cooperativa o un afiliado con historial y perder la trazabilidad. `ON DELETE CASCADE` solo en relaciones puramente de configuración sin valor histórico (ej. `plantillas_personalizadas` si se borra el `convenio_cooperativa`).
- **UNIQUE**: `usuarios_admin.correo`, `afiliados.correo`, `afiliados.documento`, `cooperativas.nit`, `unidades_inventario.codigo`, `(cooperativa_id, convenio_catalogo_id)` en `convenios_cooperativa`.
- **NOT NULL**: todo campo que la regla de negocio dice que siempre debe existir (ver cada tabla arriba) — en particular `afiliados.cooperativa_id` y `usuarios_admin.rol`.
- **CHECK**: para los 3 enums cerrados y ya validados por negocio: `usuarios_admin.rol`, `transacciones.estado`, `transacciones_ges.estado`, `unidades_inventario.estado` (sin `REDIMIDA`), y las combinaciones cruzadas descritas en D.2 y D.12.
- **Índices**: además de los UNIQUE (que ya crean índice), agregar índices B-tree en las FK más consultadas: `unidades_inventario(cooperativa_id, estado)`, `unidades_inventario(afiliado_id)`, `unidades_inventario(convenio_catalogo_id, estado)`, `transacciones(afiliado_id, created_at)`, `convenios_cooperativa(cooperativa_id, estado_cooperativa)`.
- **Timestamps**: `TIMESTAMPTZ` siempre (no `TIMESTAMP` sin zona) — BEET opera en Colombia pero un servidor puede no estarlo; guardar en UTC y formatear en el frontend.
- **Contraseñas**: `password_hash` con bcrypt/argon2 vía la capa de aplicación (FastAPI), nunca función de hash en SQL ni contraseña en claro. Columna `TEXT`, no `VARCHAR(n)` corto.
- **Integridad referencial**: usar transacciones de BD (`BEGIN`/`COMMIT`) en toda operación que toque más de una tabla a la vez (ej. "asignar inventario" = `UPDATE unidades_inventario` + `INSERT transacciones_ges`; "comprar" = `INSERT transacciones` + `UPDATE unidades_inventario` [+ `INSERT documentos_asuncion_deuda`]) — para que nunca quede una unidad "entregada" sin su transacción, o viceversa.
- **Escalabilidad**: `unidades_inventario` es la tabla que más crecerá (una fila por bono/boleta física). Si el volumen lo justifica más adelante, particionar por `convenio_catalogo_id` o por rango de fecha de `created_at` — no es necesario para el volumen actual, pero el diseño (PK simple, sin claves compuestas raras) no lo bloquea.

---

## Pagos — qué queda pendiente a propósito

Por instrucción explícita, **no se inventa** un modelo financiero. Lo mínimo que ya se necesita para soportar el frontend actual:

- `transacciones.metodo_pago` (`TARJETA`/`CUPO`) + `referencia_pago`/`resultado_pago`/`motivo_rechazo` — ya cubre la simulación de pasarela existente en `PurchaseFlow.jsx`.
- `transacciones_ges.forma_pago` como texto libre (hoy "Cupo"/"Crédito" en el mock) — placeholder, sin tabla de movimientos ni ledger todavía.
- `cupos_credito` y `cupos_cooperativa` cubren el saldo simple que existe hoy.

**Pendiente de definir antes de construir** (no crear tablas todavía): bolsa, crédito GES↔cooperativa como relación contable real (con movimientos, no solo un saldo), pasarela de pago real, y si `forma_pago` en `transacciones_ges` debe ser un enum cerrado o una FK a una tabla de "formas de pago" configurable.

---

## Resumen para quien implemente el backend (FastAPI + PostgreSQL)

| Tabla | Para qué sirve | Cómo se relaciona | Por qué existe |
|---|---|---|---|
| `cooperativas` | Entidad raíz de cada cooperativa | Padre de `usuarios_admin`, `afiliados`, `convenios_cooperativa`, `unidades_inventario`, `transacciones_ges`, `cupos_cooperativa` | GES administra varias; todo lo demás cuelga de aquí |
| `usuarios_admin` | Login del panel (GES, Súper Admin, Admin, Lector) | `cooperativa_id` NULL para GES/Súper Admin | Un solo lugar para los 4 roles administrativos, con el constraint que impide combinaciones inválidas |
| `afiliados` | Usuarios del portal | `cooperativa_id` NOT NULL | El afiliado siempre pertenece a una cooperativa |
| `cupos_credito` | Cupo de crédito del afiliado | 1–1 opcional con `afiliados` | El cupo puede no existir; el saldo se guarda directo, no acumulado |
| `cupos_cooperativa` | Cupo que la cooperativa compró a GES | 1–1 opcional con `cooperativas` | Mismo patrón que el cupo del afiliado, a otro nivel |
| `proveedores` | Empresas que entregan bonos/boletas | Padre de `convenios_catalogo` | Es quien firma el convenio real con BEET/GES |
| `convenios_catalogo` | Catálogo maestro, administrado por GES | `proveedor_id`; padre de `convenios_cooperativa` | Nivel global: existe o no existe para todo BEET |
| `convenios_cooperativa` | Configuración de un convenio para una cooperativa | FK a `convenios_catalogo` + `cooperativas` | Nivel local: precio, vigencia y activo/inactivo por cooperativa — nunca se mezcla con el nivel global |
| `plantillas_base` | Catálogo fijo de diseños de boleta | Ninguna FK entrante fuerte (referencia por `clave`) | Lista cerrada y pequeña, reutilizable |
| `plantillas_personalizadas` | Diseño HTML de una boleta específica | `convenio_cooperativa_id` | Cada convenio-cooperativa puede tener su propio diseño |
| `archivos_xml` | Registro de cada XML recibido de un proveedor | `proveedor_id`; origen de `unidades_inventario` | Prepara la trazabilidad para cuando exista el parser real |
| `unidades_inventario` | Cada bono/boleta física, en cualquier etapa de su vida | `convenio_catalogo_id` fijo; `cooperativa_id`/`afiliado_id`/`transaccion_id` opcionales según la etapa | Sustituye Storage + Inventario de cooperativa + Tickets: es la misma unidad, no tres conceptos |
| `transacciones` | Compra de un afiliado | `afiliado_id`, `convenio_cooperativa_id` | Registra la compra; las boletas entregadas se ven por `unidades_inventario.transaccion_id` |
| `transacciones_ges` | Solicitud/compra de una cooperativa a GES | `cooperativa_id`, `convenio_catalogo_id`, `administrador_id` | Actores y flujo distintos de una compra de afiliado — nunca se mezclan en la misma tabla |
| `documentos_asuncion_deuda` | Soporte legal de compras a cuotas con cupo | `transaccion_id` (1–1) | Exigido cuando el pago es con cupo y hay cuotas |
| `logs_auditoria` | Quién hizo qué, cuándo | `usuario_admin_id`, `cooperativa_id` (ambos opcionales) | Trazabilidad administrativa mínima |

**Reglas que el backend debe hacer cumplir en código (no solo en BD):**
- Al completar una `transaccion` o una `transaccion_ges`, mover unidades de `unidades_inventario` dentro de la misma transacción de BD.
- Nunca escribir un estado `'REDIMIDA'`, ni ninguna fecha/lugar de redención — BEET no tiene esa información.
- Al calcular cupos, inventario disponible, ahorro, o cualquier "total" mostrado en UI: **consultar y agregar**, no leer una columna que lo guarde precalculado.
