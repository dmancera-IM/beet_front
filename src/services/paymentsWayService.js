import { apiClient } from "./apiClient";

// Checkout externo Payments Way para compras de afiliado con TARJETA/PSE.
// CUPO no pasa por este servicio: sigue siendo interno BEET vía
// transaccionesService.comprar().
export function crearCheckout({ producto_id, cantidad, metodo_pago }) {
  const metodo = String(metodo_pago).toUpperCase();
  return apiClient.post(
    "/payments-way/checkout",
    {
      id_producto: producto_id,
      cantidad,
      metodo_pago: metodo,
    },
    { tokenAudience: "afiliado" }
  );
}

export function consultarEstado(externalOrder) {
  return apiClient.get(`/payments-way/estado/${encodeURIComponent(externalOrder)}`, { tokenAudience: "afiliado" });
}
