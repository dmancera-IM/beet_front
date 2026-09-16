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
//
// ---------------------------------------------------------------------------
// Alineación con el modelo de base de datos (ver FRONTEND_DB_ALIGNMENT.md)
// ---------------------------------------------------------------------------
// Este módulo representa el lado "cooperativa" del modelo: usuarios,
// cooperativas, afiliados, cooperativas_convenios y unidades_inventario.
// El catálogo MAESTRO de convenios/productos (creado y mantenido por GES)
// vive, por diseño, en pages/admin/ges/gesData.js — universo mock aislado
// documentado allí — y aquí solo se MIRROREA (mismos ids/nombres) para que
// una cooperativa pueda "elegir" convenios/productos que GES ya publicó,
// igual que ya se hacía con `cooperativas`. Cuando exista backend real,
// ambos universos serán la misma tabla en PostgreSQL.

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

let nextId = {
  usuario: 100,
  cooperativa: 100,
  afiliado: 1000,
  cooperativaConvenio: 100,
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
// cooperativas
// ---------------------------------------------------------------------------

export const cooperativas = [
  { id: 1, nombre: 'Cooperativa Bienestar', nit: '900123456-7', estado: true, fecha_creacion: dateOnly(-900) },
  { id: 2, nombre: 'Cooperativa Unión', nit: '900987654-3', estado: true, fecha_creacion: dateOnly(-500) },
  { id: 3, nombre: 'Cooperativa Horizonte', nit: '901222333-1', estado: false, fecha_creacion: dateOnly(-200) },
];

// ---------------------------------------------------------------------------
// usuarios (usuarios administrativos del sistema — login del panel admin)
// ---------------------------------------------------------------------------
// Reglas de rol (ver sección 4 de FRONTEND_DB_ALIGNMENT.md): GES y
// SUPER_ADMIN no pertenecen a ninguna cooperativa (id_cooperativa: null);
// ADMIN y LECTOR sí, y solo ven los datos de la suya.

export const usuarios = [
  { id: 1, id_cooperativa: null, nombre: 'Diana Martínez', correo: 'superadmin@beetticket.com', rol: 'SUPER_ADMIN', estado: true, fecha_creacion: dateOnly(-800) },
  { id: 2, id_cooperativa: 1, nombre: 'Carlos Gómez', correo: 'admin@beetticket.com', rol: 'ADMIN', estado: true, fecha_creacion: dateOnly(-700) },
  { id: 3, id_cooperativa: 1, nombre: 'Laura Pérez', correo: 'lector@beetticket.com', rol: 'LECTOR', estado: true, fecha_creacion: dateOnly(-600) },
  { id: 4, id_cooperativa: 2, nombre: 'Andrés Ruiz', correo: 'admin.union@beetticket.com', rol: 'ADMIN', estado: true, fecha_creacion: dateOnly(-500) },
  { id: 5, id_cooperativa: null, nombre: 'Equipo GES', correo: 'ges@beetticket.com', rol: 'GES', estado: true, fecha_creacion: dateOnly(-900) },
];

// ---------------------------------------------------------------------------
// afiliados (+ credenciales de portal) — cada afiliado pertenece a UNA sola
// cooperativa (id_cooperativa), tal como exige el modelo.
// ---------------------------------------------------------------------------

export const afiliados = [
  { id: 1, nombres: 'Juan', apellidos: 'Pérez', documento: '1000000001', correo: 'juan.perez@correo.com', telefono: '3001234567', estado: true, id_cooperativa: 1 },
  { id: 2, nombres: 'María', apellidos: 'Gómez', documento: '1000000002', correo: 'maria.gomez@correo.com', telefono: '3009876543', estado: true, id_cooperativa: 1 },
  { id: 3, nombres: 'Diana', apellidos: 'Martínez', documento: '1000000003', correo: 'diana.martinez@correo.com', telefono: '3005124471', estado: true, id_cooperativa: 1 },
  { id: 4, nombres: 'Pedro', apellidos: 'Ramírez', documento: '1000000004', correo: 'pedro.ramirez@correo.com', telefono: null, estado: false, id_cooperativa: 1 },
  { id: 5, nombres: 'Sofía', apellidos: 'Castro', documento: '1000000005', correo: 'sofia.castro@correo.com', telefono: '3012223344', estado: true, id_cooperativa: 2 },
  { id: 6, nombres: 'Andrés', apellidos: 'Londoño', documento: '1000000006', correo: 'andres.londono@correo.com', telefono: '3019998877', estado: true, id_cooperativa: 2 },
];

// Roster row seeded WITHOUT an activated portal password yet — lets
// PortalRegister's "activar cuenta" flow be demoed for real (documento +
// correo deben coincidir exactamente).
export const afiliadoPendienteActivacion = { documento: '1000000009', correo: 'nuevo.afiliado@correo.com' };

// ---------------------------------------------------------------------------
// Mirror del catálogo maestro de GES (convenios y productos_convenio)
// ---------------------------------------------------------------------------
// GES es dueño real de este catálogo — ver pages/admin/ges/gesData.js
// (PROVEEDORES/PRODUCTOS). Aquí solo se refleja lo mínimo (id/nombre) para
// que cooperativas_convenios y las unidades de inventario puedan
// referenciar un convenio/producto sin que services/ dependa de pages/.

export const conveniosCatalogo = [
  { id: 'cine-colombia', nombre: 'Cine Colombia' },
  { id: 'mundo-aventura', nombre: 'Mundo Aventura' },
  { id: 'exito', nombre: 'Éxito' },
  { id: 'salitre-magico', nombre: 'Salitre Mágico' },
  { id: 'cafe-central', nombre: 'Café Central' },
  { id: 'teatro-nacional', nombre: 'Teatro Nacional' },
  { id: 'spa-relax', nombre: 'Spa Relax' },
];

// productos_convenio: un producto pertenece a UN convenio; un convenio
// puede tener varios productos (ver sección 7).
export const productosConvenio = [
  { id: 1, id_convenio: 'cine-colombia', nombre: 'Entrada 2D', descripcion: 'Entrada general 2D, válida de lunes a viernes.', estado: true, fecha_creacion: dateOnly(-120) },
  { id: 8, id_convenio: 'cine-colombia', nombre: 'Entrada 3D', descripcion: 'Entrada general 3D.', estado: true, fecha_creacion: dateOnly(-100) },
  { id: 2, id_convenio: 'mundo-aventura', nombre: 'Entrada General', descripcion: 'Entrada general al parque.', estado: true, fecha_creacion: dateOnly(-90) },
  { id: 3, id_convenio: 'exito', nombre: 'Bono Mercado', descripcion: 'Bono de mercado, válido en todo el país.', estado: true, fecha_creacion: dateOnly(-200) },
  { id: 4, id_convenio: 'salitre-magico', nombre: 'Entrada General', descripcion: 'Entrada general al parque de diversiones.', estado: true, fecha_creacion: dateOnly(-30) },
  { id: 5, id_convenio: 'spa-relax', nombre: 'Sesión de Bienestar', descripcion: 'Sesión de bienestar de una hora.', estado: true, fecha_creacion: dateOnly(-400) },
  { id: 6, id_convenio: 'cafe-central', nombre: 'Bono Desayuno', descripcion: 'Bono de desayuno o almuerzo.', estado: true, fecha_creacion: dateOnly(-60) },
  { id: 7, id_convenio: 'teatro-nacional', nombre: 'Boleta General', descripcion: 'Boleta general.', estado: true, fecha_creacion: dateOnly(-10) },
];

// ---------------------------------------------------------------------------
// cooperativas_convenios — qué convenios del catálogo maestro usa cada
// cooperativa, con SU precio BEET, precio normal, vigencia y estado (ver
// sección 10). El "nombre" queda copiado aquí como snapshot de visualización
// (mismo patrón que ya usaba el frontend), pero la relación real es
// `id_convenio` -> conveniosCatalogo.
// ---------------------------------------------------------------------------

export const cooperativasConvenios = [
  { id: 1, id_cooperativa: 1, id_convenio: 'cine-colombia', nombre: 'Cine Colombia', descripcion: 'Entradas 2D/3D válidas de lunes a viernes.', precio_normal: 18000, precio_beet: 12500, fecha_inicio: dateOnly(-120), fecha_fin: dateOnly(120), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 2, id_cooperativa: 1, id_convenio: 'mundo-aventura', nombre: 'Mundo Aventura', descripcion: 'Entrada general al parque.', precio_normal: 65000, precio_beet: 48000, fecha_inicio: dateOnly(-90), fecha_fin: dateOnly(200), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 3, id_cooperativa: 1, id_convenio: 'exito', nombre: 'Éxito', descripcion: 'Bono de mercado, válido en todo el país.', precio_normal: 50000, precio_beet: 46000, fecha_inicio: dateOnly(-200), fecha_fin: null, estado: true, plantilla_en_uso: 'Diseño oficial', imagen_marca_url: null },
  { id: 4, id_cooperativa: 1, id_convenio: 'salitre-magico', nombre: 'Salitre Mágico', descripcion: 'Entrada general al parque de diversiones.', precio_normal: 55000, precio_beet: 39000, fecha_inicio: dateOnly(-30), fecha_fin: dateOnly(10), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 5, id_cooperativa: 1, id_convenio: 'spa-relax', nombre: 'Spa Relax', descripcion: 'Sesión de bienestar de una hora.', precio_normal: 90000, precio_beet: 70000, fecha_inicio: dateOnly(-400), fecha_fin: dateOnly(-30), estado: false, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 6, id_cooperativa: 2, id_convenio: 'cafe-central', nombre: 'Café Central', descripcion: 'Bono de desayuno o almuerzo.', precio_normal: 25000, precio_beet: 19000, fecha_inicio: dateOnly(-60), fecha_fin: null, estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  { id: 7, id_cooperativa: 2, id_convenio: 'teatro-nacional', nombre: 'Teatro Nacional', descripcion: 'Boleta general.', precio_normal: 40000, precio_beet: 30000, fecha_inicio: dateOnly(-10), fecha_fin: dateOnly(60), estado: true, plantilla_en_uso: null, imagen_marca_url: null },
  // cooperativa 3 (Horizonte) deliberately has zero convenios — demoes an
  // inactive/empty cooperativa in the switcher.
];

export function productosDeCooperativaConvenio(cc) {
  return productosConvenio.filter((p) => p.id_convenio === cc.id_convenio && p.estado);
}

// ---------------------------------------------------------------------------
// unidades_inventario — unidades/códigos individuales que la cooperativa ya
// tiene disponibles para entregar a sus afiliados (ver sección 12). Cada
// unidad pertenece a UN producto y a UNA sola cooperativa.
// ---------------------------------------------------------------------------

const ESTADOS_UNIDAD_MUESTRA = ['DISPONIBLE', 'DISPONIBLE', 'DISPONIBLE', 'ENTREGADA', 'ENTREGADA', 'VENCIDA', 'BLOQUEADA'];

export const unidadesInventario = [];
function sembrarInventario(cooperativaId, productoId, prefijo, cantidad) {
  for (let i = 0; i < cantidad; i++) {
    unidadesInventario.push({
      id: newId('unidad'),
      id_cooperativa: cooperativaId,
      id_producto: productoId,
      codigo: `${prefijo}-${String(i + 1).padStart(6, '0')}`,
      estado: ESTADOS_UNIDAD_MUESTRA[i % ESTADOS_UNIDAD_MUESTRA.length],
      fecha_asignacion: dateOnly(-60 + i),
    });
  }
}
sembrarInventario(1, 1, 'CIN', 18); // Cine Colombia · Entrada 2D
sembrarInventario(1, 2, 'AVE', 14); // Mundo Aventura · Entrada General
sembrarInventario(1, 3, 'EXI', 16); // Éxito · Bono Mercado
sembrarInventario(1, 4, 'SAL', 12); // Salitre Mágico · Entrada General
sembrarInventario(1, 5, 'SPA', 6); // Spa Relax · Sesión de Bienestar
sembrarInventario(2, 6, 'CAF', 10); // Café Central · Bono Desayuno
sembrarInventario(2, 7, 'TEA', 9); // Teatro Nacional · Boleta General

// ---------------------------------------------------------------------------
// Cupos de crédito (uno por afiliado, opcional) — sección 15: el mecanismo
// financiero real (bolsa/crédito) todavía no está definido; esto solo
// conserva la UI existente sin inventar reglas nuevas.
// ---------------------------------------------------------------------------

export const cupos = [
  { afiliado_id: 1, cupo_total: 500000, cupo_disponible: 320000, estado: true },
  { afiliado_id: 2, cupo_total: 800000, cupo_disponible: 800000, estado: true },
  { afiliado_id: 3, cupo_total: 300000, cupo_disponible: 0, estado: false },
  // afiliado 4 (retirado) y los de cooperativa 2 (5,6) sin cupo asignado — estado real, no un error.
];

// ---------------------------------------------------------------------------
// Compras del afiliado (pago tarjeta/cupo) + tickets + documentos de
// asunción de deuda.
//
// IMPORTANTE — esto NO es la tabla `transacciones` de la sección 11 del
// modelo (esa es cooperativa -> GES, ver pages/admin/ges/gesData.js
// `solicitudes`). Esta es la orden de compra/pago del AFILIADO dentro de su
// cooperativa (sección 14): no tiene un lugar propio en el modelo de 9
// tablas todavía, así que se deja aquí como una simulación de pasarela de
// pago ya existente en el frontend, ajustada para no usar más `convenio_id`
// (ahora identifica el producto comprado) y para no inventar un estado
// "RECHAZADA": un pago rechazado por la pasarela simplemente no genera fila
// (ver apiClient.ejecutarCompra) — el afiliado solo ve el error.
// ---------------------------------------------------------------------------

export const transacciones = [
  {
    id: 1, afiliado_id: 1, id_producto: 1, cantidad: 2, subtotal: 25000, total: 25000,
    metodo_pago: 'TARJETA', numero_cuotas: null, estado: 'COMPLETADA', codigos: ['CIN-000001', 'CIN-000002'],
    created_at: todayISO(-6), referencia_pago: 'AUTH-58231', resultado_pago: 'aprobado',
  },
  {
    id: 2, afiliado_id: 1, id_producto: 3, cantidad: 1, subtotal: 46000, total: 46000,
    metodo_pago: 'CUPO', numero_cuotas: 3, estado: 'COMPLETADA', codigos: ['EXI-000001'],
    created_at: todayISO(-3), referencia_pago: null, resultado_pago: 'aprobado',
  },
  {
    id: 3, afiliado_id: 5, id_producto: 6, cantidad: 3, subtotal: 57000, total: 57000,
    metodo_pago: 'TARJETA', numero_cuotas: null, estado: 'COMPLETADA', codigos: ['CAF-000001', 'CAF-000002', 'CAF-000003'],
    created_at: todayISO(-8), referencia_pago: 'AUTH-90112', resultado_pago: 'aprobado',
  },
];

export const tickets = [
  { id: 1, afiliado_id: 1, id_producto: 1, codigo: 'CIN-000001', estado: 'ENTREGADA' },
  { id: 2, afiliado_id: 1, id_producto: 1, codigo: 'CIN-000002', estado: 'ENTREGADA' },
  { id: 3, afiliado_id: 1, id_producto: 3, codigo: 'EXI-000001', estado: 'ENTREGADA' },
  { id: 4, afiliado_id: 5, id_producto: 6, codigo: 'CAF-000001', estado: 'ENTREGADA' },
  { id: 5, afiliado_id: 5, id_producto: 6, codigo: 'CAF-000002', estado: 'ENTREGADA' },
  { id: 6, afiliado_id: 5, id_producto: 6, codigo: 'CAF-000003', estado: 'VENCIDA' },
];

export const documentos = [
  {
    id: 1, afiliado_id: 1, id_producto: 3, transaccion_id: 2, producto_nombre: 'Bono Mercado', convenio_nombre: 'Éxito',
    valor: 46000, numero_cuotas: 3, fecha_generacion: todayISO(-3), fecha_firma: todayISO(-3), estado: 'FIRMADO',
  },
];

// ---------------------------------------------------------------------------
// Plantillas (catálogo fijo + personalizadas por cooperativa_convenio)
// ---------------------------------------------------------------------------

export const catalogoPlantillas = [
  { clave: 'clasico', nombre: 'Clásico' },
  { clave: 'moderno', nombre: 'Moderno' },
  { clave: 'minimal', nombre: 'Minimal' },
  { clave: 'elegante', nombre: 'Elegante' },
];

export const plantillasPersonalizadas = [
  { id: 1, cooperativa_convenio_id: 3, nombre: 'Diseño oficial', version: 2, en_uso: true, html: '<html><body><h1>{{ convenio.nombre }}</h1></body></html>' },
];

// ---------------------------------------------------------------------------
// Logs de auditoría (actividad reciente)
// ---------------------------------------------------------------------------

const ACCIONES_MUESTRA = [
  { accion: 'compra_completada', tabla_afectada: 'transacciones', registro_id: 2 },
  { accion: 'cupo_actualizado', tabla_afectada: 'cupos', registro_id: 1 },
  { accion: 'afiliado_creado', tabla_afectada: 'afiliados', registro_id: 3 },
  { accion: 'cooperativa_convenio_actualizado', tabla_afectada: 'cooperativas_convenios', registro_id: 4 },
  { accion: 'inventario_carga_masiva', tabla_afectada: 'unidades_inventario', registro_id: null },
  { accion: 'plantilla_actualizada', tabla_afectada: 'plantillas', registro_id: 1 },
  { accion: 'usuario_actualizado', tabla_afectada: 'usuarios', registro_id: 3 },
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

export function productoDe(id) {
  return productosConvenio.find((p) => p.id === Number(id)) ?? null;
}

export function cooperativaConvenioDeProducto(producto, cooperativaId) {
  if (!producto) return null;
  return cooperativasConvenios.find((cc) => cc.id_cooperativa === cooperativaId && cc.id_convenio === producto.id_convenio) ?? null;
}

// Shape sent to the afiliado-facing catalog: un producto comprable, con el
// precio/vigencia heredados del cooperativas_convenios que lo habilitó
// (sección 10 no define precio a nivel de producto). Nunca expone
// cooperativa_id/id ids internos de la cooperativa.
export function productoPublico(producto, cooperativaConvenio) {
  return {
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    convenio_nombre: cooperativaConvenio.nombre,
    precio_beet: cooperativaConvenio.precio_beet,
    precio_normal: cooperativaConvenio.precio_normal,
    fecha_inicio: cooperativaConvenio.fecha_inicio,
    fecha_fin: cooperativaConvenio.fecha_fin,
    imagen_marca_url: cooperativaConvenio.imagen_marca_url,
  };
}

export function resumenInventarioDe(productoId) {
  const rows = unidadesInventario.filter((u) => u.id_producto === Number(productoId));
  const contar = (estado) => rows.filter((u) => u.estado === estado).length;
  return {
    disponible: contar('DISPONIBLE'),
    entregada: contar('ENTREGADA'),
    vencida: contar('VENCIDA'),
    bloqueada: contar('BLOQUEADA'),
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
