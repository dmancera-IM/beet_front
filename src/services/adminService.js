// Real cooperativas + usuarios administrativos + bolsa/crédito, backed by
// beet_backend/app/routers/{cooperativas,usuarios,financiero}.py.
//
// `cooperativaId` is only ever meaningful for a SUPER_ADMIN/GES (the only
// roles that can see more than their own cooperativa) — the real backend
// reads an ADMIN/LECTOR's scope from their JWT, never from a request
// param (see beet_backend/app/dependencies/scope.py). Passing
// `cooperativaId` here for a SUPER_ADMIN/GES is what lets them pick which
// cooperativa an operation applies to.
import { apiClient, ApiError } from "./apiClient";

// ---- Usuarios administrativos (GET/POST/PATCH /usuarios) -------------------
//
// NOTA sobre `q` (búsqueda libre): el backend real no soporta este
// parámetro (solo filtra por id_cooperativa/rol) — se filtra aquí mismo,
// en el cliente, sobre la lista ya traída, para no inventar un parámetro
// que el backend no expone.
export async function listarUsuariosAdmin(cooperativaId, { estado, q, rol } = {}) {
  const params = new URLSearchParams();
  if (cooperativaId) params.set("id_cooperativa", cooperativaId);
  if (rol) params.set("rol", rol);
  const query = params.toString();
  const usuarios = await apiClient.get(`/usuarios${query ? `?${query}` : ""}`, { tokenAudience: "admin" });

  let rows = usuarios;
  if (estado !== undefined && estado !== null && estado !== "") {
    const estadoBool = estado === true || estado === "true";
    rows = rows.filter((u) => u.estado === estadoBool);
  }
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    rows = rows.filter((u) => u.nombre.toLowerCase().includes(term) || u.correo.toLowerCase().includes(term));
  }

  // El backend no devuelve `cooperativa_nombre` (solo `id_cooperativa`) —
  // se enriquece aquí con la lista de cooperativas para no perder esa
  // columna de la tabla existente.
  const cooperativas = await listarCooperativas().catch(() => []);
  const nombrePorId = new Map(cooperativas.map((c) => [c.id, c.nombre]));
  return rows.map((u) => ({
    ...u,
    cooperativa_id: u.id_cooperativa,
    cooperativa_nombre: u.id_cooperativa ? nombrePorId.get(u.id_cooperativa) ?? null : null,
  }));
}

export function crearUsuarioAdmin({ nombre, correo, password, rol, cooperativa_id }) {
  return apiClient.post(
    "/usuarios",
    { nombre, correo, password, rol, id_cooperativa: cooperativa_id ?? null },
    { tokenAudience: "admin" }
  );
}

export function actualizarUsuarioAdmin(id, payload) {
  // El backend solo acepta nombre/estado/password en PATCH /usuarios/{id}
  // (nunca rol ni id_cooperativa — evita romper el CHECK de la tabla).
  const { nombre, estado, password } = payload;
  return apiClient.patch(`/usuarios/${id}`, { nombre, estado, password }, { tokenAudience: "admin" });
}

// PENDIENTE: el backend real no expone DELETE /usuarios/{id} (decisión
// documentada: borrar un usuario rompería el historial de
// solicitudes_compra.id_usuario). Usa `actualizarUsuarioAdmin(id, {estado:
// false})` para revocar el acceso en su lugar.
export function eliminarUsuarioAdmin() {
  return Promise.reject(
    new ApiError("Eliminar usuarios no está disponible: el backend actual no expone este endpoint. Usa \"Desactivar acceso\".", 501, null)
  );
}

// ---- Cooperativas (GET/POST/PATCH /cooperativas) ----------------------------

export function listarCooperativas() {
  return apiClient.get("/cooperativas", { tokenAudience: "admin" });
}

export function crearCooperativa(payload) {
  return apiClient.post("/cooperativas", payload, { tokenAudience: "admin" });
}

export function obtenerCooperativa(id) {
  return apiClient.get(`/cooperativas/${id}`, { tokenAudience: "admin" });
}

export function actualizarCooperativa(id, payload) {
  return apiClient.patch(`/cooperativas/${id}`, payload, { tokenAudience: "admin" });
}

// ---- Bolsa / Crédito (GET/PATCH /cooperativas/{id}/bolsa|credito) -----------

export function obtenerBolsa(cooperativaId) {
  return apiClient.get(`/cooperativas/${cooperativaId}/bolsa`, { tokenAudience: "admin" });
}

export function fijarBolsa(cooperativaId, valor) {
  return apiClient.patch(`/cooperativas/${cooperativaId}/bolsa`, { valor }, { tokenAudience: "admin" });
}

export function obtenerCredito(cooperativaId) {
  return apiClient.get(`/cooperativas/${cooperativaId}/credito`, { tokenAudience: "admin" });
}

export function fijarCredito(cooperativaId, cupo_autorizado) {
  return apiClient.patch(`/cooperativas/${cooperativaId}/credito`, { cupo_autorizado }, { tokenAudience: "admin" });
}

export async function listarLogsAuditoria({ page = 1, pageSize = 20, cooperativaId, tablaAfectada, fechaInicio, fechaFin } = {}) {
  const params = new URLSearchParams();
  if (cooperativaId) params.set("cooperativa_id", cooperativaId);
  if (tablaAfectada) params.set("tabla_afectada", tablaAfectada);
  if (fechaInicio) params.set("fecha_inicio", fechaInicio);
  if (fechaFin) params.set("fecha_fin", fechaFin);
  const query = params.toString();
  const rows = await apiClient.get(`/logs-auditoria${query ? `?${query}` : ""}`, { tokenAudience: "admin" });
  const normalized = rows.map((r) => ({ ...r, created_at: r.fecha_creacion }));
  const start = (page - 1) * pageSize;
  return { items: normalized.slice(start, start + pageSize), total: normalized.length, page, page_size: pageSize };
}
