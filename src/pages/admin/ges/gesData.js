// Capa de datos 100% ficticia para la sección GES (catálogo maestro de
// convenios, productos_convenio, Storage central y cooperativas). A
// diferencia del resto del proyecto, GES todavía no tiene backend — por eso
// vive aislada aquí en lugar de en src/services (que sí llaman a la API
// real vía apiClient) y no debe importarse desde fuera de pages/admin/ges,
// salvo lectura del catálogo maestro (PROVEEDORES/PRODUCTOS) desde el panel
// de una cooperativa, que es el flujo que la propia definición funcional
// pide: GES crea el convenio y sus productos → catálogo maestro → la
// cooperativa los selecciona (secciones 6-11 de FRONTEND_DB_ALIGNMENT.md).
// El "estado" se guarda en memoria (arrays con let/const mutados in-place)
// para que crear/asignar/solicitar tenga efecto visual durante la sesión;
// se reinicia al recargar la página.

// Catálogo maestro de convenios administrado por GES (tabla `convenios`).
// Cualquier página que necesite la lista siempre actualizada debe llamar a
// getProveedores() (o iterar este mismo array, que se muta in-place con
// push, nunca se reasigna) en vez de guardar una copia en el momento del
// import.
// `imagen` (identidad visual) y `plantillaPdf` (diseño del PDF) pertenecen
// AL CONVENIO, nunca a un producto suyo — ver GES → Configuración
// (Configuracion.jsx). Los productos de un mismo convenio (ej. Cine
// Colombia → Entrada 2D/3D) comparten siempre la misma imagen y la misma
// plantilla; jamás se configura una por producto. `imagen`: data URL o
// `null` (sin configurar → placeholder de líneas cruzadas). `plantillaPdf`:
// `{ nombre, estado }` o `null` (sin configurar todavía).
export const PROVEEDORES = [
  { id: 'cine-colombia', nombre: 'Cine Colombia', estado: true, imagen: null, plantillaPdf: { nombre: 'Plantilla Cine Colombia.pdf', estado: 'ACTIVA' } },
  { id: 'mundo-aventura', nombre: 'Mundo Aventura', estado: true, imagen: null, plantillaPdf: null },
  { id: 'exito', nombre: 'Éxito', estado: true, imagen: null, plantillaPdf: { nombre: 'Plantilla Exito.pdf', estado: 'ACTIVA' } },
  { id: 'salitre-magico', nombre: 'Salitre Mágico', estado: false, imagen: null, plantillaPdf: null },
  { id: 'cafe-central', nombre: 'Café Central', estado: true, imagen: null, plantillaPdf: null },
  { id: 'teatro-nacional', nombre: 'Teatro Nacional', estado: true, imagen: null, plantillaPdf: null },
  { id: 'spa-relax', nombre: 'Spa Relax', estado: true, imagen: null, plantillaPdf: null },
];

export function getProveedores() {
  return PROVEEDORES;
}

// productos_convenio: el producto específico que se puede almacenar,
// comprar y entregar (sección 7). Un producto pertenece a UN convenio; un
// convenio puede tener varios productos (ej. Cine Colombia → Entrada 2D /
// Entrada 3D). `productoId` es único en todo el catálogo.
// `precioVentaEntidad`: lo que GES le cobra a las entidades por este
// producto (sección 5 de "Ganancia por convenio y precios por producto") —
// se configura producto por producto, NUNCA un único precio por convenio
// (cada producto de un mismo convenio puede costarle distinto a GES). Es la
// base del cálculo del precio para el afiliado en el panel de cada entidad
// (ver services/mockDb.js `precioBeetDe`): precio_afiliado = precioVentaEntidad
// × (1 + porcentaje_ganancia_entidad / 100). `null` = todavía sin configurar
// por GES (el producto 9, Bono Pan, se deja así a propósito para poder
// demostrar ese estado).
let nextProductoId = 100;
export const PRODUCTOS = [
  { id: 1, proveedorId: 'cine-colombia', nombre: 'Entrada 2D', estado: true, precioVentaEntidad: 4000 },
  { id: 8, proveedorId: 'cine-colombia', nombre: 'Entrada 3D', estado: true, precioVentaEntidad: 5000 },
  { id: 2, proveedorId: 'mundo-aventura', nombre: 'Entrada General', estado: true, precioVentaEntidad: 44000 },
  { id: 3, proveedorId: 'exito', nombre: 'Bono Mercado', estado: true, precioVentaEntidad: 44000 },
  { id: 9, proveedorId: 'exito', nombre: 'Bono Pan', estado: true, precioVentaEntidad: null },
  { id: 4, proveedorId: 'salitre-magico', nombre: 'Entrada General', estado: true, precioVentaEntidad: 34000 },
  { id: 5, proveedorId: 'spa-relax', nombre: 'Sesión de Bienestar', estado: true, precioVentaEntidad: 64000 },
  { id: 6, proveedorId: 'cafe-central', nombre: 'Bono Desayuno', estado: true, precioVentaEntidad: 17000 },
  { id: 7, proveedorId: 'teatro-nacional', nombre: 'Boleta General', estado: true, precioVentaEntidad: 29000 },
];

// Configura (o corrige) el precio al que GES le vende este producto a las
// entidades. Producto por producto, nunca a nivel de convenio — dos
// productos del mismo convenio pueden costarle distinto a GES (sección 5).
export function setPrecioVentaEntidad(productoId, precio) {
  const p = getProducto(productoId);
  if (!p) throw new Error('Producto no encontrado.');
  const n = Number(precio);
  if (!n || n <= 0) throw new Error('El precio de venta a entidades debe ser mayor a 0.');
  p.precioVentaEntidad = n;
  return p;
}

export function getProductos(proveedorId) {
  return PRODUCTOS.filter((p) => p.proveedorId === proveedorId);
}

export function getProducto(productoId) {
  // eslint-disable-next-line eqeqeq
  return PRODUCTOS.find((p) => p.id == productoId) ?? null;
}

// Agrega un producto nuevo a un convenio del catálogo maestro (sección 7 —
// "GES puede crear convenios/productos"). Todavía no se definen precios ni
// condiciones acá: eso lo configura cada cooperativa por su lado
// (cooperativas_convenios).
// El producto nace INACTIVO: hasta que no se configure correctamente su
// precio (ver setPrecioVentaEntidad y, del lado de la entidad,
// services/mockDb.js `precioBeetDe`) no debe quedar disponible — no se
// activa automáticamente al crearlo.
export function agregarProducto({ proveedorId, nombre }) {
  const limpio = (nombre || '').trim();
  if (!limpio) throw new Error('El nombre del producto es obligatorio.');
  if (!proveedorId) throw new Error('Selecciona un convenio.');
  const nuevo = { id: nextProductoId++, proveedorId, nombre: limpio, estado: false, precioVentaEntidad: null };
  PRODUCTOS.push(nuevo);
  return nuevo;
}

export function toggleProducto(productoId) {
  const p = getProducto(productoId);
  if (!p) return;
  p.estado = !p.estado;
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
  const nuevo = { id, nombre: limpio, estado: true, imagen: null, plantillaPdf: null };
  PROVEEDORES.push(nuevo);
  return nuevo;
}

// Imagen de identidad visual del CONVENIO (sección "Imagen del beneficio")
// — nunca por producto. Se usará para las tarjetas/beneficios que ve el
// afiliado; si es `null`, esas tarjetas muestran el placeholder de líneas
// cruzadas que ya existía.
export function setImagenConvenio(proveedorId, dataUrl) {
  const p = PROVEEDORES.find((x) => x.id === proveedorId);
  if (!p) throw new Error('Convenio no encontrado.');
  p.imagen = dataUrl;
  return p;
}

// Plantilla PDF del CONVENIO (sección "Plantilla PDF") — UNA sola por
// convenio, nunca una por producto: todos los productos de este convenio
// (Boleta 2D, Boleta 3D, Combo, etc.) la comparten al generar su PDF.
export function setPlantillaConvenio(proveedorId, { nombre, blobUrl }) {
  const p = PROVEEDORES.find((x) => x.id === proveedorId);
  if (!p) throw new Error('Convenio no encontrado.');
  p.plantillaPdf = { nombre, estado: 'ACTIVA', blobUrl: blobUrl ?? null };
  return p;
}

// Forma que consume GES → Configuración (Configuracion.jsx): un convenio
// con su imagen, su única plantilla PDF, y la lista de productos que le
// pertenecen (solo id/nombre — los productos no tienen imagen ni plantilla
// propias, ver notas junto a PROVEEDORES arriba).
export function getConveniosConProductos() {
  return PROVEEDORES.map((p) => ({
    idConvenio: p.id,
    nombre: p.nombre,
    estado: p.estado,
    imagen: p.imagen,
    plantillaPdf: p.plantillaPdf,
    productos: getProductos(p.id).map((prod) => ({ id: prod.id, nombre: prod.nombre })),
  }));
}

// Activa/desactiva un convenio en el catálogo MAESTRO de GES — independiente
// del switch que cada cooperativa tiene sobre su propia copia del convenio
// (services/mockDb.js `cooperativasConvenios[].estado`, ver ConveniosList.jsx
// del administrador). Uno controla si el convenio existe para todo BEET; el
// otro si esa cooperativa en particular se lo muestra a sus afiliados.
export function toggleConvenioCatalogo(id) {
  const p = PROVEEDORES.find((x) => x.id === id);
  if (!p) return;
  p.estado = !p.estado;
}

// ---------------------------------------------------------------------------
// Storage central — códigos individuales que GES recibió de sus
// proveedores y todavía no ha asignado a ninguna cooperativa (sección 8).
// Cada fila es una unidad/código real, nunca solo un número agregado; las
// vistas de resumen (getInventarioCentral) se calculan contando estas filas.
// ---------------------------------------------------------------------------

let nextStorageId = 1;
export const STORAGE = [];
function sembrarStorage(productoId, prefijo, cantidadDisponible, cantidadAsignada) {
  for (let i = 0; i < cantidadDisponible; i++) {
    STORAGE.push({ id: nextStorageId++, productoId, codigo: `${prefijo}-S${String(i + 1).padStart(5, '0')}`, estado: 'DISPONIBLE', fechaVencimiento: null });
  }
  for (let i = 0; i < cantidadAsignada; i++) {
    STORAGE.push({ id: nextStorageId++, productoId, codigo: `${prefijo}-A${String(i + 1).padStart(5, '0')}`, estado: 'ASIGNADO', fechaVencimiento: null });
  }
}
sembrarStorage(1, 'CIN2D', 3000, 1000); // Cine Colombia · Entrada 2D
sembrarStorage(8, 'CIN3D', 1000, 400); // Cine Colombia · Entrada 3D
sembrarStorage(2, 'AVE', 2200, 300); // Mundo Aventura · Entrada General
sembrarStorage(3, 'EXIM', 1500, 550); // Éxito · Bono Mercado
sembrarStorage(9, 'EXIP', 300, 100); // Éxito · Bono Pan
sembrarStorage(4, 'SAL', 800, 100); // Salitre Mágico · Entrada General
sembrarStorage(6, 'CAF', 250, 150); // Café Central · Bono Desayuno
sembrarStorage(7, 'TEA', 200, 50); // Teatro Nacional · Boleta General
// spa-relax (producto 5) deliberadamente sin Storage todavía.

// Mismas 3 cooperativas que services/mockDb.js (id/nombre coinciden a
// propósito), para que la vista de GES y el panel de cada cooperativa
// hablen de las mismas entidades — GES sigue siendo un mock 100% aislado,
// esto es solo coincidencia de nombres/ids para que la demo sea coherente.
//
// Bolsa y Crédito son dos conceptos independientes, NUNCA mezclados
// (ronda "Corrección visual de Bolsa/Crédito"). Cada uno guarda solo sus
// dos valores base; el "disponible" de cada uno SIEMPRE se calcula con
// `bolsaDisponible()`/`creditoDisponible()` (más abajo) — nunca se
// duplica un tercer campo que pueda desincronizarse:
//   `bolsa.valor`: monto de bolsa comprado/configurado para esta
//     cooperativa. `bolsa.consumido`: cuánto de esa bolsa ya se gastó.
//   `credito.cupoAutorizado`: el LÍMITE máximo que GES le autorizó a la
//     cooperativa (no un saldo ya usado). `credito.utilizado`: cuánto
//     crédito ya solicitó/usó la cooperativa dentro de ese límite.
// Mock puro, sin tasas, intereses, cuotas, mora ni plazos todavía.
let cooperativas = [
  { id: 1, nombre: 'Cooperativa Bienestar', estado: 'Activa', fechaCreacion: '2022-03-14', afiliados: 4, bolsa: { valor: 10_000_000, consumido: 3_000_000 }, credito: { cupoAutorizado: 10_000_000, utilizado: 4_000_000 } },
  { id: 2, nombre: 'Cooperativa Unión', estado: 'Activa', fechaCreacion: '2023-01-10', afiliados: 2, bolsa: { valor: 8_000_000, consumido: 2_000_000 }, credito: { cupoAutorizado: 8_000_000, utilizado: 2_000_000 } },
  { id: 3, nombre: 'Cooperativa Horizonte', estado: 'Inactiva', fechaCreacion: '2024-02-01', afiliados: 0, bolsa: { valor: 0, consumido: 0 }, credito: { cupoAutorizado: 0, utilizado: 0 } },
];

// Únicas funciones que calculan "disponible" para Bolsa y Crédito — todo
// el resto del código (GES y ADMIN) debe usar estas, nunca restar a mano,
// para que las dos modalidades no se desincronicen entre pantallas.
export function bolsaDisponible(bolsa) {
  return Math.max(0, (bolsa?.valor ?? 0) - (bolsa?.consumido ?? 0));
}
export function creditoDisponible(credito) {
  return Math.max(0, (credito?.cupoAutorizado ?? 0) - (credito?.utilizado ?? 0));
}

// Una fila por combinación (cooperativa, producto): cuánto Storage le ha
// asignado GES a esa cooperativa hasta ahora (`cantidad`) y cuánto de eso
// ya vendió la cooperativa a sus afiliados (`vendidas`) — la diferencia es
// lo que la cooperativa todavía tiene disponible. Mock puro (agregado; los
// códigos individuales ya asignados viven en STORAGE con estado ASIGNADO).
let asignaciones = [
  { cooperativaId: 1, productoId: 1, cantidad: 1000, vendidas: 300, fecha: '2026-08-01' },
  { cooperativaId: 1, productoId: 2, cantidad: 300, vendidas: 100, fecha: '2026-07-12' },
  { cooperativaId: 1, productoId: 3, cantidad: 600, vendidas: 150, fecha: '2026-06-20' },
  { cooperativaId: 1, productoId: 4, cantidad: 50, vendidas: 20, fecha: '2026-05-02' },
  { cooperativaId: 2, productoId: 2, cantidad: 200, vendidas: 80, fecha: '2026-08-15' },
  { cooperativaId: 2, productoId: 3, cantidad: 50, vendidas: 20, fecha: '2026-07-30' },
  { cooperativaId: 2, productoId: 1, cantidad: 400, vendidas: 150, fecha: '2026-08-20' },
  // cooperativa 3 (Horizonte) deliberadamente sin nada asignado — cooperativa
  // inactiva y vacía, igual que en services/mockDb.js.
];

// Transacciones GES ↔ cooperativa (tabla `transacciones`, sección 11):
// quién las hizo (usuario/administrador), con qué forma de pago y en qué
// estado. `formaPago` y `estado` son puramente de demostración (Cupo/
// Crédito, Pendiente/Completada) — no hay reglas financieras ni de
// aprobación manual todavía. Solo existen estos dos estados: "Pendiente"
// (la operación todavía no puede completarse, ej. no hay inventario
// suficiente) y "Completada" (ya se realizó y el inventario correspondiente
// fue asignado/vendido). Nunca "Aprobada"/"Rechazada"/"Disponible".
// `prioridad` ('Normal' | 'Alta'): las de prioridad Alta vienen del nuevo
// formulario B2B (sección 6/7 de la ronda de ajustes) — compra rápida de
// una entidad. No es un estado nuevo de la transacción (`estado` sigue
// siendo únicamente Pendiente/Completada); es solo una etiqueta adicional
// para poder listarlas por separado en GES → B2B.
let solicitudes = [
  { id: 'sol-1', cooperativaId: 1, productoId: 1, cantidad: 1000, estado: 'Completada', fecha: '2026-09-10', administrador: 'Carlos Gómez', formaPago: 'Cupo', prioridad: 'Normal' },
  { id: 'sol-2', cooperativaId: 2, productoId: 2, cantidad: 200, estado: 'Completada', fecha: '2026-08-15', administrador: 'Andrés Ruiz', formaPago: 'Crédito', prioridad: 'Normal' },
  { id: 'sol-3', cooperativaId: 1, productoId: 3, cantidad: 200, estado: 'Pendiente', fecha: '2026-09-08', administrador: 'Carlos Gómez', formaPago: 'Cupo', prioridad: 'Normal' },
  { id: 'sol-4', cooperativaId: 1, productoId: 4, cantidad: 150, estado: 'Pendiente', fecha: '2026-08-28', administrador: 'Carlos Gómez', formaPago: 'Crédito', prioridad: 'Normal' },
  { id: 'sol-5', cooperativaId: 2, productoId: 1, cantidad: 300, estado: 'Completada', fecha: '2026-09-01', administrador: 'Andrés Ruiz', formaPago: 'Cupo', prioridad: 'Normal' },
  { id: 'sol-6', cooperativaId: 2, productoId: 3, cantidad: 50, estado: 'Completada', fecha: '2026-07-30', administrador: 'Andrés Ruiz', formaPago: 'Crédito', prioridad: 'Normal' },
  { id: 'sol-7', cooperativaId: 1, productoId: 1, cantidad: 10, estado: 'Completada', fecha: '2026-09-15', administrador: 'Carlos Gómez', formaPago: 'Cupo', prioridad: 'Alta' },
];

// Usuarios administradores que GES creó directamente para una cooperativa
// (sección 8 de la definición funcional). Vive aislado de
// services/mockDb.js igual que el resto de GES — no habilita un login real
// todavía, es un registro mock de "quién pidió GES que se creara".
let usuariosGes = [];

const nombreProveedor = (id) => PROVEEDORES.find((p) => p.id === id)?.nombre ?? id;
const nombreProducto = (id) => getProducto(id)?.nombre ?? String(id);
const nombreCooperativa = (id) => cooperativas.find((c) => c.id === id)?.nombre ?? id;
const hoyISO = () => new Date().toISOString().slice(0, 10);

// Resumen de Storage: una fila POR PRODUCTO (nunca solo "Cine Colombia:
// 1000" — sección 8), contando los códigos individuales reales en STORAGE.
export function getInventarioCentral() {
  return PRODUCTOS.map((p) => {
    const disponible = STORAGE.filter((s) => s.productoId === p.id && s.estado === 'DISPONIBLE').length;
    const asignado = STORAGE.filter((s) => s.productoId === p.id && s.estado === 'ASIGNADO').length;
    return {
      proveedorId: p.proveedorId,
      proveedor: nombreProveedor(p.proveedorId),
      productoId: p.id,
      producto: p.nombre,
      estado: p.estado,
      disponible,
      asignado,
      total: disponible + asignado,
    };
  });
}

// Suma al Storage central lo que GES recibió de un proveedor para UN
// producto — genera `cantidad` códigos individuales nuevos en estado
// DISPONIBLE (simulación visual del XML del proveedor; el contenido del
// archivo no se procesa todavía).
export function agregarStorage({ productoId, cantidad, fechaVencimiento }) {
  const n = Number(cantidad);
  if (!n || n <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  const producto = getProducto(productoId);
  if (!producto) throw new Error('Selecciona un producto.');
  const prefijo = producto.nombre.slice(0, 3).toUpperCase();
  for (let i = 0; i < n; i++) {
    STORAGE.push({ id: nextStorageId++, productoId: producto.id, codigo: `${prefijo}-${Date.now()}-${i}`, estado: 'DISPONIBLE', fechaVencimiento: fechaVencimiento ?? null });
  }
  return getInventarioCentral().find((i) => i.productoId === producto.id);
}

export function getAsignacionesPorProveedor(proveedorId) {
  const productoIds = new Set(getProductos(proveedorId).map((p) => p.id));
  return asignaciones
    .filter((a) => productoIds.has(a.productoId) && a.cantidad > 0)
    .map((a) => ({ ...a, cooperativaNombre: nombreCooperativa(a.cooperativaId), productoNombre: nombreProducto(a.productoId) }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export function getAsignacionesPorProducto(productoId) {
  // eslint-disable-next-line eqeqeq
  return asignaciones
    .filter((a) => a.productoId == productoId && a.cantidad > 0)
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

// Crea una cooperativa desde GES. Vive únicamente en el mock de GES — no
// toca services/mockDb.js, así que no aparece en el panel de Súper admin
// (esa pantalla queda intacta). Bolsa y cupo de crédito son dos campos
// independientes y opcionales — nunca el antiguo "cupo contratado" único
// (ver sección "Aclaración importante sobre los dos campos"): una
// cooperativa puede crearse sin ninguno de los dos todavía.
export function crearCooperativaGes({ nombre, bolsa, cupoCredito }) {
  const limpio = nombre.trim();
  if (!limpio) throw new Error('El nombre de la entidad es obligatorio.');
  const nuevaId = cooperativas.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  const valorBolsa = Number(bolsa) > 0 ? Number(bolsa) : 0;
  const cupoAutorizado = Number(cupoCredito) > 0 ? Number(cupoCredito) : 0;
  const nueva = {
    id: nuevaId,
    nombre: limpio,
    estado: 'Activa',
    fechaCreacion: hoyISO(),
    afiliados: 0,
    bolsa: { valor: valorBolsa, consumido: 0 },
    credito: { cupoAutorizado, utilizado: 0 },
  };
  cooperativas.push(nueva);
  return nueva;
}

// Aumenta el cupo máximo de crédito autorizado por GES (sección "GES →
// Cupo de crédito"). Solo mueve `credito.cupoAutorizado` — nunca toca
// `credito.utilizado` ni la bolsa de la cooperativa.
export function aumentarCupoCreditoGes(cooperativaId, nuevoCupo) {
  const c = cooperativas.find((x) => x.id === Number(cooperativaId));
  if (!c) throw new Error('Entidad no encontrada.');
  const valor = Number(nuevoCupo);
  if (!(valor > 0)) throw new Error('El nuevo cupo debe ser mayor a 0.');
  c.credito.cupoAutorizado = valor;
  return c;
}

// Registra (solo del lado de GES, ver nota de crearCooperativaGes) un
// usuario administrador para una cooperativa existente. Rol siempre ADMIN
// — GES no crea súper administradores ni lectores desde aquí.
export function crearUsuarioAdminGes({ nombre, correo, cooperativaId }) {
  const nombreLimpio = nombre.trim();
  const correoLimpio = correo.trim();
  if (!nombreLimpio) throw new Error('El nombre es obligatorio.');
  if (!correoLimpio) throw new Error('El correo es obligatorio.');
  if (!cooperativaId) throw new Error('Selecciona la entidad de este usuario.');
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
    .map((a) => {
      const producto = getProducto(a.productoId);
      return {
        ...a,
        proveedorId: producto?.proveedorId ?? null,
        proveedorNombre: producto ? nombreProveedor(producto.proveedorId) : nombreProducto(a.productoId),
        productoNombre: nombreProducto(a.productoId),
        vendidas: a.vendidas ?? 0,
        disponibles: a.cantidad - (a.vendidas ?? 0),
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export function getSolicitudes() {
  return solicitudes
    .map((s) => {
      const producto = getProducto(s.productoId);
      return {
        ...s,
        cooperativaNombre: nombreCooperativa(s.cooperativaId),
        proveedorNombre: producto ? nombreProveedor(producto.proveedorId) : nombreProducto(s.productoId),
        productoNombre: nombreProducto(s.productoId),
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

// Dinero que GES ha ganado vendiéndole bonos/boletas a las entidades
// (precio de venta a entidades × cantidad, solo transacciones Completadas)
// — reemplaza al antiguo "dinero disponible para comprar al proveedor"
// (sección "Cambiar Comprar bonos y boletas"): GES no compra directamente
// al proveedor desde este flujo, así que este KPI representa ingresos por
// ventas, no un fondo de compra.
export function getDineroGanadoPorVentas() {
  return solicitudes
    .filter((s) => s.estado === 'Completada')
    .reduce((sum, s) => {
      const producto = getProducto(s.productoId);
      return sum + s.cantidad * (producto?.precioVentaEntidad ?? 0);
    }, 0);
}

export function getSolicitudesPorCooperativa(cooperativaId) {
  // eslint-disable-next-line eqeqeq
  return getSolicitudes().filter((s) => s.cooperativaId == cooperativaId);
}

// Solicitudes de prioridad Alta únicamente — GES → B2B (sección 6).
export function getSolicitudesB2B() {
  return getSolicitudes().filter((s) => s.prioridad === 'Alta');
}

// Descuenta del CUPO DE CRÉDITO que la entidad tiene con GES cuando una
// compra B2B se paga "con cupo" — mismo `credito.utilizado` que ya se
// muestra en Entidades/CooperativaDetail y en el panorama de Súper admin
// (su disponible se calcula con `creditoDisponible()`, nunca un saldo
// aparte). Nunca toca la bolsa (son dos conceptos independientes).
export function registrarConsumoCupo(cooperativaId, valor) {
  const c = cooperativas.find((x) => x.id === Number(cooperativaId));
  if (!c) return;
  c.credito.utilizado += valor;
}

// Descuenta de la BOLSA de la cooperativa cuando una compra (carrito de
// productos) se paga "con bolsa" — nunca toca el crédito (son dos
// conceptos independientes). `bolsa.valor` NUNCA cambia aquí, solo
// `bolsa.consumido`; el disponible se recalcula con `bolsaDisponible()`.
export function registrarConsumoBolsa(cooperativaId, valor) {
  const c = cooperativas.find((x) => x.id === Number(cooperativaId));
  if (!c) return;
  c.bolsa.consumido += valor;
}

export function getActividadPorCooperativa(cooperativaId) {
  const eventos = [];
  asignaciones
    // eslint-disable-next-line eqeqeq
    .filter((a) => a.cooperativaId == cooperativaId && a.cantidad > 0)
    .forEach((a) => {
      eventos.push({
        id: `asg-${a.productoId}`,
        fecha: a.fecha,
        texto: `Inventario asignado · ${nombreProducto(a.productoId)}`,
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
        texto: `Transacción · ${nombreProducto(s.productoId)}`,
        detalle: `${s.cantidad.toLocaleString('es-CO')} unidades · ${s.estado}`,
      });
    });
  return eventos.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

function registrarAsignacion(cooperativaId, productoId, cantidad) {
  const existente = asignaciones.find((a) => a.cooperativaId === cooperativaId && a.productoId === productoId);
  if (existente) {
    existente.cantidad += cantidad;
    existente.fecha = hoyISO();
  } else {
    asignaciones.push({ cooperativaId, productoId, cantidad, vendidas: 0, fecha: hoyISO() });
  }
}

// Simulación visual únicamente: valida cantidad > 0 y cantidad <= disponible
// en GES, marca esa cantidad de códigos DISPONIBLE de STORAGE como
// ASIGNADO y suma a lo asignado de la cooperativa. La lógica definitiva se
// implementará en Python/FastAPI.
export function asignarInventario({ cooperativaId, productoId, cantidad }) {
  const n = Number(cantidad);
  if (!n || n <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  const disponibles = STORAGE.filter((s) => s.productoId === Number(productoId) && s.estado === 'DISPONIBLE');
  if (n > disponibles.length) throw new Error('La cantidad supera el inventario disponible en GES.');
  for (let i = 0; i < n; i++) disponibles[i].estado = 'ASIGNADO';
  registrarAsignacion(cooperativaId, Number(productoId), n);
}

// Usada por el formulario "Comprar bonos / boletas a GES" del panel del
// administrador de cooperativa (pages/admin/ComprarBonosGes.jsx) — crea la
// transacción del lado de GES. El estado inicial solo representa
// visualmente si el Storage de GES ya tiene inventario suficiente para esa
// cantidad ("Completada": se asigna de inmediato) o no ("Pendiente") — no
// hay lógica de aprobación/backend real todavía (ver sección 10).
export function crearSolicitudDesdeCooperativa({ cooperativaId, productoId, cantidad, administrador, formaPago, prioridad }) {
  const n = Number(cantidad);
  if (!n || n <= 0) throw new Error('La cantidad debe ser mayor a 0.');
  if (!productoId) throw new Error('Selecciona un producto.');
  const disponibles = STORAGE.filter((s) => s.productoId === Number(productoId) && s.estado === 'DISPONIBLE').length;
  const estado = disponibles >= n ? 'Completada' : 'Pendiente';
  if (estado === 'Completada') {
    const libres = STORAGE.filter((s) => s.productoId === Number(productoId) && s.estado === 'DISPONIBLE');
    for (let i = 0; i < n; i++) libres[i].estado = 'ASIGNADO';
    registrarAsignacion(cooperativaId, Number(productoId), n);
  }
  const solicitud = {
    id: `sol-${Date.now()}`,
    cooperativaId,
    productoId: Number(productoId),
    cantidad: n,
    estado,
    fecha: hoyISO(),
    administrador: administrador || 'Administrador',
    formaPago: formaPago || 'Cupo',
    prioridad: prioridad || 'Normal',
  };
  solicitudes.push(solicitud);
  return solicitud;
}
