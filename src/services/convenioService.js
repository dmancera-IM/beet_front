// Convenios/productos reales contra FastAPI.
// Mantiene el shape que esperan las pantallas existentes, pero usa los
// endpoints nuevos del backend para catálogo del afiliado y configuración por
// cooperativa cuando corresponde.
import { apiClient, ApiError, cooperativaScopeStore } from "./apiClient";

async function resolveCooperativaId(cooperativaId) {
  if (cooperativaId) return Number(cooperativaId);
  const selected = cooperativaScopeStore.get();
  if (selected) return Number(selected);
  const me = await apiClient.get("/auth/me", { tokenAudience: "admin" });
  if (me?.id_cooperativa) return Number(me.id_cooperativa);
  throw new Error("Selecciona una cooperativa para usar esta función.");
}

function normalizarProductoPortal(p) {
  return {
    id: p.id_producto,
    nombre: p.nombre,
    descripcion: p.descripcion,
    convenio_id: p.id_convenio,
    convenio_nombre: p.nombre_convenio,
    imagen_marca_url: p.imagen_url ?? null,
    precio: p.precio_beet,
    precio_beet: p.precio_beet,
  };
}

function calcularPrecioBeet(precioGesEntidad, porcentajeGanancia) {
  if (precioGesEntidad == null || porcentajeGanancia == null) return null;
  return Math.round(Number(precioGesEntidad) * (1 + Number(porcentajeGanancia) / 100));
}

export function listarConvenios({ soloActivos, tokenAudience = "admin" } = {}) {
  const params = new URLSearchParams();
  if (soloActivos) params.set("solo_activos", "true");
  const query = params.toString();
  return apiClient.get(`/convenios${query ? `?${query}` : ""}`, { tokenAudience });
}

export const listarCatalogoMaestroConvenios = () => listarConvenios({ soloActivos: true });

export function obtenerConvenio(id, { tokenAudience = "admin" } = {}) {
  return apiClient.get(`/convenios/${id}`, { tokenAudience });
}

export function crearConvenio({ nombre, imagen_url }) {
  return apiClient.post("/convenios", { nombre, imagen_url: imagen_url ?? null }, { tokenAudience: "admin" });
}

export function actualizarConvenio(id, payload) {
  return apiClient.patch(`/convenios/${id}`, payload, { tokenAudience: "admin" });
}

export function listarProductos({ idConvenio, soloActivos, tokenAudience = "admin" } = {}) {
  const params = new URLSearchParams();
  if (idConvenio) params.set("id_convenio", idConvenio);
  if (soloActivos) params.set("solo_activos", "true");
  const query = params.toString();
  return apiClient.get(`/productos${query ? `?${query}` : ""}`, { tokenAudience });
}

export const listarProductosDeConvenio = (idConvenio) => listarProductos({ idConvenio, soloActivos: true });

export function obtenerProducto(id, { tokenAudience = "admin" } = {}) {
  return apiClient.get(`/productos/${id}`, { tokenAudience });
}

export function crearProducto({ id_convenio, nombre, descripcion, precio_venta_entidad }) {
  return apiClient.post(
    "/productos",
    { id_convenio, nombre, descripcion: descripcion ?? null, precio_venta_entidad: precio_venta_entidad ?? null },
    { tokenAudience: "admin" }
  );
}

export function actualizarProducto(id, payload) {
  return apiClient.patch(`/productos/${id}`, payload, { tokenAudience: "admin" });
}

export async function obtenerCatalogoAfiliado() {
  const rows = await apiClient.get("/portal/catalogo", { tokenAudience: "afiliado" });
  return rows.map(normalizarProductoPortal);
}

export async function listarConveniosCooperativa({ cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  const [conveniosCoop, conveniosGlobales, productosGlobales, productosCoop] = await Promise.all([
    apiClient.get(`/cooperativas/${id}/convenios`, { tokenAudience: "admin" }),
    listarConvenios({ tokenAudience: "admin" }),
    listarProductos({ tokenAudience: "admin" }).catch(() => []),
    apiClient.get(`/cooperativas/${id}/productos`, { tokenAudience: "admin" }).catch(() => []),
  ]);

  const convenioPorId = new Map(conveniosGlobales.map((c) => [c.id, c]));
  const productosPorConvenio = productosGlobales.reduce((acc, p) => {
    if (!acc[p.id_convenio]) acc[p.id_convenio] = [];
    acc[p.id_convenio].push(p);
    return acc;
  }, {});
  const cpPorProducto = new Map(productosCoop.map((cp) => [cp.id_producto, cp]));

  return conveniosCoop.map((cc) => {
    const global = convenioPorId.get(cc.id_convenio) ?? {};
    const productos = productosPorConvenio[cc.id_convenio] ?? [];
    const algunProductoListo = productos.some((p) => {
      const cp = cpPorProducto.get(p.id);
      return !!cp && cp.precio_normal != null && p.precio_venta_entidad != null && p.estado && cp.estado;
    });
    return {
      ...cc,
      id: cc.id_convenio,
      id_configuracion: cc.id,
      nombre: global.nombre ?? `Convenio ${cc.id_convenio}`,
      imagen_url: global.imagen_url ?? null,
      estado_global: global.estado ?? false,
      puede_activarse: Boolean(global.estado && cc.porcentaje_ganancia_entidad != null && algunProductoListo),
    };
  });
}

export async function listarConveniosDisponiblesCooperativa({ cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  return apiClient.get(`/cooperativas/${id}/convenios/disponibles`, { tokenAudience: "admin" });
}

export async function agregarConvenioCooperativa(convenioId, { cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  return apiClient.post(`/cooperativas/${id}/convenios/${convenioId}`, undefined, { tokenAudience: "admin" });
}

export async function actualizarConvenioCooperativa(convenioId, payload, { cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  return apiClient.patch(`/cooperativas/${id}/convenios/${convenioId}`, payload, { tokenAudience: "admin" });
}

export async function cambiarEstadoConvenioCooperativa(convenioId, estado, { cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  return apiClient.patch(`/cooperativas/${id}/convenios/${convenioId}/estado`, { estado }, { tokenAudience: "admin" });
}

export async function listarProductosCooperativa(idConvenio, { cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  const [globales, configuraciones, conveniosCoop] = await Promise.all([
    listarProductos({ idConvenio, tokenAudience: "admin" }),
    apiClient.get(`/cooperativas/${id}/productos?convenio_id=${encodeURIComponent(idConvenio)}`, { tokenAudience: "admin" }),
    apiClient.get(`/cooperativas/${id}/convenios`, { tokenAudience: "admin" }).catch(() => []),
  ]);
  const configuracionPorProducto = new Map(configuraciones.map((cp) => [cp.id_producto, cp]));
  const cc = conveniosCoop.find((c) => String(c.id_convenio) === String(idConvenio));
  return globales.map((p) => {
    const cp = configuracionPorProducto.get(p.id) ?? {
      id_producto: p.id,
      precio_normal: null,
      descripcion: null,
      fecha_inicio: null,
      fecha_fin: null,
      estado: false,
      precio_beet: calcularPrecioBeet(p.precio_venta_entidad, cc?.porcentaje_ganancia_entidad),
    };
    return {
      ...cp,
      id_producto: cp.id_producto,
      nombre: p.nombre,
      descripcion_base: p.descripcion,
      precio_ges_entidad: p.precio_venta_entidad,
      porcentaje_ganancia_entidad: cc?.porcentaje_ganancia_entidad ?? null,
      configurado: cp.precio_normal != null && cp.precio_beet != null,
      precio_beet: cp.precio_beet ?? calcularPrecioBeet(p.precio_venta_entidad, cc?.porcentaje_ganancia_entidad),
      descripcion: cp.descripcion ?? p.descripcion,
    };
  });
}

export async function obtenerConfiguracionProducto(productoId, { cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  const [producto, cp, conveniosCoop] = await Promise.all([
    obtenerProducto(productoId, { tokenAudience: "admin" }),
    apiClient.get(`/cooperativas/${id}/productos/${productoId}`, { tokenAudience: "admin" }).catch((err) => {
      if (err instanceof ApiError && err.status === 404) {
        return {
          id_producto: Number(productoId),
          precio_normal: null,
          descripcion: null,
          fecha_inicio: null,
          fecha_fin: null,
          estado: false,
          precio_beet: null,
        };
      }
      throw err;
    }),
    apiClient.get(`/cooperativas/${id}/convenios`, { tokenAudience: "admin" }).catch(() => []),
  ]);
  const cc = conveniosCoop.find((c) => String(c.id_convenio) === String(producto.id_convenio));
  return {
    ...cp,
    id_producto: cp.id_producto,
    nombre: producto.nombre,
    descripcion_base: producto.descripcion,
    convenio_nombre: cc?.nombre ?? null,
    precio_ges_entidad: producto.precio_venta_entidad,
    porcentaje_ganancia_entidad: cc?.porcentaje_ganancia_entidad ?? null,
    precio_beet: cp.precio_beet,
    configurado: cp.precio_normal != null && cp.precio_beet != null,
    descripcion: cp.descripcion ?? producto.descripcion,
  };
}

export async function actualizarConfiguracionProducto(productoId, payload, { cooperativaId } = {}) {
  const id = await resolveCooperativaId(cooperativaId);
  return apiClient.patch(`/cooperativas/${id}/productos/${productoId}`, payload, { tokenAudience: "admin" });
}

export function cargaMasivaConvenios() {
  return Promise.reject(new Error("La carga masiva de convenios no está disponible en el backend real."));
}

export function exportarConvenios() {
  return Promise.reject(new Error("La exportación de convenios no está disponible en el backend real."));
}

export function obtenerImagenMarcaBlob(imagenMarcaUrl) {
  return imagenMarcaUrl ? fetch(imagenMarcaUrl).then((r) => r.blob()) : Promise.resolve(null);
}
