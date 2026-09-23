# BEET Ticket — Diseño de base de datos (PostgreSQL)

Este documento traduce a un esquema relacional real toda la lógica que ya
quedó validada en el frontend (`beet_front`) a lo largo de las rondas
anteriores: roles, cooperativas, afiliados, catálogo de GES, Bolsa,
Crédito, inventario y transacciones. Es el punto de partida para el
backend (FastAPI + PostgreSQL) que todavía no existe.

Convenciones: `snake_case`, claves primarias `id BIGSERIAL`, timestamps en
`timestamptz`, dinero en `bigint` (pesos colombianos, sin decimales).

---

## 0. Mapa de dominios

```
1. Identidad y acceso        usuarios, cooperativas, afiliados
2. Catálogo maestro (GES)    convenios, productos, plantillas_pdf
3. Cooperativa × Convenio    cooperativa_convenios, cooperativa_productos
4. Bolsa y Crédito           cooperativa_bolsa, cooperativa_credito,
                             movimientos_bolsa, movimientos_credito
5. Inventario                storage_ges, unidades_inventario
6. Compras GES ↔ Cooperativa solicitudes_compra
7. Compras del afiliado      transacciones, tickets, cupos_credito_afiliado,
                             documentos_asuncion_deuda
8. Auditoría                 logs_auditoria
```

Regla general que atraviesa todo el diseño: **Bolsa y Crédito son
conceptos independientes y nunca comparten una columna, una tabla ni un
cálculo.** Cada uno tiene su propia tabla de estado y su propio ledger de
movimientos (dominio 4).

---

## 1. Identidad y acceso

```sql
CREATE TYPE rol_usuario AS ENUM ('SUPER_ADMIN', 'GES', 'ADMIN', 'LECTOR');

CREATE TABLE cooperativas (
  id              BIGSERIAL PRIMARY KEY,
  nombre          TEXT NOT NULL,
  nit             TEXT NOT NULL UNIQUE,
  estado          BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id              BIGSERIAL PRIMARY KEY,
  id_cooperativa  BIGINT REFERENCES cooperativas(id),
  nombre          TEXT NOT NULL,
  correo          TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  rol             rol_usuario NOT NULL,
  estado          BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- SUPER_ADMIN y GES no pertenecen a ninguna cooperativa;
  -- ADMIN y LECTOR SIEMPRE pertenecen a una.
  CONSTRAINT chk_usuario_cooperativa CHECK (
    (rol IN ('SUPER_ADMIN', 'GES') AND id_cooperativa IS NULL) OR
    (rol IN ('ADMIN', 'LECTOR') AND id_cooperativa IS NOT NULL)
  )
);

CREATE TABLE afiliados (
  id              BIGSERIAL PRIMARY KEY,
  id_cooperativa  BIGINT NOT NULL REFERENCES cooperativas(id),
  nombres         TEXT NOT NULL,
  apellidos       TEXT NOT NULL,
  documento       TEXT NOT NULL,
  correo          TEXT NOT NULL,
  telefono        TEXT,
  password_hash   TEXT,             -- NULL hasta que activa su cuenta del portal
  estado          BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_cooperativa, documento)
);
```

**Notas**
- Un afiliado pertenece a **una sola** cooperativa (no hay tabla puente).
- `usuarios.password_hash` separa credenciales de panel administrativo de
  `afiliados.password_hash` (portal) — dos superficies de login distintas,
  igual que hoy en el frontend (`EntrarAdministrador` vs. portal afiliado).

---

## 2. Catálogo maestro (propiedad de GES)

```sql
CREATE TABLE convenios (
  id              BIGSERIAL PRIMARY KEY,
  nombre          TEXT NOT NULL,
  estado          BOOLEAN NOT NULL DEFAULT true,   -- activo/inactivo en el catálogo maestro
  imagen_url      TEXT,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE productos (
  id                     BIGSERIAL PRIMARY KEY,
  id_convenio            BIGINT NOT NULL REFERENCES convenios(id),
  nombre                 TEXT NOT NULL,
  descripcion            TEXT,
  estado                 BOOLEAN NOT NULL DEFAULT false, -- nace inactivo hasta tener precio
  precio_venta_entidad   BIGINT CHECK (precio_venta_entidad IS NULL OR precio_venta_entidad > 0),
  fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una plantilla de PDF por convenio (nunca por producto).
CREATE TABLE plantillas_pdf (
  id              BIGSERIAL PRIMARY KEY,
  id_convenio     BIGINT NOT NULL UNIQUE REFERENCES convenios(id),
  nombre          TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'INACTIVA')),
  archivo_url     TEXT
);
```

**Notas**
- `productos.precio_venta_entidad`: lo que **GES le cobra a la
  cooperativa** por unidad. Es la única fuente de precio "de fábrica"; el
  precio al afiliado nunca se guarda aquí (se calcula, ver dominio 3).
- Un producto solo puede activarse cuando `precio_venta_entidad IS NOT
  NULL` — esa regla vive en la capa de aplicación (o en un `CHECK`
  adicional si se prefiere en base de datos).

---

## 3. Cooperativa × Convenio × Producto (precios al afiliado)

```sql
CREATE TABLE cooperativa_convenios (
  id                          BIGSERIAL PRIMARY KEY,
  id_cooperativa              BIGINT NOT NULL REFERENCES cooperativas(id),
  id_convenio                 BIGINT NOT NULL REFERENCES convenios(id),
  porcentaje_ganancia_entidad SMALLINT NOT NULL CHECK (porcentaje_ganancia_entidad BETWEEN 5 AND 50),
  fecha_inicio                DATE,
  fecha_fin                   DATE,
  estado                      BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (id_cooperativa, id_convenio)
);

-- Precio y vigencia por PRODUCTO, no por convenio: dos productos de un
-- mismo convenio pueden costarle distinto a la misma cooperativa.
CREATE TABLE cooperativa_productos (
  id              BIGSERIAL PRIMARY KEY,
  id_cooperativa  BIGINT NOT NULL REFERENCES cooperativas(id),
  id_producto     BIGINT NOT NULL REFERENCES productos(id),
  precio_normal   BIGINT CHECK (precio_normal IS NULL OR precio_normal > 0),
  descripcion     TEXT,
  fecha_inicio    DATE,
  fecha_fin       DATE,
  estado          BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (id_cooperativa, id_producto)
);
```

**Precio al afiliado — SIEMPRE calculado, nunca almacenado:**

```sql
-- precio_beet = precio_venta_entidad × (1 + porcentaje_ganancia_entidad / 100)
-- (redondeado). Se resuelve en tiempo de lectura (vista o función), igual
-- que hoy hace precioBeetDe() en el frontend, para que un cambio de GES o
-- de la cooperativa se refleje sin sincronizar nada manualmente.
CREATE FUNCTION precio_beet(p_cooperativa BIGINT, p_producto BIGINT)
RETURNS BIGINT AS $$
  SELECT ROUND(pr.precio_venta_entidad * (1 + cc.porcentaje_ganancia_entidad / 100.0))
  FROM productos pr
  JOIN cooperativa_convenios cc
    ON cc.id_convenio = pr.id_convenio AND cc.id_cooperativa = p_cooperativa
  WHERE pr.id = p_producto
    AND pr.precio_venta_entidad IS NOT NULL;
$$ LANGUAGE sql STABLE;
```

**Notas**
- Un `cooperativa_convenio` solo puede pasar a `estado = true` cuando al
  menos uno de sus productos ya está configurado (`precio_normal` +
  `precio_beet` calculable) — regla de aplicación, equivalente a
  `convenioListoParaActivar()` del frontend.

---

## 4. Bolsa y Crédito (núcleo del modelo financiero)

Dos saldos **completamente independientes** por cooperativa. Cada uno
tiene una tabla de estado (lectura rápida) y una tabla de movimientos
(ledger, fuente de verdad para auditoría — `consumido`/`utilizado` en el
estado son una proyección de la suma de sus movimientos, no el dato
maestro).

```sql
-- BOLSA: monto que la cooperativa ya compró y va consumiendo.
CREATE TABLE cooperativa_bolsa (
  id_cooperativa  BIGINT PRIMARY KEY REFERENCES cooperativas(id),
  valor           BIGINT NOT NULL DEFAULT 0 CHECK (valor >= 0),
  consumido       BIGINT NOT NULL DEFAULT 0 CHECK (consumido >= 0),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (consumido <= valor)
);

CREATE TABLE movimientos_bolsa (
  id              BIGSERIAL PRIMARY KEY,
  id_cooperativa  BIGINT NOT NULL REFERENCES cooperativas(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('COMPRA_BOLSA', 'CONSUMO')),
  valor           BIGINT NOT NULL CHECK (valor > 0),
  id_referencia   BIGINT,          -- FK lógica a solicitudes_compra.id cuando tipo = 'CONSUMO'
  creado_por      BIGINT REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CRÉDITO: cupo máximo AUTORIZADO por GES (un límite, no un saldo ya
-- usado) y lo que la cooperativa ya utilizó dentro de ese límite.
CREATE TABLE cooperativa_credito (
  id_cooperativa  BIGINT PRIMARY KEY REFERENCES cooperativas(id),
  cupo_autorizado BIGINT NOT NULL DEFAULT 0 CHECK (cupo_autorizado >= 0),
  utilizado       BIGINT NOT NULL DEFAULT 0 CHECK (utilizado >= 0),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (utilizado <= cupo_autorizado)
);

CREATE TABLE movimientos_credito (
  id              BIGSERIAL PRIMARY KEY,
  id_cooperativa  BIGINT NOT NULL REFERENCES cooperativas(id),
  tipo            TEXT NOT NULL CHECK (tipo IN ('AUMENTO_CUPO', 'CONSUMO')),
  valor           BIGINT NOT NULL CHECK (valor > 0),
  id_referencia   BIGINT,          -- FK lógica a solicitudes_compra.id cuando tipo = 'CONSUMO'
  creado_por      BIGINT REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Disponible — siempre calculado, nunca guardado:**

```
bolsa.disponible   = cooperativa_bolsa.valor - cooperativa_bolsa.consumido
credito.disponible = cooperativa_credito.cupo_autorizado - cooperativa_credito.utilizado
```

**Reglas que este diseño hace cumplir (ya validadas en el frontend):**
- Aumentar `cupo_autorizado` **nunca** toca `utilizado` ni la bolsa
  (son tablas distintas, sin trigger cruzado).
- Una compra usa **un solo** método de financiación — cada línea de
  `solicitudes_compra` (dominio 6) trae su propio `forma_pago`, y genera
  como máximo un movimiento en `movimientos_bolsa` **o** en
  `movimientos_credito`, nunca ambos.
- `consumido`/`utilizado` deberían mantenerse por trigger (`AFTER INSERT`
  en `movimientos_bolsa`/`movimientos_credito` que actualiza la fila de
  estado) para que nunca queden desincronizados de su propio ledger.

---

## 5. Inventario

```sql
-- Storage central de GES: unidades/códigos individuales aún sin asignar.
CREATE TABLE storage_ges (
  id                  BIGSERIAL PRIMARY KEY,
  id_producto         BIGINT NOT NULL REFERENCES productos(id),
  codigo              TEXT NOT NULL UNIQUE,
  estado              TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE', 'ASIGNADO')),
  fecha_vencimiento   DATE
);

-- Inventario que ya recibió UNA cooperativa y va entregando a sus afiliados.
CREATE TABLE unidades_inventario (
  id                  BIGSERIAL PRIMARY KEY,
  id_cooperativa      BIGINT NOT NULL REFERENCES cooperativas(id),
  id_producto         BIGINT NOT NULL REFERENCES productos(id),
  codigo              TEXT NOT NULL UNIQUE,
  estado              TEXT NOT NULL DEFAULT 'DISPONIBLE' CHECK (estado IN ('DISPONIBLE', 'ENTREGADA', 'VENCIDA')),
  fecha_asignacion    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Nota:** BEET no controla la redención del bono — por eso no existe un
estado "usado/redimido"; `ENTREGADA` es el estado final que importa acá.

---

## 6. Compras GES ↔ Cooperativa

```sql
CREATE TABLE solicitudes_compra (
  id                  BIGSERIAL PRIMARY KEY,
  id_cooperativa      BIGINT NOT NULL REFERENCES cooperativas(id),
  id_producto         BIGINT NOT NULL REFERENCES productos(id),
  cantidad            INTEGER NOT NULL CHECK (cantidad > 0),
  forma_pago          TEXT NOT NULL CHECK (forma_pago IN ('BOLSA', 'CREDITO')),
  estado              TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'COMPLETADA')),
  prioridad           TEXT NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('NORMAL', 'ALTA')),
  id_usuario          BIGINT NOT NULL REFERENCES usuarios(id),  -- administrador que la hizo
  fecha_solicitud     TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_completada    TIMESTAMPTZ
);
```

**Regla de negocio central (dinero vs. inventario), tal como quedó
definida en el frontend:**

```
DINERO INSUFICIENTE (bolsa o crédito)
        ↓
  Se valida ANTES de guardar nada
        ↓
  NO se crea fila en solicitudes_compra

DINERO DISPONIBLE
        ↓
  Se crea la fila y se descuenta bolsa/crédito
        ↓
  ¿Storage tiene unidades DISPONIBLE suficientes?
        │
        ├─ Sí → estado = 'COMPLETADA', se mueven unidades de
        │       storage_ges (DISPONIBLE→ASIGNADO) hacia
        │       unidades_inventario de la cooperativa.
        │
        └─ No → estado = 'PENDIENTE' (falta inventario, no dinero).
```

Es decir: la falta de dinero nunca produce una fila `PENDIENTE` — la
insuficiencia de saldo se resuelve **antes** de tocar esta tabla; solo la
falta de inventario en `storage_ges` puede dejar una solicitud pendiente.

---

## 7. Compras del afiliado

```sql
CREATE TABLE cupos_credito_afiliado (
  id_afiliado     BIGINT PRIMARY KEY REFERENCES afiliados(id),
  cupo_total      BIGINT NOT NULL CHECK (cupo_total >= 0),
  cupo_disponible BIGINT NOT NULL CHECK (cupo_disponible >= 0),
  estado          BOOLEAN NOT NULL DEFAULT true,
  CHECK (cupo_disponible <= cupo_total)
);

CREATE TABLE transacciones (
  id              BIGSERIAL PRIMARY KEY,
  id_afiliado     BIGINT NOT NULL REFERENCES afiliados(id),
  id_producto     BIGINT NOT NULL REFERENCES productos(id),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  subtotal        BIGINT NOT NULL,
  total           BIGINT NOT NULL,
  metodo_pago     TEXT NOT NULL CHECK (metodo_pago IN ('TARJETA', 'CUPO')),
  numero_cuotas   SMALLINT,             -- solo aplica a CUPO
  estado          TEXT NOT NULL DEFAULT 'COMPLETADA' CHECK (estado = 'COMPLETADA'),
  referencia_pago TEXT,                 -- id de autorización de la pasarela (solo TARJETA)
  resultado_pago  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un pago rechazado por la pasarela nunca genera fila aquí — el afiliado
-- solo ve el error; no existe un estado "RECHAZADA".

CREATE TABLE tickets (
  id              BIGSERIAL PRIMARY KEY,
  id_afiliado     BIGINT NOT NULL REFERENCES afiliados(id),
  id_producto     BIGINT NOT NULL REFERENCES productos(id),
  id_transaccion  BIGINT REFERENCES transacciones(id),
  codigo          TEXT NOT NULL UNIQUE,
  estado          TEXT NOT NULL DEFAULT 'ENTREGADA' CHECK (estado IN ('ENTREGADA', 'VENCIDA'))
);

CREATE TABLE documentos_asuncion_deuda (
  id                  BIGSERIAL PRIMARY KEY,
  id_afiliado         BIGINT NOT NULL REFERENCES afiliados(id),
  id_producto         BIGINT NOT NULL REFERENCES productos(id),
  id_transaccion      BIGINT NOT NULL REFERENCES transacciones(id),
  valor               BIGINT NOT NULL,
  numero_cuotas       SMALLINT NOT NULL,
  fecha_generacion    TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_firma         TIMESTAMPTZ,
  estado              TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'FIRMADO', 'CANCELADO'))
);
```

**Nota importante de alcance:** esta sección (compra del afiliado dentro
de su cooperativa, pago con tarjeta o con el cupo del afiliado) es un
circuito **distinto** del de Bolsa/Crédito de la cooperativa (sección 4 y
6) — el afiliado nunca toca la bolsa ni el crédito de su cooperativa
directamente; consume su propio `cupo_credito_afiliado` o paga con
tarjeta. No mezclar ambos flujos.

---

## 8. Auditoría

```sql
CREATE TABLE logs_auditoria (
  id              BIGSERIAL PRIMARY KEY,
  id_cooperativa  BIGINT REFERENCES cooperativas(id),
  id_usuario      BIGINT REFERENCES usuarios(id),
  accion          TEXT NOT NULL,
  tabla_afectada  TEXT NOT NULL,
  registro_id     BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 9. Relaciones clave (resumen)

```
cooperativas 1──* usuarios
cooperativas 1──* afiliados
cooperativas 1──1 cooperativa_bolsa
cooperativas 1──1 cooperativa_credito
cooperativas 1──* movimientos_bolsa
cooperativas 1──* movimientos_credito
cooperativas 1──* cooperativa_convenios ──* convenios
cooperativas 1──* cooperativa_productos ──* productos ──* convenios
cooperativas 1──* unidades_inventario ──* productos
cooperativas 1──* solicitudes_compra ──* productos
                       │
                       └── forma_pago = 'BOLSA'   → movimientos_bolsa
                       └── forma_pago = 'CREDITO' → movimientos_credito

afiliados 1──1 cupos_credito_afiliado
afiliados 1──* transacciones ──* productos
afiliados 1──* tickets
afiliados 1──* documentos_asuncion_deuda

convenios 1──* productos
convenios 1──1 plantillas_pdf
productos 1──* storage_ges
```

---

## 10. Correspondencia con el mock actual del frontend

| Tabla real                  | Origen en `beet_front` (mock)                                  |
|------------------------------|------------------------------------------------------------------|
| `cooperativas`               | `services/mockDb.js` → `cooperativas` + `pages/admin/ges/gesData.js` → `cooperativas` (hoy duplicados a propósito; se fusionan en una sola tabla real) |
| `usuarios`                   | `services/mockDb.js` → `usuarios`                                |
| `afiliados`                  | `services/mockDb.js` → `afiliados`                               |
| `convenios`                  | `gesData.js` → `PROVEEDORES`                                     |
| `productos`                  | `gesData.js` → `PRODUCTOS`                                       |
| `cooperativa_convenios`      | `mockDb.js` → `cooperativasConvenios`                             |
| `cooperativa_productos`      | `mockDb.js` → `cooperativaProductos`                              |
| `cooperativa_bolsa`          | `gesData.js` → `cooperativas[].bolsa`                             |
| `cooperativa_credito`        | `gesData.js` → `cooperativas[].credito`                           |
| `storage_ges`                | `gesData.js` → `STORAGE`                                          |
| `unidades_inventario`        | `mockDb.js` → `unidadesInventario`                                |
| `solicitudes_compra`         | `gesData.js` → `solicitudes`                                      |
| `transacciones`               | `mockDb.js` → `transacciones`                                     |
| `tickets`                     | `mockDb.js` → `tickets`                                           |
| `cupos_credito_afiliado`      | `mockDb.js` → `cupos`                                             |
| `documentos_asuncion_deuda`   | `mockDb.js` → `documentos`                                        |
| `logs_auditoria`              | `mockDb.js` → `logsAuditoria`                                     |

`movimientos_bolsa` y `movimientos_credito` **no existen todavía en el
mock** (hoy `bolsa.consumido`/`credito.utilizado` son contadores mutados
directamente por `registrarConsumoBolsa`/`registrarConsumoCupo`) — se
proponen aquí como el ledger de auditoría que un backend real necesita
para no perder el historial de cada movimiento.

---

## 11. Lo que este diseño deliberadamente NO define todavía

Siguiendo el alcance acordado, este esquema **no** incluye:
- Tasas de interés, cuotas, moras ni intereses de mora sobre Crédito.
- Reglas de scoring o aprobación financiera automática.
- Conciliación contable ni integración con pasarela de pago real
  (Payments Way).
- Tablas para el flujo de pago del afiliado con Payments Way (quedará
  documentado aparte cuando se defina esa integración).

Estos puntos se añaden como una migración posterior, sin romper lo que
ya queda definido aquí.
