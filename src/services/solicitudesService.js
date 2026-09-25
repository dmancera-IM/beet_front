// Solicitudes de compra cooperativa -> GES, real
// (beet_backend/app/routers/solicitudes.py). Crear solo lo puede hacer un
// ADMIN (para SU cooperativa, tomada del JWT); GES/SUPER_ADMIN listan y
// completan (reintentan la asignación de storage cuando ya hay suficiente).
import { apiClient } from "./apiClient";

export function listarSolicitudes({ cooperativaId, estado } = {}) {
  const params = new URLSearchParams();
  if (cooperativaId) params.set("cooperativa_id", cooperativaId);
  if (estado) params.set("estado", estado);
  const query = params.toString();
  return apiClient.get(`/solicitudes-compra${query ? `?${query}` : ""}`, { tokenAudience: "admin" });
}

export function obtenerSolicitud(id) {
  return apiClient.get(`/solicitudes-compra/${id}`, { tokenAudience: "admin" });
}

export function crearSolicitud({ idProducto, cantidad, formaPago, prioridad }) {
  return apiClient.post(
    "/solicitudes-compra",
    { id_producto: idProducto, cantidad, forma_pago: formaPago, prioridad: prioridad ?? "NORMAL" },
    { tokenAudience: "admin" }
  );
}

export function completarSolicitud(id) {
  return apiClient.post(`/solicitudes-compra/${id}/completar`, undefined, { tokenAudience: "admin" });
}
