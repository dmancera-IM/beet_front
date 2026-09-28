import { apiClient, ApiError, cooperativaScopeStore } from "./apiClient";

// GET /reportes/rendimiento-convenios real (beet_backend/app/routers/reportes.py).
// Mismo patrón de scope que dashboardService: cooperativa_id solo importa
// para SUPER_ADMIN/GES (ADMIN/LECTOR siempre quedan scoped por el JWT en
// el backend, sin importar qué se mande aquí).
export function obtenerRendimientoConvenios({ metodoPago, cooperativaId } = {}) {
  const params = new URLSearchParams();
  const id = cooperativaId ?? cooperativaScopeStore.get();
  if (id) params.set("cooperativa_id", id);
  if (metodoPago) params.set("metodo_pago", metodoPago);
  const query = params.toString();
  return apiClient.get(`/reportes/rendimiento-convenios${query ? `?${query}` : ""}`, { tokenAudience: "admin" });
}

// PENDIENTE: no hay exportación a Excel/CSV en el backend actual — fuera
// del alcance de este trabajo (solo /dashboard/stats y
// /reportes/rendimiento-convenios). Se deja el estado "no disponible" en
// vez de simular un archivo.
function noDisponible(nombre) {
  return Promise.reject(new ApiError(`"${nombre}" no está disponible: el backend actual no expone este endpoint.`, 501, null));
}

export const exportarRendimientoConvenios = () => noDisponible("Exportar rendimiento");
export const exportarAfiliados = () => noDisponible("Exportar afiliados");
