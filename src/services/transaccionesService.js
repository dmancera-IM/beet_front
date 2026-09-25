// Compra real del afiliado (beet_backend/app/routers/transacciones.py).
//
import { apiClient, ApiError } from "./apiClient";

export function comprar({ producto_id, cantidad, metodo_pago, numero_cuotas, firma_base64, firma_url }) {
  const metodo = String(metodo_pago).toUpperCase();
  return apiClient.post(
    "/transacciones/comprar",
    {
      id_producto: producto_id,
      cantidad,
      metodo_pago: metodo,
      numero_cuotas: metodo === "CUPO" ? numero_cuotas ?? null : null,
      firma_url: metodo === "CUPO" ? firma_url ?? firma_base64 ?? null : null,
    },
    { tokenAudience: "afiliado" }
  ).then((resultado) => ({
    ...resultado.transaccion,
    tickets: resultado.tickets,
    codigos: resultado.tickets?.map((t) => t.codigo) ?? [],
  }));
}

export function misTransacciones() {
  return apiClient.get("/transacciones/me", { tokenAudience: "afiliado" });
}

// No existe GET /transacciones/me/{id} en el backend real — se deriva del
// listado completo (también real), que ya trae todos los campos.
export async function miTransaccion(id) {
  const rows = await misTransacciones();
  const trx = rows.find((t) => String(t.id) === String(id));
  if (!trx) throw new ApiError("Transacción no encontrada.", 404, null);
  return trx;
}

export function listarTransacciones({ cooperativaId } = {}) {
  const params = new URLSearchParams();
  if (cooperativaId) params.set("cooperativa_id", cooperativaId);
  const query = params.toString();
  return apiClient.get(`/transacciones${query ? `?${query}` : ""}`, { tokenAudience: "admin" });
}

// No existe GET /transacciones/{id} en el backend real — se deriva del
// listado completo (también real, ya scoped a la cooperativa por el JWT).
export async function obtenerTransaccion(id) {
  const rows = await listarTransacciones();
  const trx = rows.find((t) => String(t.id) === String(id));
  if (!trx) throw new ApiError("Transacción no encontrada.", 404, null);
  return trx;
}
