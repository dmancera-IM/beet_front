// Capa de datos 100% ficticia para la sección GES (catálogo maestro de
// convenios, Storage central y cooperativas). A diferencia del resto del
// proyecto, GES todavía no tiene backend — por eso vive aislada aquí en
// lugar de en src/services (que sí llaman a la API real vía apiClient) y no
// debe importarse desde fuera de pages/admin/ges, salvo lectura del
// catálogo maestro de convenios (PROVEEDORES) desde el panel de una
// cooperativa, que es el flujo que la propia definición funcional pide:
// GES crea el convenio → catálogo maestro → la cooperativa lo selecciona.
// El "estado" se guarda en memoria (arrays con let/const mutados in-place)
// para que crear/asignar/solicitar tenga efecto visual durante la sesión;
// se reinicia al recargar la página.

// Catálogo maestro de convenios administrado por GES. Cualquier página que
// necesite la lista siempre actualizada debe llamar a getProveedores() (o
// iterar este mismo array, que se muta in-place con push, nunca se
// reasigna) en vez de guardar una copia en el momento del import.
export const PROVEEDORES = [
  { id: 'cine-colombia', nombre: 'Cine Colombia', estado: true },
  { id: 'mundo-aventura', nombre: 'Mundo Aventura', estado: true },
  { id: 'exito', nombre: 'Éxito', estado: true },
  { id: 'salitre-magico', nombre: 'Salitre Mágico', estado: false },
];

export function getProveedores() {
  return PROVEEDORES;
}

const slugify = (nombre) =>
  nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Agrega un convenio nuevo al catálogo maestro de GES. Todavía no se
// definen contratos, precios ni condiciones — solo el nombre, que es lo
// único que la definición funcional pide en esta fase.
export function agregarConvenioCatalogo(nombre) {
  const limpio = nombre.trim();
  if (!limpio) throw new Error('El nombre del convenio es obligatorio.');
  let id = slugify(limpio) || `convenio-${Date.now()}`;
  if (PROVEEDORES.some((p) => p.id === id)) id = `${id}-${Date.now()}`;
  const nuevo = { id, nombre: limpio, estado: true };
  PROVEEDORES.push(nuevo);
  return nuevo;
}

// Activa/desactiva un convenio en el catálogo MAESTRO de GES — independiente
// del switch que cada cooperativa tiene sobre su propia copia del convenio
// (services/mockDb.js `convenios[].estado`, ver ConveniosList.jsx del
// administrador). Uno controla si el convenio existe para todo BEET; el
// otro si esa cooperativa en particular se lo muestra a sus afiliados.
export function toggleConvenioCatalogo(id) {
  const p = PROVEEDORES.find((x) => x.id === id);
  if (!p) return;
  p.estado = !p.estado;
}

// Inventario que GES recibió de sus proveedores y todavía no ha asignado a
// ninguna cooperativa. Lo "asignado" y el "total" se derivan de
// `asignaciones` más abajo, para que nunca queden desincronizados.
const inventarioCentralBase = [
  { proveedorId: 'cine-colombia', disponible: 4000 },
  { proveedorId: 'mundo-aventura', disponible: 2500 },
  { proveedorId: 'exito', disponible: 1800 },
  { proveedorId: 'salitre-magico', disponible: 900 },
];

// Dinero mock que GES tiene disponible para comprarle bonos/boletas a sus
// proveedores. Puramente informativo — no hay pagos, pasarela ni reglas de
// crédito/bolsa reales todavía (ver ComprarBonos.jsx).
let dineroDisponibleParaCompras = 50_000_000;

export function getDineroDisponibleParaCompras() {
  return dineroDisponibleParaCompras;
}

// Mismas 3 cooperativas que services/mockDb.js (id/nombre coinciden a
// propósito), para que la vista de GES y el panel de cada cooperativa
// hablen de las mismas entidades — GES sigue siendo un mock 100% aislado,
// esto es solo coincidencia de nombres/ids para que la demo sea coherente.
// `cupoDisponible`/`cupoGastado` son el cupo contratado por la cooperativa
// con GES — mock puro, sin reglas financieras reales todavía.
let cooperativas = [
  { id: 1, nombre: 'Cooperativa Bienestar', estado: 'Activa', fechaCreacion: '2022-03-14', afiliados: 4, cupoDisponible: 15_000_000, cupoGastado: 5_000_000 },
  { id: 2, nombre: 'Cooperativa Unión', estado: 'Activa', fechaCreacion: '2023-01-10', afiliados: 2, cupoDisponible: 8_000_000, cupoGastado: 2_000_000 },
  { id: 3, nombre: 'Cooperativa Horizonte', estado: 'Inactiva', fechaCreacion: '2024-02-01', afiliados: 0, cupoDisponible: 0, cupoGastado: 0 },
];

// Una fila por combinación (cooperativa, proveedor): cuánto Storage le ha
// asignado GES a esa cooperativa hasta ahora (`cantidad`) y cuánto de eso
// ya vendió la cooperativa a sus afiliados (`vendidas`) — la diferencia es
// lo que la cooperativa todavía tiene disponible. Mock puro.
let asignaciones = [
  { cooperativaId: 1, proveedorId: 'cine-colombia', cantidad: 1000, vendidas: 300, fecha: '2026-08-01' },
  { cooperativaId: 1, proveedorId: 'mundo-aventura', cantidad: 300, vendidas: 100, fecha: '2026-07-12' },
  { cooperativaId: 1, proveedorId: 'exito', cantidad: 600, vendidas: 150, fecha: '2026-06-20' },
  { cooperativaId: 1, proveedorId: 'salitre-magico', cantidad: 50, vendidas: 20, fecha: '2026-05-02' },
  { cooperativaId: 2, proveedorId: 'mundo-aventura', cantidad: 200, vendidas: 80, fecha: '2026-08-15' },
  { cooperativaId: 2, proveedorId: 'exito', cantidad: 50, vendidas: 20, fecha: '2026-07-30' },
  { cooperativaId: 2, proveedorId: 'cine-colombia', cantidad: 400, vendidas: 150, fecha: '2026-08-20' },
  // cooperativa 3 (Horizonte) deliberadamente sin nada asignado — cooperativa
  // inactiva y vacía, igual que en services/mockDb.js.
];

// Transacciones GES ↔ cooperativa: quién las hizo (administrador), con qué
// forma de pago y en qué estado. `formaPago` y `estado` son puramente de
// demostración (Cupo/Crédito, Pendiente/Completada) — no hay reglas
// financieras ni de aprobación manual todavía. Solo existen estos dos
// estados: "Pendiente" (la operación todavía no puede completarse, ej. no
// hay inventario suficiente) y "Completada" (ya se realizó y el inventario
// correspondiente fue asignado/vendido).
let solicitudes = [
  { id: 'sol-1', cooperativaId: 1, proveedorId: 'cine-colombia', cantidad: 1000, estado: 'Completada', fecha: '2026-09-10', administrador: 'Carlos Gómez', formaPago: 'Cupo' },
  { id: 'sol-2', cooperativaId: 2, proveedorId: 'mundo-aventura', cantidad: 200, estado: 'Completada', fecha: '2026-08-15', administrador: 'Andrés Ruiz', formaPago: 'Crédito' },
  { id: 'sol-3', cooperativaId: 1, proveedorId: 'exito', cantidad: 200, estado: 'Pendiente', fecha: '2026-09-08', administrador: 'Carlos Gómez', formaPago: 'Cupo' },
  { id: 'sol-4', cooperativaId: 1, proveedorId: 'salitre-magico', cantidad: 150, estado: 'Pendiente', fecha: '2026-08-28', administrador: 'Carlos Gómez', formaPago: 'Crédito' },
  { id: 'sol-5', cooperativaId: 2, proveedorId: 'cine-colombia', cantidad: 300, estado: 'Completada', fecha: '2026-09-01', administrador: 'Andrés Ruiz', formaPago: 'Cupo' },
  { id: 'sol-6', cooperativaId: 2, proveedorId: 'exito', cantidad: 50, estado: 'Completada', fecha: '2026-07-30', administrador: 'Andrés Ruiz', formaPago: 'Crédito' },
];

// Usuarios administradores que GES creó directamente para una cooperativa
// (sección 8 de la definición funcional). Vive aislado de
// services/mockDb.js igual que el resto de GES — no habilita un login real
// todavía, es un registro mock de "quién pidió GES que se creara".
let usuariosGes = [];

const nombreProveedor = (id) => PROVEEDORES.find((p) => p.id === id)?.nombre ?? id;
const nombreCooperativa = (id) => cooperativas.find((c) => c.id === id)?.nombre ?? id;
const hoyISO = () => new Date().toISOString().slice(0, 10);

export function getInventarioCentral() {
  return PROVEEDORES.map((p) => {
    const base = inventarioCentralBase.find((i) => i.proveedorId === p.id);
    const disponible = base?.disponible ?? 0;
    const asignado = asignaciones
      .filter((a) => a.proveedorId === p.id)
      .reduce((sum, a) => sum + a.cantidad, 0);
    return { proveedorId: p.id, proveedor: p.nombre, estado: p.estado, disponible, asignado, total: disponible + asignado };
  });
}

// Suma al Storage central lo que GES recibió de un proveedor. Si el
// convenio todavía no tenía fila en el Storage (ej. uno recién agregado al
// catálogo maestro), la crea. Simulación visual — sin compras ni pagos
// reales todavía.
export function agregarStorage({ proveedorId, cantidad }) {
  const n = Number(cantidad);
  if (!n || n <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  if (!proveedorId) throw new Error('Selecciona un convenio.');
  const fila = inventarioCentralBase.find((i) => i.proveedorId === proveedorId);
  if (fila) {
    fila.disponible += n;
  } else {
    inventarioCentralBase.push({ proveedorId, disponible: n });
  }
  return getInventarioCentral().find((i) => i.proveedorId === proveedorId);
}

export function getAsignacionesPorProveedor(proveedorId) {
  return asignaciones
    .filter((a) => a.proveedorId === proveedorId && a.cantidad > 0)
    .map((a) => ({ ...a, cooperativaNombre: nombreCooperativa(a.cooperativaId) }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export function getCooperativas() {
  return cooperativas.map((c) => {
    const asigCoop = asignaciones.filter((a) => a.cooperativaId === c.id && a.cantidad > 0);
    const inventarioAsignado = asigCoop.reduce((sum, a) => sum + a.cantidad, 0);
    const solicitudesPendientes = solicitudes.filter((s) => s.cooperativaId === c.id && s.estado === 'Pendiente').length;
    return { ...c, conveniosActivos: asigCoop.length, inventarioAsignado, solicitudesPendientes };
  });
}

export function getCooperativa(id) {
  // eslint-disable-next-line eqeqeq
  return getCooperativas().find((c) => c.id == id) ?? null;
}

// Crea una cooperativa desde GES (sección 7). Vive únicamente en el mock de
// GES — no toca services/mockDb.js, así que no aparece en el panel de
// Súper admin (esa pantalla queda intacta, sección 23). El cupo es
// opcional: una cooperativa se puede crear sin cupo contratado todavía.
export function crearCooperativaGes({ nombre, cupo }) {
  const limpio = nombre.trim();
  if (!limpio) throw new Error('El nombre de la cooperativa es obligatorio.');
  const nuevaId = cooperativas.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  const nueva = {
    id: nuevaId,
    nombre: limpio,
    estado: 'Activa',
    fechaCreacion: hoyISO(),
    afiliados: 0,
    cupoDisponible: Number(cupo) > 0 ? Number(cupo) : 0,
    cupoGastado: 0,
  };
  cooperativas.push(nueva);
  return nueva;
}

// Registra (solo del lado de GES, ver nota de crearCooperativaGes) un
// usuario administrador para una cooperativa existente. Rol siempre ADMIN
// — GES no crea súper administradores ni lectores desde aquí.
export function crearUsuarioAdminGes({ nombre, correo, cooperativaId }) {
  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim();
  if (!nombreLimpio) throw new Error('El nombre es obligatorio.');
  if (!correoLimpio) throw new Error('El correo es obligatorio.');
  if (!cooperativaId) throw new Error('Selecciona la cooperativa de este usuario.');
  const usuario = {
    id: `ges-user-${Date.now()}`,
    nombre: nombreLimpio,
    correo: correoLimpio,
    cooperativaId,
    cooperativaNombre: nombreCooperativa(cooperativaId),
    rol: 'ADMIN',
  };
  usuariosGes.push(usuario);
  return usuario;
}

export function getUsuariosGes() {
  return usuariosGes;
}

export function getAsignacionesPorCooperativa(cooperativaId) {
  return asignaciones
    // eslint-disable-next-line eqeqeq
    .filter((a) => a.cooperativaId == cooperativaId && a.cantidad > 0)
    .map((a) => ({
      ...a,
      proveedorNombre: nombreProveedor(a.proveedorId),
      vendidas: a.vendidas ?? 0,
      disponibles: a.cantidad - (a.vendidas ?? 0),
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export function getSolicitudes() {
  return solicitudes
    .map((s) => ({ ...s, cooperativaNombre: nombreCooperativa(s.cooperativaId), proveedorNombre: nombreProveedor(s.proveedorId) }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export function getSolicitudesPorCooperativa(cooperativaId) {
  // eslint-disable-next-line eqeqeq
  return getSolicitudes().filter((s) => s.cooperativaId == cooperativaId);
}

export function getActividadPorCooperativa(cooperativaId) {
  const eventos = [];
  asignaciones
    // eslint-disable-next-line eqeqeq
    .filter((a) => a.cooperativaId == cooperativaId && a.cantidad > 0)
    .forEach((a) => {
      eventos.push({
        id: `asg-${a.proveedorId}`,
        fecha: a.fecha,
        texto: `Inventario asignado · ${nombreProveedor(a.proveedorId)}`,
        detalle: `${a.cantidad.toLocaleString('es-CO')} unidades`,
      });
    });
  solicitudes
    // eslint-disable-next-line eqeqeq
    .filter((s) => s.cooperativaId == cooperativaId)
    .forEach((s) => {
      eventos.push({
        id: `sol-${s.id}`,
        fecha: s.fecha,
        texto: `Transacción · ${nombreProveedor(s.proveedorId)}`,
        detalle: `${s.cantidad.toLocaleString('es-CO')} unidades · ${s.estado}`,
      });
    });
  return eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

function registrarAsignacion(cooperativaId, proveedorId, cantidad) {
  const existente = asignaciones.find((a) => a.cooperativaId === cooperativaId && a.proveedorId === proveedorId);
  if (existente) {
    existente.cantidad += cantidad;
    existente.fecha = hoyISO();
  } else {
    asignaciones.push({ cooperativaId, proveedorId, cantidad, vendidas: 0, fecha: hoyISO() });
  }
}

// Simulación visual únicamente: valida cantidad > 0 y cantidad <= disponible
// en GES, descuenta del Storage central y suma a lo asignado de la
// cooperativa. La lógica definitiva se implementará en Python/FastAPI.
export function asignarInventario({ cooperativaId, proveedorId, cantidad }) {
  const n = Number(cantidad);
  if (!n || n <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  const inv = inventarioCentralBase.find((i) => i.proveedorId === proveedorId);
  if (!inv || n > inv.disponible) throw new Error('La cantidad supera el inventario disponible en GES.');
  inv.disponible -= n;
  registrarAsignacion(cooperativaId, proveedorId, n);
}

// Usada por el formulario "Comprar bonos / boletas a GES" del panel del
// administrador de cooperativa (pages/admin/ComprarBonosGes.jsx) — crea la
// transacción del lado de GES. El estado inicial solo representa
// visualmente si el Storage de GES ya tiene inventario suficiente para esa
// cantidad ("Completada": se asigna de inmediato) o no ("Pendiente") — no
// hay lógica de aprobación/backend real todavía (ver sección 10).
export function crearSolicitudDesdeCooperativa({ cooperativaId, proveedorId, cantidad, administrador, formaPago }) {
  const n = Number(cantidad);
  if (!n || n <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  if (!proveedorId) throw new Error('Selecciona un convenio.');
  const inv = inventarioCentralBase.find((i) => i.proveedorId === proveedorId);
  const estado = inv && inv.disponible >= n ? 'Completada' : 'Pendiente';
  const solicitud = {
    id: `sol-${Date.now()}`,
    cooperativaId,
    proveedorId,
    cantidad: n,
    estado,
    fecha: hoyISO(),
    administrador: administrador || 'Administrador',
    formaPago: formaPago || 'Cupo',
  };
  solicitudes.push(solicitud);
  return solicitud;
}
