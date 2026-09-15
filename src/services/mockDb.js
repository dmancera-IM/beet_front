// Base de datos ficticia, en memoria, para poder ejecutar este frontend
// SIN backend. Sustituye por completo al FastAPI + PostgreSQL real que
// consume services/apiClient.js en el proyecto original — ninguna otra
// parte del código (páginas, componentes, contexts) fue modificada: todas
// siguen llamando a los mismos services de siempre, que a su vez llaman a
// apiClient, que ahora resuelve contra estos datos en lugar de hacer fetch.
//
// Los datos se reinician cada vez que se recarga la página (todo vive en
// variables `let` de este módulo). Esto es SOLO para poder navegar y
// probar visualmente el proyecto — no persiste nada real.

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

let nextId = {
  admin: 100,
  cooperativa: 100,
  afiliado: 1000,
  convenio: 100,
  unidad: 10000,
  cupo: 100,
  transaccion: 5000,
  documento: 500,
  plantilla: 100,
  ticket: 5000,
  log: 1000,
};

function newId(kind) {
  return nextId[kind]++;
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function dateOnly(offsetDays = 0) {
  return todayISO(offsetDays).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Cooperativas (alcance del panel admin — universo mock independiente del
// de GES, que ya trae su propio mock en pages/admin/ges/gesData.js)
// ---------------------------------------------------------------------------

export const cooperativas = [
  { id: 1, nombre: 'Cooperativa Bienestar', nit: '900123456-7', estado: true },
  { id: 2, nombre: 'Cooperativa Unión', nit: '900987654-3', estado: true },
  { id: 3, nombre: 'Cooperativa Horizonte', nit: '901222333-1', estado: false },
];

// ---------------------------------------------------------------------------
// Usuarios administradores (login del panel admin)
// ---------------------------------------------------------------------------

export const admins = [
  { id: 1, nombre: 'Diana Martínez', correo: 'superadmin@beetticket.com', rol: 'SUPER_ADMIN', cooperativa_id: null, estado: true },
  { id: 2, nombre: 'Carlos Gómez', correo: 'admin@beetticket.com', rol: 'ADMIN', cooperativa_id: 1, estado: true },
  { id: 3, nombre: 'Laura Pérez', correo: 'lector@beetticket.com', rol: 'LECTOR', cooperativa_id: 1, estado: true },
  { id: 4, nombre: 'Andrés Ruiz', correo: 'admin.union@beetticket.com', rol: 'ADMIN', cooperativa_id: 2, estado: true },
  // GES: no pertenece a ninguna cooperativa (cooperativa_id: null), igual
  // que SUPER_ADMIN — pero es un rol distinto con su propia área (ver
  // pages/admin/ges/) que SUPER_ADMIN puede visitar pero que nunca administra
  // usuarios ni ve la vista panorámica de super admin.
  { id: 5, nombre: 'Equipo GES', correo: 'ges@beetticket.com', rol: 'GES', cooperativa_id: null, estado: true },
];

// ---------------------------------------------------------------------------
// Afiliados (+ credenciales de portal)
// ---------------------------------------------------------------------------

export const afiliados = [
  { id: 1, nombres: 'Juan', apellidos: 'Pérez', documento: '1000000001', correo: 'juan.perez@correo.com', telefono: '3001234567', estado: true, cooperativa_id: 1 },
  { id: 2, nombres: 'María', apellidos: 'Gómez', documento: '1000000002', correo: 'maria.gomez@correo.com', telefono: '3009876543', estado: true, cooperativa_id: 1 },
  { id: 3, nombres: 'Diana', apellidos: 'Martínez', documento: '1000000003', correo: 'diana.martinez@correo.com', telefono: '3005124471', estado: true, cooperativa_id: 1 },
  { id: 4, nombres: 'Pedro', apellidos: 'Ramírez', documento: '1000000004', correo: 'pedro.ramirez@correo.com', telefono: null, estado: false, cooperativa_id: 1 },
  { id: 5, nombres: 'Sofía', apellidos: 'Castro', documento: '1000000005', correo: 'sofia.castro@correo.com', telefono: '3012223344', estado: true, cooperativa_id: 2 },
  { id: 6, nombres: 'Andrés', apellidos: 'Londoño', documento: '1000000006', correo: 'andres.londono@correo.com', telefono: '3019998877', estado: true, cooperativa_id: 2 },
];

// Roster row seeded WITHOUT an activated portal password yet — lets
// PortalRegister's "activar cuenta" flow be demoed for real (documento +
// correo deben coincidir exactamente).
export const afiliadoPendienteActivacion = { documento: '1000000009', correo: 'nuevo.afiliado@correo.com' };

// ---------------------------------------------------------------------------
// Convenios
// ---------------------------------------------------------------------------

export const convenios = [
  { id: 1, cooperativa_id: 1, nombre: 'Cine Colombia', descripcion: 'Entradas 2D/3D válidas de lunes a viernes.', precio_publico: 18000, precio_beet: 12500, fecha_inicio: dateOnly(-120), fecha_fin: dateOnly(120), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 2, cooperativa_id: 1, nombre: 'Mundo Aventura', descripcion: 'Entrada general al parque.', precio_publico: 65000, precio_beet: 48000, fecha_inicio: dateOnly(-90), fecha_fin: dateOnly(200), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 3, cooperativa_id: 1, nombre: 'Éxito', descripcion: 'Bono de mercado, válido en todo el país.', precio_publico: 50000, precio_beet: 46000, fecha_inicio: dateOnly(-200), fecha_fin: null, estado: true, plantilla_en_uso: 'Diseño oficial', imagen_marca_url: null },
  { id: 4, cooperativa_id: 1, nombre: 'Salitre Mágico', descripcion: 'Entrada general al parque de diversiones.', precio_publico: 55000, precio_beet: 39000, fecha_inicio: dateOnly(-30), fecha_fin: dateOnly(10), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 5, cooperativa_id: 1, nombre: 'Spa Relax', descripcion: 'Sesión de bienestar de una hora.', precio_publico: 90000, precio_beet: 70000, fecha_inicio: dateOnly(-400), fecha_fin: dateOnly(-30), estado: false, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 6, cooperativa_id: 2, nombre: 'Café Central', descripcion: 'Bono de desayuno o almuerzo.', precio_publico: 25000, precio_beet: 19000, fecha_inicio: dateOnly(-60), fecha_fin: null, estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 7, cooperativa_id: 2, nombre: 'Teatro Nacional', descripcion: 'Boleta general.', precio_publico: 40000, precio_beet: 30000, fecha_inicio: dateOnly(-10), fecha_fin: dateOnly(60), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  // cooperativa 3 (Horizonte) deliberately has zero convenios — demoes an
  // inactive/empty cooperativa in the switcher.
];

// ---------------------------------------------------------------------------
// Inventario (unidades) — generado por convenio con una mezcla de estados
// ---------------------------------------------------------------------------

const ESTADOS_UNIDAD_MUESTRA = ['disponible', 'disponible', 'disponible', 'entregada', 'entregada', 'redimida', 'vencida', 'bloqueada', 'cancelada'];

export const unidadesInventario = [];
function sembrarInventario(convenioId, prefijo, cantidad) {
  for (let i = 0; i < cantidad; i++) {
    unidadesInventario.push({
      id: newId('unidad'),
      convenio_id: convenioId,
      codigo: `${prefijo}-${String(i + 1).padStart(6, '0')}`,
      estado: ESTADOS_UNIDAD_MUESTRA[i % ESTADOS_UNIDAD_MUESTRA.length],
      fecha_ingreso: dateOnly(-60 + i),
    });
  }
}
sembrarInventario(1, 'CIN', 18);
sembrarInventario(2, 'AVE', 14);
sembrarInventario(3, 'EXI', 16);
sembrarInventario(4, 'SAL', 12);
sembrarInventario(5, 'SPA', 6);
sembrarInventario(6, 'CAF', 10);
sembrarInventario(7, 'TEA', 9);

// ---------------------------------------------------------------------------
// Cupos de crédito (uno por afiliado, opcional)
// ---------------------------------------------------------------------------

export const cupos = [
  { afiliado_id: 1, cupo_total: 500000, cupo_disponible: 320000, estado: true },
  { afiliado_id: 2, cupo_total: 800000, cupo_disponible: 800000, estado: true },
  { afiliado_id: 3, cupo_total: 300000, cupo_disponible: 0, estado: false },
  // afiliado 4 (retirado) y los de cooperativa 2 (5,6) sin cupo asignado — estado real, no un error.
];

// ---------------------------------------------------------------------------
// Transacciones + tickets + documentos de asunción de deuda
// ---------------------------------------------------------------------------

export const transacciones = [
  {
    id: 1, afiliado_id: 1, convenio_id: 1, cantidad: 2, subtotal: 25000, total: 25000,
    metodo_pago: 'TARJETA', numero_cuotas: null, estado: 'COMPLETADA', codigos: ['CIN-000001', 'CIN-000002'],
    created_at: todayISO(-6), referencia_pago: 'AUTH-58231', motivo_rechazo: null, resultado_pago: 'aprobado',
  },
  {
    id: 2, afiliado_id: 1, convenio_id: 3, cantidad: 1, subtotal: 46000, total: 46000,
    metodo_pago: 'CUPO', numero_cuotas: 3, estado: 'COMPLETADA', codigos: ['EXI-000001'],
    created_at: todayISO(-3), referencia_pago: null, motivo_rechazo: null, resultado_pago: 'aprobado',
  },
  {
    id: 3, afiliado_id: 2, convenio_id: 2, cantidad: 1, subtotal: 48000, total: 48000,
    metodo_pago: 'TARJETA', numero_cuotas: null, estado: 'RECHAZADA', codigos: [],
    created_at: todayISO(-2), referencia_pago: null, motivo_rechazo: 'Fondos insuficientes.', resultado_pago: 'rechazado_fondos',
  },
  {
    id: 4, afiliado_id: 5, convenio_id: 6, cantidad: 3, subtotal: 57000, total: 57000,
    metodo_pago: 'TARJETA', numero_cuotas: null, estado: 'COMPLETADA', codigos: ['CAF-000001', 'CAF-000002', 'CAF-000003'],
    created_at: todayISO(-8), referencia_pago: 'AUTH-90112', motivo_rechazo: null, resultado_pago: 'aprobado',
  },
];

export const tickets = [
  { id: 1, afiliado_id: 1, convenio_id: 1, codigo: 'CIN-000001', estado: 'entregada' },
  { id: 2, afiliado_id: 1, convenio_id: 1, codigo: 'CIN-000002', estado: 'redimida' },
  { id: 3, afiliado_id: 1, convenio_id: 3, codigo: 'EXI-000001', estado: 'entregada' },
  { id: 4, afiliado_id: 5, convenio_id: 6, codigo: 'CAF-000001', estado: 'entregada' },
  { id: 5, afiliado_id: 5, convenio_id: 6, codigo: 'CAF-000002', estado: 'entregada' },
  { id: 6, afiliado_id: 5, convenio_id: 6, codigo: 'CAF-000003', estado: 'vencida' },
];

export const documentos = [
  {
    id: 1, afiliado_id: 1, convenio_id: 3, transaccion_id: 2, convenio_nombre: 'Éxito',
    valor: 46000, numero_cuotas: 3, fecha_generacion: todayISO(-3), fecha_firma: todayISO(-3), estado: 'FIRMADO',
  },
];

// ---------------------------------------------------------------------------
// Plantillas (catálogo fijo + personalizadas creadas por convenio)
// ---------------------------------------------------------------------------

export const catalogoPlantillas = [
  { clave: 'clasico', nombre: 'Clásico' },
  { clave: 'moderno', nombre: 'Moderno' },
  { clave: 'minimal', nombre: 'Minimal' },
  { clave: 'elegante', nombre: 'Elegante' },
];

export const plantillasPersonalizadas = [
  { id: 1, convenio_id: 3, nombre: 'Diseño oficial', version: 2, en_uso: true, html: '<html><body><h1>{{ convenio.nombre }}</h1></body></html>' },
];

// ---------------------------------------------------------------------------
// Logs de auditoría (actividad reciente)
// ---------------------------------------------------------------------------

const ACCIONES_MUESTRA = [
  { accion: 'compra_completada', tabla_afectada: 'transacciones', registro_id: 2 },
  { accion: 'cupo_actualizado', tabla_afectada: 'cupos_credito', registro_id: 1 },
  { accion: 'afiliado_creado', tabla_afectada: 'afiliados', registro_id: 3 },
  { accion: 'convenio_actualizado', tabla_afectada: 'convenios', registro_id: 4 },
  { accion: 'inventario_carga_masiva', tabla_afectada: 'unidades_inventario', registro_id: null },
  { accion: 'plantilla_actualizada', tabla_afectada: 'plantillas', registro_id: 1 },
  { accion: 'usuario_admin_actualizado', tabla_afectada: 'usuarios_admin', registro_id: 3 },
];

export const logsAuditoria = ACCIONES_MUESTRA.map((a, i) => ({
  id: newId('log'),
  cooperativa_id: 1,
  accion: a.accion,
  tabla_afectada: a.tabla_afectada,
  registro_id: a.registro_id,
  created_at: todayISO(-i),
}));

// ---------------------------------------------------------------------------
// Helpers de consulta compartidos por el router de apiClient.js
// ---------------------------------------------------------------------------

export function cooperativaNombre(id) {
  return cooperativas.find((c) => c.id === id)?.nombre ?? null;
}

export function convenioPublico(c) {
  // Shape sent to the afiliado-facing catalog — never leaks cooperativa_id.
  const { cooperativa_id, ...rest } = c;
  void cooperativa_id;
  return rest;
}

export function resumenInventarioDe(convenioId) {
  const rows = unidadesInventario.filter((u) => u.convenio_id === Number(convenioId));
  const contar = (estado) => rows.filter((u) => u.estado === estado).length;
  return {
    disponible: contar('disponible'),
    bloqueada: contar('bloqueada'),
    entregada: contar('entregada'),
    redimida: contar('redimida'),
    vencida: contar('vencida'),
    cancelada: contar('cancelada'),
    total: rows.length,
  };
}

export function cupoDe(afiliadoId) {
  return cupos.find((c) => c.afiliado_id === Number(afiliadoId)) ?? null;
}

export function afiliadoConCupo(a) {
  const cupo = cupoDe(a.id);
  return { ...a, cupo_total: cupo?.cupo_total ?? null, cupo_disponible: cupo?.cupo_disponible ?? null };
}

export { newId, todayISO, dateOnly };
