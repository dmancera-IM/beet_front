import { ApiError } from "./apiClient";

// PENDIENTE: el backend real no expone GET /dashboard/stats (ni ningún
// endpoint agregado equivalente) — ver informe de integración. Dashboard.jsx
// fue reescrito para calcular sus KPIs a partir de endpoints reales que sí
// existen (bolsa, crédito, afiliados, convenios, transacciones) en vez de
// depender de este servicio.
export function obtenerDashboardStats() {
  return Promise.reject(new ApiError("Las estadísticas agregadas del dashboard no están disponibles como endpoint propio en el backend actual.", 501, null));
}
