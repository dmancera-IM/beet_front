import { apiClient } from "./apiClient";

export function getCuentaPago(cooperativaId) {
  if (!cooperativaId) return Promise.resolve(null);
  return apiClient.get(`/cooperativas/${cooperativaId}/cuenta-pago`, { tokenAudience: "admin" });
}

export function setCuentaPago(cooperativaId, { proveedor, ultimosDigitos, estado = true }) {
  if (!cooperativaId) return Promise.resolve(null);
  return apiClient.patch(
    `/cooperativas/${cooperativaId}/cuenta-pago`,
    { proveedor, ultimos_digitos: ultimosDigitos, estado },
    { tokenAudience: "admin" }
  );
}

export const COMISION_BEET_PAGOS = 2.5; // TODO: reemplazar por el porcentaje real definido por BEET/GES
