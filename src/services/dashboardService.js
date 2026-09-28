import { apiClient, cooperativaScopeStore } from "./apiClient";

// GET /dashboard/stats real (beet_backend/app/routers/dashboard.py). Para
// ADMIN/LECTOR el backend siempre usa su propia cooperativa (del JWT) sin
// importar qué llegue por query — `cooperativa_id` solo importa para
// SUPER_ADMIN/GES, tomado de la cooperativa seleccionada en el Header
// (mismo patrón que convenioService.resolveCooperativaId).
export function obtenerDashboardStats({ cooperativaId } = {}) {
  const id = cooperativaId ?? cooperativaScopeStore.get();
  const query = id ? `?cooperativa_id=${id}` : "";
  return apiClient.get(`/dashboard/stats${query}`, { tokenAudience: "admin" });
}
