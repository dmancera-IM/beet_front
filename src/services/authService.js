// Real admin + affiliate authentication against the FastAPI backend
// (beet_backend/app/routers/auth.py). Every call here hits a real endpoint.
import { adminTokenStore, afiliadoTokenStore, apiClient, ApiError } from "./apiClient";

export async function adminLogin(correo, password) {
  const data = await apiClient.post("/auth/login", { correo, password });
  adminTokenStore.set(data.access_token);
  return data.usuario;
}

export function adminLogout() {
  adminTokenStore.clear();
}

export function getAdminMe() {
  return apiClient.get("/auth/me", { tokenAudience: "admin" });
}

// PENDIENTE: el backend actual no expone recuperación de contraseña
// (no hay /auth/forgot-password ni /auth/reset-password, ni para admin ni
// para afiliado) — ver informe de integración. Se deja documentado aquí en
// vez de simularlo, para que ForgotPassword.jsx (página no enrutada
// actualmente en App.jsx) falle de forma explícita si algún día se conecta.
function noDisponible(nombre) {
  return Promise.reject(new ApiError(`"${nombre}" no está disponible: el backend actual no expone este endpoint.`, 501, null));
}

export function adminForgotPassword() {
  return noDisponible("Recuperar contraseña (admin)");
}

export function adminResetPassword() {
  return noDisponible("Restablecer contraseña (admin)");
}

export async function afiliadoLogin(correo, password) {
  const data = await apiClient.post("/auth/afiliado/login", { correo, password });
  afiliadoTokenStore.set(data.access_token);
  return data.afiliado;
}

export function afiliadoLogout() {
  afiliadoTokenStore.clear();
}

export function getAfiliadoMe() {
  return apiClient.get("/auth/afiliado/me", { tokenAudience: "afiliado" });
}

// Activación real de cuenta: la cooperativa ya creó la fila del afiliado
// (sin password_hash); esto valida documento+correo contra esa fila y fija
// su contraseña — equivalente real al "registro" que la UI ya tenía.
export function afiliadoRegistro(documento, correo, password, confirmar_password) {
  if (password !== confirmar_password) {
    return Promise.reject(new ApiError("Las contraseñas no coinciden.", 422, "Las contraseñas no coinciden."));
  }
  return apiClient.post("/auth/afiliado/activar-cuenta", { documento, correo, password });
}

export function afiliadoForgotPassword() {
  return noDisponible("Recuperar contraseña (afiliado)");
}

export function afiliadoResetPassword() {
  return noDisponible("Restablecer contraseña (afiliado)");
}
