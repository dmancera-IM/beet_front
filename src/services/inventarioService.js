import { apiClient } from "./apiClient";

// Las unidades de inventario se identifican por PRODUCTO (productos_convenio),
// no por convenio — un convenio puede tener varios productos y cada uno
// tiene su propia bolsa de códigos (ver FRONTEND_DB_ALIGNMENT.md, sección 12).
export function listarInventario(productoId, { estado, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({ producto_id: productoId, page, page_size: pageSize });
  if (estado) params.set("estado", estado);
  return apiClient.get(`/api/inventario?${params.toString()}`, { tokenAudience: "admin" });
}

export function resumenInventario(productoId) {
  return apiClient.get(`/api/inventario/resumen?producto_id=${productoId}`, { tokenAudience: "admin" });
}

export function cargaInventario(productoId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.postForm(`/api/inventario/carga?producto_id=${productoId}`, formData, { tokenAudience: "admin" });
}

// Unlike cargaInventario above (codes for one already-selected producto),
// this loads codes for MULTIPLE productos in one file — each row names its
// own convenio/producto. See backend/templates/plantilla_inventario.xlsx.
export function cargaMasivaInventario(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.postForm("/api/inventario/carga-masiva", formData, { tokenAudience: "admin" });
}
