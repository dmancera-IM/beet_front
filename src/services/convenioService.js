import { apiClient } from "./apiClient";

export function listarConvenios({ page = 1, pageSize = 20, sortBy, estado } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (sortBy) params.set("sort_by", sortBy);
  if (estado) params.set("estado", estado);
  return apiClient.get(`/api/convenios?${params.toString()}`, { tokenAudience: "admin" });
}

// Catálogo maestro de convenios publicado por GES (id/nombre) — usado por
// "Agregar convenio" para elegir de esta lista, nunca escribir un nombre
// nuevo (sección 9/11 de FRONTEND_DB_ALIGNMENT.md).
export function listarCatalogoMaestroConvenios() {
  return apiClient.get("/api/convenios/catalogo-maestro", { tokenAudience: "admin", skipCooperativaScope: true });
}

// Productos (productos_convenio) que el catálogo maestro de GES tiene
// registrados para un convenio — un convenio puede tener varios.
export function listarProductosDeConvenio(idConvenio) {
  return apiClient.get(`/api/convenios/productos?id_convenio=${encodeURIComponent(idConvenio)}`, { tokenAudience: "admin", skipCooperativaScope: true });
}

export function obtenerCatalogoAfiliado() {
  return apiClient.get("/api/convenios/catalogo", { tokenAudience: "afiliado" });
}

export function obtenerConvenio(id) {
  return apiClient.get(`/api/convenios/${id}`, { tokenAudience: "admin" });
}

export function crearConvenio(payload) {
  return apiClient.post("/api/convenios", payload, { tokenAudience: "admin" });
}

export function actualizarConvenio(id, payload) {
  return apiClient.patch(`/api/convenios/${id}`, payload, { tokenAudience: "admin" });
}

export function cargaMasivaConvenios(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.postForm("/api/convenios/carga-masiva", formData, { tokenAudience: "admin" });
}

export function exportarConvenios() {
  return apiClient.getBlobWithFilename("/api/convenios/exportar", { tokenAudience: "admin" }, "convenios.xlsx");
}

// `imagenMarcaUrl` (from ConvenioOut.imagen_marca_url, catalog only) is a
// relative API path guarded by the afiliado's own JWT — an `<img src>`
// can't carry that Authorization header, so this fetches the bytes
// through apiClient (same auth path as every other download) and hands
// back a Blob for the caller to turn into an object URL.
export function obtenerImagenMarcaBlob(imagenMarcaUrl) {
  return apiClient.getBlob(imagenMarcaUrl, { tokenAudience: "afiliado" });
}
