// Inventario real de la cooperativa (beet_backend/app/routers/inventario.py)
// — unidades ya asignadas desde storage_ges vía una solicitud de compra
// completada. Solo lectura: el backend nunca acepta escribir aquí
// directamente (las unidades se crean únicamente a través de
// solicitudes-compra, ver solicitudesService.js).
import { apiClient, ApiError } from "./apiClient";

export function listarInventario({ cooperativaId, idProducto, estado } = {}) {
  const params = new URLSearchParams();
  if (cooperativaId) params.set("cooperativa_id", cooperativaId);
  if (idProducto) params.set("id_producto", idProducto);
  if (estado) params.set("estado", estado);
  const query = params.toString();
  return apiClient.get(`/inventario${query ? `?${query}` : ""}`, { tokenAudience: "admin" });
}

export async function resumenInventario(productoId) {
  const unidades = await listarInventario({ idProducto: productoId });
  const disponible = unidades.filter((u) => u.estado === "DISPONIBLE").length;
  const vendidas = unidades.filter((u) => u.estado === "VENDIDO").length;
  const vencidas = unidades.filter((u) => u.estado === "VENCIDO").length;
  return { producto_id: productoId, total: unidades.length, disponible, vendidas, vencidas };
}

export function cargaInventario() {
  return Promise.reject(new ApiError("La carga de inventario por archivo no está disponible: usa una solicitud de compra.", 501, null));
}

export function cargaMasivaInventario() {
  return Promise.reject(new ApiError("La carga masiva de inventario no está disponible: usa una solicitud de compra.", 501, null));
}
