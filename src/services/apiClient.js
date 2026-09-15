// MOCK apiClient — this copy of the frontend runs with NO backend.
//
// Every page/component/context in this project is UNCHANGED from the
// original: they all still import { apiClient, ApiError, adminTokenStore,
// afiliadoTokenStore, cooperativaScopeStore } from this exact file and
// call apiClient.get/post/patch/delete/postForm/postFormBlob/getBlob/
// getBlobWithFilename exactly like before. Only what happens INSIDE this
// file changed: instead of `fetch()`-ing a real FastAPI backend, every
// call is resolved against the in-memory mock database in ./mockDb.js.
//
// See ./mockDb.js for the seed data (demo users, cooperativas, convenios,
// afiliados, inventario, transacciones, etc.) and README.GES_FRONT.md at
// the project root for demo credentials.

import * as db from "./mockDb";

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

export const cooperativaScopeStore = {
  get: () => sessionStorage.getItem(COOPERATIVA_SCOPE_KEY),
  set: (id) => sessionStorage.setItem(COOPERATIVA_SCOPE_KEY, String(id)),
  clear: () => sessionStorage.removeItem(COOPERATIVA_SCOPE_KEY),
};

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// Small artificial delay so LoadingState/spinners are still visible —
// purely cosmetic, keeps the existing loading UI meaningful.
const delay = (ms = 220 + Math.random() * 220) => new Promise((r) => setTimeout(r, ms));

function sessionExpired(tokenAudience) {
  (tokenAudience === "admin" ? adminTokenStore : afiliadoTokenStore).clear();
  window.dispatchEvent(new CustomEvent("beetticket:session-expired", { detail: { tokenAudience } }));
}

function currentAdmin({ required = true } = {}) {
  const token = adminTokenStore.get();
  const id = token && token.startsWith("admin:") ? Number(token.slice(6)) : null;
  const admin = id != null ? db.admins.find((a) => a.id === id && a.estado) : null;
  if (!admin && required) {
    if (token) sessionExpired("admin");
    throw new ApiError("No autenticado.", 401, "No autenticado.");
  }
  return admin ?? null;
}

function currentAfiliado({ required = true } = {}) {
  const token = afiliadoTokenStore.get();
  const id = token && token.startsWith("afiliado:") ? Number(token.slice(9)) : null;
  const afiliado = id != null ? db.afiliados.find((a) => a.id === id && a.estado) : null;
  if (!afiliado && required) {
    if (token) sessionExpired("afiliado");
    throw new ApiError("No autenticado.", 401, "No autenticado.");
  }
  return afiliado ?? null;
}

function resolveScope(admin) {
  if (admin.rol === "SUPER_ADMIN") {
    const stored = cooperativaScopeStore.get();
    return stored ? Number(stored) : null;
  }
  return admin.cooperativa_id;
}

function paginate(items, params) {
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("page_size") || 20);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, page_size: pageSize };
}

function adminOut(a) {
  return { id: a.id, nombre: a.nombre, correo: a.correo, rol: a.rol, cooperativa_id: a.cooperativa_id };
}

function afiliadoConCooperativa(a) {
  return { ...db.afiliadoConCupo(a), cooperativa_nombre: db.cooperativaNombre(a.cooperativa_id) };
}

function usuarioAdminOut(a) {
  return { ...a, cooperativa_nombre: db.cooperativaNombre(a.cooperativa_id) };
}

// ---------------------------------------------------------------------------
// Plantillas — mutual-exclusivity helper shared by convenio patch + plantilla patch
// ---------------------------------------------------------------------------

function setPlantillaActiva(convenioId, activa /* {tipo,id,nombre} | null */) {
  db.plantillasPersonalizadas.forEach((p) => {
    if (p.convenio_id === convenioId) p.en_uso = activa?.tipo === "personalizada" && p.id === activa.id;
  });
  const conv = db.convenios.find((c) => c.id === convenioId);
  if (conv) conv.plantilla_en_uso = activa ? activa.nombre : null;
}

function plantillasDisponiblesDe(convenioId) {
  const conv = db.convenios.find((c) => c.id === convenioId);
  const catalogo = db.catalogoPlantillas.map((c) => ({
    tipo: "catalogo",
    clave: c.clave,
    nombre: c.nombre,
    en_uso: conv?.plantilla_en_uso === c.nombre,
  }));
  const personalizadas = db.plantillasPersonalizadas
    .filter((p) => p.convenio_id === convenioId)
    .map((p) => ({ tipo: "personalizada", id: p.id, nombre: p.nombre, version: p.version, en_uso: p.en_uso }));
  return [...catalogo, ...personalizadas];
}

// ---------------------------------------------------------------------------
// Fake binary payloads — enough for URL.createObjectURL()/window.open() to
// work without crashing; not meant to be pixel-perfect documents.
// ---------------------------------------------------------------------------

function fakePdfBlob(titulo = "BEET Ticket - documento de muestra") {
  const texto = titulo.replace(/[()\\]/g, " ").slice(0, 60);
  const stream = `BT /F1 16 Tf 24 110 Td (${texto}) Tj ET`;
  const pdf = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 320 160]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${stream.length}>>stream
${stream}
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Size 6/Root 1 0 R>>
%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function fakeXlsxBlob() {
  return new Blob(["Generado por la copia de demostración BEET_TICKET_GES_FRONT (sin backend).\n"], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ---------------------------------------------------------------------------
// Compra (transacciones.comprar) — replica la simulación de pasarela que la
// propia pantalla PurchaseFlow ya documenta en su hint de desarrollo.
// ---------------------------------------------------------------------------

function ejecutarCompra(afiliado, { convenio_id, cantidad, metodo_pago, numero_cuotas, firma_base64, numero_tarjeta }) {
  const convenio = db.convenios.find((c) => c.id === Number(convenio_id) && c.cooperativa_id === afiliado.cooperativa_id && c.estado);
  if (!convenio) throw new ApiError("Este beneficio ya no está disponible.", 404, "Convenio no encontrado.");

  const subtotal = convenio.precio_beet * cantidad;
  const total = subtotal;

  if (metodo_pago === "CUPO") {
    const cupo = db.cupoDe(afiliado.id);
    if (!cupo || !cupo.estado) throw new ApiError("No tienes un cupo de crédito activo.", 400, "Sin cupo activo.");
    if (total > cupo.cupo_disponible) throw new ApiError("Saldo de cupo insuficiente.", 400, "Saldo de cupo insuficiente.");
    if (!firma_base64) throw new ApiError("La firma es obligatoria para pagar con cupo.", 422, "Falta la firma.");
  }

  let estado = "COMPLETADA";
  let resultado_pago = "aprobado";
  let motivo_rechazo = null;
  let referencia_pago = null;

  if (metodo_pago === "TARJETA") {
    const last4 = String(numero_tarjeta || "").slice(-4);
    if (last4 === "0001") {
      estado = "RECHAZADA";
      resultado_pago = "rechazado_fondos";
      motivo_rechazo = "Fondos insuficientes.";
    } else if (last4 === "0002") {
      estado = "RECHAZADA";
      resultado_pago = "rechazado_invalida";
      motivo_rechazo = "Tarjeta inválida o vencida.";
    } else if (last4 === "0003") {
      throw new ApiError("La pasarela de pago no respondió a tiempo. Intenta nuevamente.", 502, "Timeout de la pasarela.");
    } else {
      referencia_pago = `AUTH-${Math.floor(10000 + Math.random() * 89999)}`;
    }
  }

  if (estado === "RECHAZADA") {
    const trx = {
      id: db.newId("transaccion"), afiliado_id: afiliado.id, convenio_id: convenio.id, cantidad, subtotal, total,
      metodo_pago, numero_cuotas: numero_cuotas ?? null, estado, codigos: [], created_at: db.todayISO(),
      referencia_pago, motivo_rechazo, resultado_pago,
    };
    db.transacciones.push(trx);
    return trx;
  }

  // Assign `cantidad` units: prefer already-"disponible" seeded codes (more
  // realistic), synthesizing extra ones only if the demo pool runs out.
  const codigos = [];
  const disponibles = db.unidadesInventario.filter((u) => u.convenio_id === convenio.id && u.estado === "disponible");
  for (let i = 0; i < cantidad; i++) {
    const unidad = disponibles[i];
    if (unidad) {
      unidad.estado = "entregada";
      codigos.push(unidad.codigo);
    } else {
      const codigo = `${convenio.nombre.slice(0, 3).toUpperCase()}-${db.newId("unidad")}`;
      db.unidadesInventario.push({ id: db.newId("unidad"), convenio_id: convenio.id, codigo, estado: "entregada", fecha_ingreso: db.dateOnly() });
      codigos.push(codigo);
    }
    db.tickets.push({ id: db.newId("ticket"), afiliado_id: afiliado.id, convenio_id: convenio.id, codigo: codigos[i], estado: "entregada" });
  }

  const trx = {
    id: db.newId("transaccion"), afiliado_id: afiliado.id, convenio_id: convenio.id, cantidad, subtotal, total,
    metodo_pago, numero_cuotas: numero_cuotas ?? null, estado, codigos, created_at: db.todayISO(),
    referencia_pago, motivo_rechazo, resultado_pago,
  };
  db.transacciones.push(trx);

  if (metodo_pago === "CUPO") {
    const cupo = db.cupoDe(afiliado.id);
    cupo.cupo_disponible -= total;
    db.documentos.push({
      id: db.newId("documento"), afiliado_id: afiliado.id, convenio_id: convenio.id, transaccion_id: trx.id,
      convenio_nombre: convenio.nombre, valor: total, numero_cuotas, fecha_generacion: db.todayISO(),
      fecha_firma: db.todayISO(), estado: "FIRMADO",
    });
  }

  db.logsAuditoria.unshift({
    id: db.newId("log"), cooperativa_id: afiliado.cooperativa_id, accion: "compra_completada",
    tabla_afectada: "transacciones", registro_id: trx.id, created_at: db.todayISO(),
  });

  return trx;
}

// ---------------------------------------------------------------------------
// Router — one entry per real endpoint used anywhere in src/services/*.js
// ---------------------------------------------------------------------------

async function handle(method, fullPath, body) {
  const [pathname, queryString] = fullPath.split("?");
  const q = new URLSearchParams(queryString || "");
  const seg = pathname.split("/").filter(Boolean); // ['api', 'afiliados', '12'] etc.
  const is = (...parts) => seg.length === parts.length && parts.every((p, i) => p === "*" || p === seg[i]);
  const idAt = (i) => Number(seg[i]);

  // ---- AUTH -----------------------------------------------------------
  if (is("api", "auth", "admin", "login") && method === "POST") {
    const admin = db.admins.find((a) => a.correo.toLowerCase() === String(body.correo || "").trim().toLowerCase());
    if (!admin) throw new ApiError("Credenciales incorrectas.", 401, "Credenciales incorrectas.");
    if (!admin.estado) throw new ApiError("Tu usuario está desactivado.", 403, "Usuario desactivado.");
    return { access_token: `admin:${admin.id}`, usuario: adminOut(admin) };
  }
  if (is("api", "auth", "admin", "me") && method === "GET") return adminOut(currentAdmin());
  if (is("api", "auth", "admin", "forgot-password") && method === "POST") return { detail: "Si el correo existe, se enviaron instrucciones." };
  if (is("api", "auth", "admin", "reset-password") && method === "POST") return { detail: "Contraseña actualizada." };

  if (is("api", "auth", "afiliado", "login") && method === "POST") {
    const afiliado = db.afiliados.find((a) => a.correo.toLowerCase() === String(body.correo || "").trim().toLowerCase());
    if (!afiliado) throw new ApiError("Credenciales incorrectas.", 401, "Credenciales incorrectas.");
    if (!afiliado.estado) throw new ApiError("Tu cuenta está inactiva. Contacta a tu cooperativa.", 403, "Afiliado inactivo.");
    return { access_token: `afiliado:${afiliado.id}`, afiliado: afiliadoConCooperativa(afiliado) };
  }
  if (is("api", "auth", "afiliado", "me") && method === "GET") return afiliadoConCooperativa(currentAfiliado());
  if (is("api", "auth", "afiliado", "registro") && method === "POST") {
    const { documento, correo, password, confirmar_password } = body;
    if (password !== confirmar_password) throw new ApiError("Las contraseñas no coinciden.", 422, "Las contraseñas no coinciden.");
    const matches = (doc, mail) => String(doc).trim() === String(documento).trim() && String(mail).toLowerCase() === String(correo).trim().toLowerCase();
    const rosterMatch = db.afiliados.some((a) => matches(a.documento, a.correo)) || matches(db.afiliadoPendienteActivacion.documento, db.afiliadoPendienteActivacion.correo);
    if (!rosterMatch) throw new ApiError("No encontramos un afiliado con ese documento y correo.", 400, "No encontrado.");
    return { detail: "Cuenta activada correctamente. Ya puedes iniciar sesión." };
  }
  if (is("api", "auth", "afiliado", "forgot-password") && method === "POST") return { detail: "Si el correo existe, se enviaron instrucciones." };
  if (is("api", "auth", "afiliado", "reset-password") && method === "POST") return { detail: "Contraseña actualizada." };

  // ---- ADMIN: usuarios / cooperativas / logs ---------------------------
  if (is("api", "admin", "usuarios") && method === "GET") {
    currentAdmin();
    let rows = db.admins;
    const coopId = q.get("cooperativa_id");
    if (coopId) rows = rows.filter((a) => a.cooperativa_id === Number(coopId));
    const estado = q.get("estado");
    if (estado !== null && estado !== "") rows = rows.filter((a) => String(a.estado) === estado);
    const term = (q.get("q") || "").trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (a) => a.nombre.toLowerCase().includes(term) || a.correo.toLowerCase().includes(term) || (db.cooperativaNombre(a.cooperativa_id) || "").toLowerCase().includes(term)
      );
    }
    return rows.map(usuarioAdminOut);
  }
  if (is("api", "admin", "usuarios") && method === "POST") {
    currentAdmin();
    if (db.admins.some((a) => a.correo.toLowerCase() === String(body.correo).toLowerCase())) {
      throw new ApiError("Ya existe un usuario con ese correo.", 409, "Correo duplicado.");
    }
    const usuario = { id: db.newId("admin"), nombre: body.nombre, correo: body.correo, rol: body.rol, cooperativa_id: body.cooperativa_id ?? null, estado: true };
    db.admins.push(usuario);
    return usuarioAdminOut(usuario);
  }
  if (is("api", "admin", "usuarios", "*") && method === "PATCH") {
    currentAdmin();
    const usuario = db.admins.find((a) => a.id === idAt(3));
    if (!usuario) throw new ApiError("Usuario no encontrado.", 404, "No encontrado.");
    Object.assign(usuario, body);
    return usuarioAdminOut(usuario);
  }
  if (is("api", "admin", "usuarios", "*") && method === "DELETE") {
    currentAdmin();
    const idx = db.admins.findIndex((a) => a.id === idAt(3));
    if (idx >= 0) db.admins.splice(idx, 1);
    return null;
  }
  if (is("api", "admin", "cooperativas") && method === "GET") {
    currentAdmin();
    return db.cooperativas;
  }
  if (is("api", "admin", "cooperativas") && method === "POST") {
    currentAdmin();
    if (db.cooperativas.some((c) => c.nit === body.nit)) throw new ApiError("Ya existe una cooperativa con ese NIT.", 409, "NIT duplicado.");
    const coop = { id: db.newId("cooperativa"), nombre: body.nombre, nit: body.nit, estado: true };
    db.cooperativas.push(coop);
    return coop;
  }
  if (is("api", "admin", "cooperativa") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    if (!scope) throw new ApiError("Selecciona una cooperativa.", 400, "Sin cooperativa seleccionada.");
    const coop = db.cooperativas.find((c) => c.id === scope);
    if (!coop) throw new ApiError("Cooperativa no encontrada.", 404, "No encontrada.");
    return coop;
  }
  if (is("api", "admin", "cooperativa") && method === "PATCH") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    if (!scope) throw new ApiError("Selecciona una cooperativa.", 400, "Sin cooperativa seleccionada.");
    const coop = db.cooperativas.find((c) => c.id === scope);
    if (!coop) throw new ApiError("Cooperativa no encontrada.", 404, "No encontrada.");
    Object.assign(coop, body);
    return coop;
  }
  if (is("api", "admin", "logs") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const rows = db.logsAuditoria.filter((l) => l.cooperativa_id === scope);
    return paginate(rows, q);
  }

  // ---- AFILIADOS --------------------------------------------------------
  if (is("api", "afiliados") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    let rows = db.afiliados.filter((a) => a.cooperativa_id === scope);
    const estado = q.get("estado");
    if (estado) rows = rows.filter((a) => String(a.estado) === estado);
    const term = (q.get("q") || "").trim().toLowerCase();
    if (term) rows = rows.filter((a) => `${a.nombres} ${a.apellidos} ${a.documento} ${a.correo}`.toLowerCase().includes(term));
    const page = paginate(rows, q);
    return { ...page, items: page.items.map(db.afiliadoConCupo) };
  }
  if (is("api", "afiliados", "me") && method === "GET") return afiliadoConCooperativa(currentAfiliado());
  if (is("api", "afiliados", "me") && method === "PATCH") {
    const afiliado = currentAfiliado();
    Object.assign(afiliado, { correo: body.correo ?? afiliado.correo, telefono: body.telefono ?? afiliado.telefono });
    return afiliadoConCooperativa(afiliado);
  }
  if (is("api", "afiliados", "carga-masiva") && method === "POST") {
    currentAdmin();
    const file = body.get("file");
    return { detail: `Se procesó "${file?.name ?? "el archivo"}" correctamente.`, invalidos: 0, cambios: [], errores: [] };
  }
  if (is("api", "afiliados", "*") && method === "GET") {
    currentAdmin();
    const afiliado = db.afiliados.find((a) => a.id === idAt(2));
    if (!afiliado) throw new ApiError("Afiliado no encontrado.", 404, "No encontrado.");
    return db.afiliadoConCupo(afiliado);
  }
  if (is("api", "afiliados") && method === "POST") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    if (db.afiliados.some((a) => a.cooperativa_id === scope && a.documento === body.documento)) {
      throw new ApiError("Ya existe un afiliado con ese documento en esta cooperativa.", 409, "Documento duplicado.");
    }
    const afiliado = { id: db.newId("afiliado"), estado: true, cooperativa_id: scope, ...body };
    db.afiliados.push(afiliado);
    return db.afiliadoConCupo(afiliado);
  }
  if (is("api", "afiliados", "*") && method === "PATCH") {
    currentAdmin();
    const afiliado = db.afiliados.find((a) => a.id === idAt(2));
    if (!afiliado) throw new ApiError("Afiliado no encontrado.", 404, "No encontrado.");
    Object.assign(afiliado, body);
    return db.afiliadoConCupo(afiliado);
  }

  // ---- CONVENIOS ----------------------------------------------------------
  if (is("api", "convenios", "catalogo") && method === "GET") {
    const afiliado = currentAfiliado();
    return db.convenios.filter((c) => c.cooperativa_id === afiliado.cooperativa_id && c.estado).map(db.convenioPublico);
  }
  if (is("api", "convenios", "exportar") && method === "GET") {
    currentAdmin();
    return { __blob: fakeXlsxBlob(), __filename: "convenios.xlsx" };
  }
  if (is("api", "convenios") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    let rows = db.convenios.filter((c) => c.cooperativa_id === scope);
    const estado = q.get("estado");
    if (estado) rows = rows.filter((c) => String(c.estado) === estado);
    return paginate(rows, q);
  }
  if (is("api", "convenios") && method === "POST") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const convenio = { id: db.newId("convenio"), cooperativa_id: scope, plantilla_en_uso: null, imagen_marca_url: null, ...body };
    db.convenios.push(convenio);
    return convenio;
  }
  if (is("api", "convenios", "carga-masiva") && method === "POST") {
    currentAdmin();
    const file = body.get("file");
    return { detail: `Se procesó "${file?.name ?? "el archivo"}" correctamente.`, invalidos: 0, cambios: [], errores: [] };
  }
  if (is("api", "convenios", "*") && method === "GET") {
    currentAdmin();
    const convenio = db.convenios.find((c) => c.id === idAt(2));
    if (!convenio) throw new ApiError("Convenio no encontrado.", 404, "No encontrado.");
    return convenio;
  }
  if (is("api", "convenios", "*") && method === "PATCH") {
    currentAdmin();
    const convenio = db.convenios.find((c) => c.id === idAt(2));
    if (!convenio) throw new ApiError("Convenio no encontrado.", 404, "No encontrado.");
    if (Object.prototype.hasOwnProperty.call(body, "plantilla_catalogo_clave")) {
      const clave = body.plantilla_catalogo_clave;
      const catalogo = clave ? db.catalogoPlantillas.find((c) => c.clave === clave) : null;
      setPlantillaActiva(convenio.id, catalogo ? { tipo: "catalogo", nombre: catalogo.nombre } : null);
      const { plantilla_catalogo_clave, ...rest } = body;
      void plantilla_catalogo_clave;
      Object.assign(convenio, rest);
    } else {
      Object.assign(convenio, body);
    }
    return convenio;
  }

  // ---- CUPOS ----------------------------------------------------------
  if (is("api", "cupos", "me") && method === "GET") {
    const afiliado = currentAfiliado();
    const cupo = db.cupoDe(afiliado.id);
    if (!cupo) throw new ApiError("No tienes un cupo asignado.", 404, "No encontrado.");
    return cupo;
  }
  if (is("api", "cupos", "asignacion-masiva") && method === "POST") {
    currentAdmin();
    const { afiliado_ids, cupo_total } = body;
    afiliado_ids.forEach((id) => {
      const existing = db.cupoDe(id);
      if (existing) Object.assign(existing, { cupo_total, cupo_disponible: cupo_total, estado: true });
      else db.cupos.push({ afiliado_id: id, cupo_total, cupo_disponible: cupo_total, estado: true });
    });
    return { detail: `Se asignó cupo a ${afiliado_ids.length} afiliado(s).` };
  }
  if (is("api", "cupos", "*") && method === "GET") {
    currentAdmin();
    const cupo = db.cupoDe(idAt(2));
    if (!cupo) throw new ApiError("Este afiliado no tiene cupo asignado.", 404, "No encontrado.");
    return cupo;
  }
  if (is("api", "cupos", "*") && method === "PATCH") {
    currentAdmin();
    const afiliadoId = idAt(2);
    let cupo = db.cupoDe(afiliadoId);
    if (!cupo) {
      cupo = { afiliado_id: afiliadoId, cupo_total: 0, cupo_disponible: 0, estado: true };
      db.cupos.push(cupo);
    }
    if (body.cupo_total !== undefined && body.cupo_disponible === undefined && !("estado" in body && Object.keys(body).length === 1)) {
      // Editing the total from the UI form resets available balance to the new total (fresh assignment), matching CupoFormModal's intent.
      cupo.cupo_disponible = body.cupo_total;
    }
    Object.assign(cupo, body);
    return cupo;
  }

  // ---- DASHBOARD --------------------------------------------------------
  if (is("api", "dashboard", "stats") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const conveniosScope = db.convenios.filter((c) => c.cooperativa_id === scope);
    const afiliadosScope = db.afiliados.filter((a) => a.cooperativa_id === scope).map((a) => a.id);
    const trxScope = db.transacciones.filter((t) => afiliadosScope.includes(t.afiliado_id) && t.estado === "COMPLETADA");
    const ventasTarjeta = trxScope.filter((t) => t.metodo_pago === "TARJETA").reduce((s, t) => s + t.total, 0);
    const ventasCupo = trxScope.filter((t) => t.metodo_pago === "CUPO").reduce((s, t) => s + t.total, 0);
    const ventasTotal = ventasTarjeta + ventasCupo;
    const ahorro = trxScope.reduce((s, t) => {
      const c = db.convenios.find((x) => x.id === t.convenio_id);
      return s + (c ? (c.precio_publico - c.precio_beet) * t.cantidad : 0);
    }, 0);
    const en30dias = new Date();
    en30dias.setDate(en30dias.getDate() + 30);
    return {
      ventas_del_mes: ventasTotal,
      ahorro_generado: ahorro,
      convenios_por_vencer: conveniosScope.filter((c) => c.estado && c.fecha_fin && new Date(c.fecha_fin) <= en30dias).length,
      convenios_activos: conveniosScope.filter((c) => c.estado).length,
      ventas_por_forma_de_pago: {
        tarjeta: ventasTarjeta,
        cupo: ventasCupo,
        pct_tarjeta: ventasTotal ? Math.round((ventasTarjeta / ventasTotal) * 100) : 0,
        pct_cupo: ventasTotal ? Math.round((ventasCupo / ventasTotal) * 100) : 0,
      },
      unidades_proximas_a_vencer: 0,
    };
  }

  // ---- DOCUMENTOS -------------------------------------------------------
  if (is("api", "documentos", "me") && method === "GET") {
    const afiliado = currentAfiliado();
    return paginate(db.documentos.filter((d) => d.afiliado_id === afiliado.id), q);
  }
  if (is("api", "documentos", "me", "*", "descarga") && method === "GET") {
    currentAfiliado();
    return { __blob: fakePdfBlob("Documento de asunción de deuda") };
  }
  if (is("api", "documentos", "legales", "buscar") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const documento = (q.get("documento") || "").trim();
    const nombresBuscados = (q.get("nombres") || "").trim().toLowerCase();
    const afiliado = db.afiliados.find((a) => a.cooperativa_id === scope && a.documento === documento);
    if (!afiliado) return { afiliado: null, documentos: [] };
    const nombreCompleto = `${afiliado.nombres} ${afiliado.apellidos}`.toLowerCase();
    const nombre_coincide = !nombresBuscados || nombreCompleto.includes(nombresBuscados);
    const documentos = db.documentos.filter((d) => d.afiliado_id === afiliado.id);
    return { afiliado: { ...afiliado, nombre_coincide }, documentos };
  }
  if (is("api", "documentos") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const afiliadosScope = db.afiliados.filter((a) => a.cooperativa_id === scope).map((a) => a.id);
    return paginate(db.documentos.filter((d) => afiliadosScope.includes(d.afiliado_id)), q);
  }
  if (is("api", "documentos", "*", "descarga") && method === "GET") {
    currentAdmin();
    return { __blob: fakePdfBlob("Documento de asunción de deuda") };
  }

  // ---- INVENTARIO ---------------------------------------------------------
  if (is("api", "inventario", "resumen") && method === "GET") {
    currentAdmin();
    return db.resumenInventarioDe(q.get("convenio_id"));
  }
  if (is("api", "inventario", "carga-masiva") && method === "POST") {
    currentAdmin();
    const file = body.get("file");
    return { detail: `Se procesó "${file?.name ?? "el archivo"}" correctamente.`, invalidos: 0, omitidos: 0, errores: [] };
  }
  if (is("api", "inventario", "carga") && method === "POST") {
    currentAdmin();
    const convenioId = Number(q.get("convenio_id"));
    const convenio = db.convenios.find((c) => c.id === convenioId);
    const file = body.get("file");
    const cantidad = 5;
    for (let i = 0; i < cantidad; i++) {
      const codigo = `${(convenio?.nombre ?? "NEW").slice(0, 3).toUpperCase()}-${db.newId("unidad")}`;
      db.unidadesInventario.push({ id: db.newId("unidad"), convenio_id: convenioId, codigo, estado: "disponible", fecha_ingreso: db.dateOnly() });
    }
    return { detail: `Se cargaron ${cantidad} códigos nuevos desde "${file?.name ?? "el archivo"}".`, invalidos: 0, omitidos: 0, errores: [] };
  }
  if (is("api", "inventario", "bloquear") && method === "POST") {
    currentAdmin();
    db.unidadesInventario.forEach((u) => { if (body.unidad_ids.includes(u.id)) u.estado = "bloqueada"; });
    return { detail: `${body.unidad_ids.length} unidad(es) bloqueada(s).` };
  }
  if (is("api", "inventario", "desbloquear") && method === "POST") {
    currentAdmin();
    db.unidadesInventario.forEach((u) => { if (body.unidad_ids.includes(u.id)) u.estado = "disponible"; });
    return { detail: `${body.unidad_ids.length} unidad(es) desbloqueada(s).` };
  }
  if (is("api", "inventario") && method === "GET") {
    currentAdmin();
    let rows = db.unidadesInventario.filter((u) => u.convenio_id === Number(q.get("convenio_id")));
    const estado = q.get("estado");
    if (estado) rows = rows.filter((u) => u.estado === estado);
    return paginate(rows, q);
  }

  // ---- PLANTILLAS -------------------------------------------------------
  if (is("api", "plantillas", "catalogo") && method === "GET") {
    currentAdmin();
    return db.catalogoPlantillas;
  }
  if (is("api", "plantillas", "catalogo", "*", "preview") && method === "GET") {
    currentAdmin();
    return { __blob: fakePdfBlob(`Plantilla · ${seg[3]}`) };
  }
  if (is("api", "plantillas", "disponibles") && method === "GET") {
    currentAdmin();
    return plantillasDisponiblesDe(Number(q.get("convenio_id")));
  }
  if (is("api", "plantillas", "preview") && method === "POST") {
    currentAdmin();
    const html = body.get("html");
    if (!html || !String(html).trim()) throw new ApiError("El código HTML es obligatorio.", 422, "HTML vacío.");
    return { __blob: fakePdfBlob("Vista previa de plantilla") };
  }
  if (is("api", "plantillas") && method === "POST") {
    currentAdmin();
    const convenioId = Number(body.get("convenio_id"));
    const html = body.get("html");
    if (!html || !String(html).trim()) throw new ApiError("El código HTML es obligatorio.", 422, "HTML vacío.");
    const convenio = db.convenios.find((c) => c.id === convenioId);
    const version = db.plantillasPersonalizadas.filter((p) => p.convenio_id === convenioId).length + 1;
    const plantilla = {
      id: db.newId("plantilla"), convenio_id: convenioId,
      nombre: body.get("nombre") || convenio?.nombre || "Plantilla personalizada",
      version, en_uso: true, html: String(html),
    };
    db.plantillasPersonalizadas.push(plantilla);
    setPlantillaActiva(convenioId, { tipo: "personalizada", id: plantilla.id, nombre: plantilla.nombre });
    return plantilla;
  }
  if (is("api", "plantillas", "*", "preview") && method === "GET") {
    currentAdmin();
    const plantilla = db.plantillasPersonalizadas.find((p) => p.id === idAt(2));
    return { __blob: fakePdfBlob(plantilla?.nombre ?? "Plantilla") };
  }
  if (is("api", "plantillas", "*") && method === "PATCH") {
    currentAdmin();
    const plantilla = db.plantillasPersonalizadas.find((p) => p.id === idAt(2));
    if (!plantilla) throw new ApiError("Plantilla no encontrada.", 404, "No encontrada.");
    if (body.estado) setPlantillaActiva(plantilla.convenio_id, { tipo: "personalizada", id: plantilla.id, nombre: plantilla.nombre });
    else setPlantillaActiva(plantilla.convenio_id, null);
    return plantilla;
  }
  if (is("api", "plantillas", "*") && method === "DELETE") {
    currentAdmin();
    const plantilla = db.plantillasPersonalizadas.find((p) => p.id === idAt(2));
    if (plantilla?.en_uso) setPlantillaActiva(plantilla.convenio_id, null);
    const idx = db.plantillasPersonalizadas.findIndex((p) => p.id === idAt(2));
    if (idx >= 0) db.plantillasPersonalizadas.splice(idx, 1);
    return null;
  }

  // ---- REPORTES -----------------------------------------------------------
  if (is("api", "reportes", "rendimiento-convenios", "exportar") && method === "GET") {
    currentAdmin();
    return { __blob: fakeXlsxBlob(), __filename: "rendimiento_convenios.xlsx" };
  }
  if (is("api", "reportes", "afiliados", "exportar") && method === "GET") {
    currentAdmin();
    return { __blob: fakeXlsxBlob(), __filename: "afiliados.xlsx" };
  }
  if (is("api", "reportes", "rendimiento-convenios") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    return db.convenios
      .filter((c) => c.cooperativa_id === scope)
      .map((c) => {
        const resumen = db.resumenInventarioDe(c.id);
        const trx = db.transacciones.filter((t) => t.convenio_id === c.id && t.estado === "COMPLETADA");
        const unidadesVendidas = trx.reduce((s, t) => s + t.cantidad, 0);
        const ingresos = trx.reduce((s, t) => s + t.total, 0);
        const entregadasOVendidas = resumen.entregada + resumen.redimida || 1;
        return {
          convenio_id: c.id, convenio_nombre: c.nombre, unidades_vendidas: unidadesVendidas, ingresos,
          disponible: resumen.disponible, entregada: resumen.entregada,
          tasa_redencion: Math.round((resumen.redimida / entregadasOVendidas) * 100),
        };
      });
  }

  // ---- TICKETS ------------------------------------------------------------
  if (is("api", "tickets", "me") && method === "GET") {
    const afiliado = currentAfiliado();
    return db.tickets.filter((t) => t.afiliado_id === afiliado.id);
  }
  if (is("api", "tickets", "me", "*", "descarga") && method === "GET") {
    const afiliado = currentAfiliado();
    const ticket = db.tickets.find((t) => t.id === idAt(3) && t.afiliado_id === afiliado.id);
    return { __blob: fakePdfBlob(ticket?.codigo ?? "Ticket BEET") };
  }

  // ---- TRANSACCIONES --------------------------------------------------
  if (is("api", "transacciones", "comprar") && method === "POST") {
    const afiliado = currentAfiliado();
    return ejecutarCompra(afiliado, body);
  }
  if (is("api", "transacciones", "me") && method === "GET") {
    const afiliado = currentAfiliado();
    return paginate(db.transacciones.filter((t) => t.afiliado_id === afiliado.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), q);
  }
  if (is("api", "transacciones", "me", "*") && method === "GET") {
    const afiliado = currentAfiliado();
    const trx = db.transacciones.find((t) => t.id === idAt(3) && t.afiliado_id === afiliado.id);
    if (!trx) throw new ApiError("Transacción no encontrada.", 404, "No encontrada.");
    return trx;
  }
  if (is("api", "transacciones") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const afiliadosScope = db.afiliados.filter((a) => a.cooperativa_id === scope).map((a) => a.id);
    let rows = db.transacciones.filter((t) => afiliadosScope.includes(t.afiliado_id));
    const estado = q.get("estado");
    if (estado) rows = rows.filter((t) => t.estado === estado);
    rows = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return paginate(rows, q);
  }
  if (is("api", "transacciones", "*") && method === "GET") {
    currentAdmin();
    const trx = db.transacciones.find((t) => t.id === idAt(2));
    if (!trx) throw new ApiError("Transacción no encontrada.", 404, "No encontrada.");
    return trx;
  }

  throw new ApiError(`Endpoint no simulado en esta copia sin backend: ${method} ${pathname}`, 501, "No implementado.");
}

async function mockRequest(method, path, body, opts = {}) {
  await delay();
  try {
    return await handle(method, path, body);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // eslint-disable-next-line no-console
    console.error("Mock apiClient error", err);
    throw new ApiError("Ocurrió un error al simular la respuesta del servidor.", 500, String(err?.message || err));
  }
}

async function mockRequestBlob(method, path, body, opts = {}) {
  await delay();
  const data = await handle(method, path, body);
  if (!data || !data.__blob) throw new ApiError("Esta descarga no está disponible.", 404, "Sin contenido.");
  return { blob: data.__blob, filename: data.__filename };
}

export const apiClient = {
  get: (path, opts) => mockRequest("GET", path, undefined, opts),
  post: (path, body, opts) => mockRequest("POST", path, body, opts),
  patch: (path, body, opts) => mockRequest("PATCH", path, body, opts),
  delete: (path, opts) => mockRequest("DELETE", path, undefined, opts),
  postForm: (path, formData, opts) => mockRequest("POST", path, formData, opts),
  postFormBlob: async (path, formData, opts) => (await mockRequestBlob("POST", path, formData, opts)).blob,
  getBlob: async (path, opts) => (await mockRequestBlob("GET", path, undefined, opts)).blob,
  getBlobWithFilename: async (path, opts, fallbackFilename = "descarga") => {
    const { blob, filename } = await mockRequestBlob("GET", path, undefined, opts);
    return { blob, filename: filename || fallbackFilename };
  },
};
