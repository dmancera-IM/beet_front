import { ApiError } from "./apiClient";

// PENDIENTE: no existen endpoints /reportes/* en el backend actual (ni
// exportación a Excel). Reportes.jsx muestra un estado "no disponible" en
// vez de datos simulados; Dashboard.jsx ya no depende de este servicio.
function noDisponible() {
  return Promise.reject(new ApiError("Los reportes no están disponibles: el backend actual no expone estos endpoints.", 501, null));
}

export const obtenerRendimientoConvenios = noDisponible;
export const exportarRendimientoConvenios = noDisponible;
export const exportarAfiliados = noDisponible;
