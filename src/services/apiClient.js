// Real apiClient — talks to the FastAPI backend (see ../../beet_backend)
// over plain fetch(). Single point of configuration: VITE_API_URL (see
// ../../.env / .env.example). No mock, no in-memory database: every call
// here is a real HTTP request.
//
// Two completely separate token stores mirror the backend's disjoint JWT
// identity spaces (see beet_backend/app/dependencies/auth.py:
// get_current_admin vs get_current_afiliado) — never mixed, never used to
// infer a role client-side. A 401 clears the matching token and fires
// `beetticket:session-expired`, which AuthContext/AffiliateAuthContext
// listen for to log the user out immediately instead of leaving a stale
// "authenticated" UI around a dead session.

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

const ADMIN_TOKEN_KEY = "beetticket_admin_token";
const AFILIADO_TOKEN_KEY = "beetticket_afiliado_token";
const COOPERATIVA_SCOPE_KEY = "beetticket_superadmin_cooperativa_id";

export const adminTokenStore = {
  get: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  set: (token) => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
};

export const afiliadoTokenStore = {
  get: () => localStorage.getItem(AFILIADO_TOKEN_KEY),
  set: (token) => localStorage.setItem(AFILIADO_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(AFILIADO_TOKEN_KEY),
};

// SUPER_ADMIN/GES don't belong to a cooperativa — this is the persistent
// "which cooperativa am I operating on" pick, mirrored by CooperativaContext.
// It's sent as `?cooperativa_id=` on the specific endpoints that accept it
// (see beet_backend app/dependencies/scope.py resolver_cooperativa_id) —
// never for ADMIN/LECTOR, whose scope the backend always derives from their
// own JWT and never from a query param.
export const cooperativaScopeStore = {
  get: () => sessionStorage.getItem(COOPERATIVA_SCOPE_KEY),
  set: (id) => sessionStorage.setItem(COOPERATIVA_SCOPE_KEY, String(id)),
  clear: () => sessionStorage.removeItem(COOPERATIVA_SCOPE_KEY),
};

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function tokenFor(tokenAudience) {
  if (tokenAudience === "admin") return adminTokenStore.get();
  if (tokenAudience === "afiliado") return afiliadoTokenStore.get();
  return null;
}

function sessionExpired(tokenAudience) {
  (tokenAudience === "admin" ? adminTokenStore : afiliadoTokenStore).clear();
  window.dispatchEvent(new CustomEvent("beetticket:session-expired", { detail: { tokenAudience } }));
}

// El backend expone errores como {"detail": "mensaje"} (HTTPException) o
// {"detail": [...]} (422 de validación de Pydantic/FastAPI) — nunca ambos a
// la vez. Normalizamos los dos casos a un mensaje legible para la UI.
function mensajeDeDetail(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const campo = Array.isArray(e?.loc) ? e.loc.filter((p) => p !== "body").join(".") : null;
        return campo ? `${campo}: ${e.msg}` : e?.msg;
      })
      .filter(Boolean)
      .join(" — ");
  }
  return null;
}

const MENSAJES_POR_STATUS = {
  400: "Solicitud inválida.",
  401: "Sesión inválida o expirada. Vuelve a iniciar sesión.",
  403: "No tienes permisos para esta operación.",
  404: "No se encontró el recurso solicitado.",
  409: "Conflicto: la operación no se pudo completar.",
  422: "Los datos enviados no son válidos.",
  500: "Ocurrió un error interno en el servidor. Intenta de nuevo más tarde.",
};

async function parseErrorResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Respuesta sin cuerpo JSON (por ejemplo, un 500 sin handler específico).
  }
  const detail = body?.detail ?? null;
  const mensaje = mensajeDeDetail(detail) || MENSAJES_POR_STATUS[response.status] || `Error HTTP ${response.status}.`;
  return new ApiError(mensaje, response.status, detail);
}

async function request(method, path, { body, tokenAudience, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData && body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenFor(tokenAudience);
  if (tokenAudience && !token) {
    // No hay token para la audiencia requerida: nunca dejamos que la
    // petición salga sin Authorization y falle con un 401 confuso — se
    // trata igual que una sesión expirada.
    throw new ApiError("No autenticado.", 401, "No autenticado.");
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (networkError) {
    throw new ApiError("No se pudo conectar con el servidor. Verifica tu conexión.", 0, String(networkError?.message || networkError));
  }

  if (!response.ok) {
    const error = await parseErrorResponse(response);
    if (response.status === 401 && tokenAudience) sessionExpired(tokenAudience);
    throw error;
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return null;
}

async function requestBlob(method, path, { tokenAudience } = {}) {
  const token = tokenFor(tokenAudience);
  if (tokenAudience && !token) throw new ApiError("No autenticado.", 401, "No autenticado.");
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers });
  } catch (networkError) {
    throw new ApiError("No se pudo conectar con el servidor. Verifica tu conexión.", 0, String(networkError?.message || networkError));
  }
  if (!response.ok) {
    const error = await parseErrorResponse(response);
    if (response.status === 401 && tokenAudience) sessionExpired(tokenAudience);
    throw error;
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : null;
  const blob = await response.blob();
  return { blob, filename };
}

export const apiClient = {
  get: (path, opts) => request("GET", path, opts),
  post: (path, body, opts) => request("POST", path, { ...opts, body }),
  patch: (path, body, opts) => request("PATCH", path, { ...opts, body }),
  delete: (path, opts) => request("DELETE", path, opts),
  postForm: (path, formData, opts) => request("POST", path, { ...opts, body: formData, isFormData: true }),
  postFormBlob: async (path, formData, opts) => {
    // No hay ningún endpoint real hoy que devuelva un blob desde un POST
    // multipart (los que existían en el mock — preview de plantillas HTML —
    // no tienen equivalente en el backend real, ver informe de integración).
    throw new ApiError("Esta función no está disponible: el backend actual no expone este endpoint.", 501, null);
  },
  getBlob: async (path, opts) => (await requestBlob("GET", path, opts)).blob,
  getBlobWithFilename: async (path, opts, fallbackFilename = "descarga") => {
    const { blob, filename } = await requestBlob("GET", path, opts);
    return { blob, filename: filename || fallbackFilename };
  },
};
