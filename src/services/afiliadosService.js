// Afiliados reales (beet_backend/app/routers/afiliados.py). Solo ADMIN
// puede crear/editar (el backend obtiene su cooperativa del JWT, nunca del
// body); GES/SUPER_ADMIN/LECTOR también pueden listar/consultar.
import { apiClient } from "./apiClient";

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

// Retiro/desactivación funcional: no borra físicamente la fila para no romper
// historial de transacciones/tickets/cupos. La purga definitiva a 30 días debe
// hacerse con un job backend separado.
export function eliminarAfiliado(id) {
  return actualizarAfiliado(id, { estado: false });
}

// Carga masiva real: el backend (POST /afiliados/carga-masiva) parsea el
// Excel del lado del servidor y hace upsert por (cooperativa, documento) —
// el ADMIN autenticado nunca envía cooperativa_id, el backend la toma del
// JWT. Traduce {creados, actualizados, errores:[{fila, motivo}]} a la forma
// que ya esperan las pantallas de Afiliados (detail/invalidos/errores como
// strings).
export async function cargaMasivaAfiliados(file) {
  const formData = new FormData();
  formData.append("archivo", file);
  const resultado = await apiClient.postForm("/afiliados/carga-masiva", formData, { tokenAudience: "admin" });
  const invalidos = resultado.errores.length;
  const detail = `${resultado.creados} creado(s), ${resultado.actualizados} actualizado(s)` + (invalidos ? `, ${invalidos} fila(s) con error.` : ".");
  return {
    creados: resultado.creados,
    actualizados: resultado.actualizados,
    invalidos,
    detail,
    errores: resultado.errores.map((e) => `Fila ${e.fila}: ${e.motivo}`),
  };
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
