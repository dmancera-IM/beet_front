-- =====================================================================
-- BEET TICKET - Esquema PostgreSQL completo
-- Basado en el análisis de DATABASE_DESIGN.md (mockDb.js, gesData.js y
-- las ~40 vistas admin/portal del frontend).
-- =====================================================================

-- DROP DATABASE IF EXISTS beet_ticket;

CREATE DATABASE beet_ticket
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'Spanish_Colombia.1252'
    LC_CTYPE = 'Spanish_Colombia.1252'
    LOCALE_PROVIDER = 'libc'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    IS_TEMPLATE = False;

-- \c beet_ticket

-- =====================================================================
-- 1. COOPERATIVAS (raíz del árbol)
-- =====================================================================
CREATE TABLE cooperativas (
    id_cooperativa  SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    nit             VARCHAR(30) NOT NULL UNIQUE,
    estado          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. USUARIOS ADMINISTRATIVOS (GES, SUPER_ADMIN, ADMIN, LECTOR)
-- =====================================================================
CREATE TABLE usuarios_admin (
    id_usuario      SERIAL PRIMARY KEY,
    id_cooperativa  INTEGER NULL REFERENCES cooperativas(id_cooperativa) ON DELETE RESTRICT,
    nombre          VARCHAR(150) NOT NULL,
    correo          VARCHAR(150) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    rol             VARCHAR(20) NOT NULL,
    estado          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_usuario_rol
        CHECK (rol IN ('SUPER_ADMIN', 'GES', 'ADMIN', 'LECTOR')),

    CONSTRAINT chk_usuario_rol_cooperativa
        CHECK (
            (rol IN ('SUPER_ADMIN', 'GES') AND id_cooperativa IS NULL)
            OR
            (rol IN ('ADMIN', 'LECTOR') AND id_cooperativa IS NOT NULL)
        )
);

CREATE INDEX idx_usuarios_admin_cooperativa ON usuarios_admin(id_cooperativa);

-- =====================================================================
-- 3. AFILIADOS (usuarios del portal)
-- =====================================================================
CREATE TABLE afiliados (
    id_afiliado     SERIAL PRIMARY KEY,
    id_cooperativa  INTEGER NOT NULL REFERENCES cooperativas(id_cooperativa) ON DELETE RESTRICT,
    nombres         VARCHAR(150) NOT NULL,
    apellidos       VARCHAR(150) NOT NULL,
    documento       VARCHAR(50) NOT NULL UNIQUE,
    correo          VARCHAR(150) NOT NULL UNIQUE,
    telefono        VARCHAR(30) NULL,
    -- NULL = cuenta creada por la cooperativa, aún no activada por el afiliado
    password_hash   TEXT NULL,
    estado          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_afiliados_cooperativa ON afiliados(id_cooperativa);

-- =====================================================================
-- 4. CUPO DE CRÉDITO DEL AFILIADO (0 o 1 fila por afiliado)
-- =====================================================================
CREATE TABLE cupos_credito (
    id_cupo         SERIAL PRIMARY KEY,
    id_afiliado     INTEGER NOT NULL UNIQUE REFERENCES afiliados(id_afiliado) ON DELETE RESTRICT,
    cupo_total      NUMERIC(12,2) NOT NULL,
    -- saldo disponible real, no "usado" acumulado
    cupo_disponible NUMERIC(12,2) NOT NULL,
    estado          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_cupo_credito_rango
        CHECK (cupo_disponible >= 0 AND cupo_disponible <= cupo_total)
);

-- =====================================================================
-- 5. CUPO DE LA COOPERATIVA FRENTE A GES (0 o 1 fila por cooperativa)
-- =====================================================================
CREATE TABLE cupos_cooperativa (
    id_cupo             SERIAL PRIMARY KEY,
    id_cooperativa      INTEGER NOT NULL UNIQUE REFERENCES cooperativas(id_cooperativa) ON DELETE RESTRICT,
    monto_contratado    NUMERIC(14,2) NOT NULL,
    monto_disponible    NUMERIC(14,2) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_cupo_cooperativa_rango
        CHECK (monto_disponible >= 0 AND monto_disponible <= monto_contratado)
);

-- =====================================================================
-- 6. PROVEEDORES (Cine Colombia, Éxito, etc.)
-- =====================================================================
CREATE TABLE proveedores (
    id_proveedor    SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL UNIQUE,
    estado          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 7. CATÁLOGO MAESTRO DE CONVENIOS (administrado por GES, nivel global)
-- =====================================================================
CREATE TABLE convenios_catalogo (
    id_convenio_catalogo    SERIAL PRIMARY KEY,
    id_proveedor            INTEGER NOT NULL REFERENCES proveedores(id_proveedor) ON DELETE RESTRICT,
    nombre                  VARCHAR(150) NOT NULL,
    descripcion             TEXT NULL,
    estado_global           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_convenios_catalogo_proveedor ON convenios_catalogo(id_proveedor);

-- =====================================================================
-- 8. CONVENIO SELECCIONADO Y CONFIGURADO POR UNA COOPERATIVA
-- =====================================================================
CREATE TABLE convenios_cooperativa (
    id_convenio_cooperativa    SERIAL PRIMARY KEY,
    id_cooperativa             INTEGER NOT NULL REFERENCES cooperativas(id_cooperativa) ON DELETE RESTRICT,
    id_convenio_catalogo       INTEGER NOT NULL REFERENCES convenios_catalogo(id_convenio_catalogo) ON DELETE RESTRICT,
    precio_publico             NUMERIC(12,2) NOT NULL,
    precio_beet                NUMERIC(12,2) NOT NULL,
    fecha_inicio               DATE NOT NULL,
    fecha_fin                  DATE NULL,
    estado_cooperativa         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_convenio_cooperativa UNIQUE (id_cooperativa, id_convenio_catalogo),
    CONSTRAINT chk_precio_beet_menor_igual CHECK (precio_beet <= precio_publico)
);

CREATE INDEX idx_convenios_cooperativa_estado ON convenios_cooperativa(id_cooperativa, estado_cooperativa);

-- =====================================================================
-- 9. PLANTILLAS BASE (catálogo fijo de diseños de boleta)
-- =====================================================================
CREATE TABLE plantillas_base (
    clave   VARCHAR(50) PRIMARY KEY,
    nombre  VARCHAR(100) NOT NULL
);

-- =====================================================================
-- 10. PLANTILLAS PERSONALIZADAS (HTML por convenio-cooperativa)
-- =====================================================================
CREATE TABLE plantillas_personalizadas (
    id_plantilla                SERIAL PRIMARY KEY,
    id_convenio_cooperativa     INTEGER NOT NULL REFERENCES convenios_cooperativa(id_convenio_cooperativa) ON DELETE CASCADE,
    nombre                      VARCHAR(150) NOT NULL,
    version                     INTEGER NOT NULL DEFAULT 1,
    html                        TEXT NOT NULL,
    en_uso                      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo una plantilla "en uso" por convenio-cooperativa
CREATE UNIQUE INDEX uq_plantilla_en_uso
    ON plantillas_personalizadas(id_convenio_cooperativa)
    WHERE en_uso;

-- =====================================================================
-- 11. ARCHIVOS XML (origen trazable de las unidades de inventario)
-- =====================================================================
CREATE TABLE archivos_xml (
    id_archivo              SERIAL PRIMARY KEY,
    id_proveedor            INTEGER NOT NULL REFERENCES proveedores(id_proveedor) ON DELETE RESTRICT,
    id_convenio_catalogo    INTEGER NULL REFERENCES convenios_catalogo(id_convenio_catalogo) ON DELETE SET NULL,
    nombre_archivo          VARCHAR(255) NOT NULL,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'CARGADO',
    unidades_generadas      INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    procesado_at            TIMESTAMPTZ NULL,

    CONSTRAINT chk_archivo_xml_estado
        CHECK (estado IN ('CARGADO', 'PROCESADO', 'ERROR'))
);

-- =====================================================================
-- 12. UNIDADES DE INVENTARIO (Storage GES + Inventario cooperativa +
--     Tickets del afiliado: la misma unidad en distintos momentos)
-- =====================================================================
CREATE TABLE unidades_inventario (
    id_unidad               SERIAL PRIMARY KEY,
    id_convenio_catalogo    INTEGER NOT NULL REFERENCES convenios_catalogo(id_convenio_catalogo) ON DELETE RESTRICT,
    codigo                  VARCHAR(50) NOT NULL UNIQUE,
    fecha_vencimiento       DATE NULL,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'EN_STORAGE',
    -- se llena cuando GES asigna la unidad a una cooperativa
    id_cooperativa          INTEGER NULL REFERENCES cooperativas(id_cooperativa) ON DELETE RESTRICT,
    -- se llena cuando se entrega al afiliado
    id_afiliado             INTEGER NULL REFERENCES afiliados(id_afiliado) ON DELETE RESTRICT,
    -- qué compra generó la entrega (se agrega FK real más abajo con ALTER,
    -- porque transacciones aún no existe en este punto del script)
    id_transaccion          INTEGER NULL,
    id_archivo_xml          INTEGER NULL REFERENCES archivos_xml(id_archivo) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Sin 'REDIMIDA': BEET no controla la redención del proveedor
    CONSTRAINT chk_unidad_estado
        CHECK (estado IN ('EN_STORAGE', 'ASIGNADA', 'ENTREGADA', 'BLOQUEADA', 'CANCELADA', 'VENCIDA')),

    CONSTRAINT chk_unidad_asignada
        CHECK (estado != 'ASIGNADA' OR id_cooperativa IS NOT NULL),

    CONSTRAINT chk_unidad_entregada
        CHECK (
            estado != 'ENTREGADA'
            OR (id_cooperativa IS NOT NULL AND id_afiliado IS NOT NULL AND id_transaccion IS NOT NULL)
        )
);

CREATE INDEX idx_unidad_cooperativa_estado ON unidades_inventario(id_cooperativa, estado);
CREATE INDEX idx_unidad_afiliado ON unidades_inventario(id_afiliado);
CREATE INDEX idx_unidad_convenio_estado ON unidades_inventario(id_convenio_catalogo, estado);

-- =====================================================================
-- 13. TRANSACCIONES (compra del afiliado en el portal)
-- =====================================================================
CREATE TABLE transacciones (
    id_transaccion              SERIAL PRIMARY KEY,
    id_afiliado                 INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE RESTRICT,
    id_convenio_cooperativa     INTEGER NOT NULL REFERENCES convenios_cooperativa(id_convenio_cooperativa) ON DELETE RESTRICT,
    cantidad                    INTEGER NOT NULL,
    -- snapshot del precio_beet al momento de comprar
    precio_unitario              NUMERIC(12,2) NOT NULL,
    total                        NUMERIC(12,2) NOT NULL,
    metodo_pago                  VARCHAR(20) NOT NULL,
    numero_cuotas                INTEGER NULL,
    estado                       VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    referencia_pago              TEXT NULL,
    motivo_rechazo               TEXT NULL,
    resultado_pago               TEXT NULL,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_transaccion_metodo_pago
        CHECK (metodo_pago IN ('TARJETA', 'CUPO')),

    CONSTRAINT chk_transaccion_estado
        CHECK (estado IN ('PENDIENTE', 'COMPLETADA', 'RECHAZADA', 'CANCELADA')),

    CONSTRAINT chk_transaccion_cuotas
        CHECK (metodo_pago != 'CUPO' OR numero_cuotas IS NOT NULL)
);

CREATE INDEX idx_transacciones_afiliado_fecha ON transacciones(id_afiliado, created_at);

-- Ahora sí se puede referenciar transacciones desde unidades_inventario
ALTER TABLE unidades_inventario
    ADD CONSTRAINT fk_unidad_transaccion
    FOREIGN KEY (id_transaccion) REFERENCES transacciones(id_transaccion) ON DELETE RESTRICT;

-- =====================================================================
-- 14. TRANSACCIONES GES <-> COOPERATIVA (solicitud/compra de bonos)
-- =====================================================================
CREATE TABLE transacciones_ges (
    id_transaccion_ges      SERIAL PRIMARY KEY,
    id_cooperativa          INTEGER NOT NULL REFERENCES cooperativas(id_cooperativa) ON DELETE RESTRICT,
    id_convenio_catalogo    INTEGER NOT NULL REFERENCES convenios_catalogo(id_convenio_catalogo) ON DELETE RESTRICT,
    id_administrador        INTEGER NOT NULL REFERENCES usuarios_admin(id_usuario) ON DELETE RESTRICT,
    cantidad                 INTEGER NOT NULL,
    forma_pago               VARCHAR(50) NULL,
    estado                   VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_transaccion_ges_estado
        CHECK (estado IN ('PENDIENTE', 'COMPLETADA'))
);

-- =====================================================================
-- 15. DOCUMENTOS DE ASUNCIÓN DE DEUDA (compras a cuotas con cupo)
-- =====================================================================
CREATE TABLE documentos_asuncion_deuda (
    id_documento         SERIAL PRIMARY KEY,
    id_afiliado          INTEGER NOT NULL REFERENCES afiliados(id_afiliado) ON DELETE RESTRICT,
    id_transaccion       INTEGER NOT NULL UNIQUE REFERENCES transacciones(id_transaccion) ON DELETE RESTRICT,
    valor                NUMERIC(12,2) NOT NULL,
    numero_cuotas        INTEGER NOT NULL,
    fecha_generacion     TIMESTAMPTZ NOT NULL,
    fecha_firma          TIMESTAMPTZ NULL,
    firma_archivo_url    TEXT NULL,
    estado               VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT chk_documento_estado
        CHECK (estado IN ('PENDIENTE', 'FIRMADO'))
);

-- =====================================================================
-- 16. LOGS DE AUDITORÍA
-- =====================================================================
CREATE TABLE logs_auditoria (
    id_log              SERIAL PRIMARY KEY,
    id_usuario_admin    INTEGER NULL REFERENCES usuarios_admin(id_usuario) ON DELETE SET NULL,
    id_cooperativa      INTEGER NULL REFERENCES cooperativas(id_cooperativa) ON DELETE SET NULL,
    accion              TEXT NOT NULL,
    tabla_afectada      VARCHAR(100) NOT NULL,
    registro_id         BIGINT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- Datos de referencia mínimos (plantillas base fijas vistas en la UI)
-- =====================================================================
INSERT INTO plantillas_base (clave, nombre) VALUES
    ('CLASICO', 'Clásico'),
    ('MODERNO', 'Moderno');
