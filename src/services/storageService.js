// Storage GES real (beet_backend/app/routers/storage.py) — GES/SUPER_ADMIN
// only. El backend NO tiene un parser de Excel/XML definido todavía (ver
// NOTA en ese router): `cargarCodigos` envía la lista de códigos ya
// extraída como JSON (`POST /storage/bulk`), nunca un archivo.
import { apiClient } from "./apiClient";

export function listarStorage({ idProducto, estado } = {}) {
  const params = new URLSearchParams();
  if (idProducto) params.set("id_producto", idProducto);
  if (estado) params.set("estado", estado);
  const query = params.toString();
  return apiClient.get(`/storage${query ? `?${query}` : ""}`, { tokenAudience: "admin" });
}

export function cargarCodigo({ idProducto, codigo, fechaVencimiento }) {
  return apiClient.post(
    "/storage",
    { id_producto: idProducto, codigo, fecha_vencimiento: fechaVencimiento ?? null },
    { tokenAudience: "admin" }
  );
}

// `codigos`: string[] — cada código tal cual, uno por línea en la UI de
// carga (ver Storage.jsx). No genera ni prefija nada.
export function cargarCodigosEnLote({ idProducto, codigos, fechaVencimiento }) {
  return apiClient.post(
    "/storage/bulk",
    { id_producto: idProducto, codigos, fecha_vencimiento: fechaVencimiento ?? null },
    { tokenAudience: "admin" }
  );
}
