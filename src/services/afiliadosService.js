// Afiliados reales (beet_backend/app/routers/afiliados.py). Solo ADMIN
// puede crear/editar (el backend obtiene su cooperativa del JWT, nunca del
// body); GES/SUPER_ADMIN/LECTOR también pueden listar/consultar.
import { apiClient, ApiError } from "./apiClient";

export async function listarAfiliados({ cooperativaId, estado, q } = {}) {
  const params = new URLSearchParams();
  if (cooperativaId) params.set("cooperativa_id", cooperativaId);
  if (estado !== undefined && estado !== null && estado !== "") params.set("estado", estado);
  const query = params.toString();
  const afiliados = await apiClient.get(`/afiliados${query ? `?${query}` : ""}`, { tokenAudience: "admin" });
  // `q` (búsqueda libre) no existe en el backend real — se filtra aquí.
  if (!q || !q.trim()) return afiliados;
  const term = q.trim().toLowerCase();
  return afiliados.filter((a) => `${a.nombres} ${a.apellidos} ${a.documento} ${a.correo}`.toLowerCase().includes(term));
}

export function obtenerAfiliado(id) {
  return apiClient.get(`/afiliados/${id}`, { tokenAudience: "admin" });
}

export function crearAfiliado(payload) {
  return apiClient.post("/afiliados", payload, { tokenAudience: "admin" });
}

export function actualizarAfiliado(id, payload) {
  return apiClient.patch(`/afiliados/${id}`, payload, { tokenAudience: "admin" });
}

// PENDIENTE: el backend real no expone DELETE /afiliados/{id} (tampoco un
// estado "RETIRADO" alternativo) — usa `actualizarAfiliado(id, {estado:
// false})` para desactivar.
export function eliminarAfiliado() {
  return Promise.reject(new ApiError('Eliminar afiliados no está disponible: usa "Desactivar" en su lugar.', 501, null));
}

// PENDIENTE: no hay endpoint de carga masiva de afiliados en el backend
// real (ni un formato de archivo definido) — ver informe de integración.
export function cargaMasivaAfiliados() {
  return Promise.reject(new ApiError("La carga masiva de afiliados no está disponible: el backend actual no expone este endpoint.", 501, null));
}

export function miPerfilAfiliado() {
  return apiClient.get("/afiliados/me", { tokenAudience: "afiliado" });
}

export function actualizarMiPerfilAfiliado(payload) {
  return apiClient.patch("/afiliados/me", payload, { tokenAudience: "afiliado" });
}

// ---- Cupo de crédito del afiliado (GET/PATCH /afiliados/{id}/cupo) --------

export function obtenerCupo(afiliadoId) {
  return apiClient.get(`/afiliados/${afiliadoId}/cupo`, { tokenAudience: "admin" });
}

export function actualizarCupo(afiliadoId, { cupo_total, estado } = {}) {
  return apiClient.patch(`/afiliados/${afiliadoId}/cupo`, { cupo_total, estado }, { tokenAudience: "admin" });
}
