import { apiClient, ApiError } from "./apiClient";

export function miCupo() {
  return apiClient.get("/afiliados/me/cupo", { tokenAudience: "afiliado" });
}

export function obtenerCupo(afiliadoId) {
  return apiClient.get(`/afiliados/${afiliadoId}/cupo`, { tokenAudience: "admin" });
}

export function actualizarCupo(afiliadoId, { cupo_total, estado } = {}) {
  return apiClient.patch(`/afiliados/${afiliadoId}/cupo`, { cupo_total, estado }, { tokenAudience: "admin" });
}

// PENDIENTE: no existe un endpoint de asignación masiva de cupos
// (POST /cupos/asignacion-masiva) en el backend real — cada cupo se asigna
// individualmente vía `actualizarCupo`.
export function asignacionMasivaCupo() {
  return Promise.reject(new ApiError("La asignación masiva de cupos no está disponible: asigna el cupo afiliado por afiliado.", 501, null));
}
