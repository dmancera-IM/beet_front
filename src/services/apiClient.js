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
// productos, afiliados, inventario, transacciones, etc.), and
// FRONTEND_DB_ALIGNMENT.md at the project root for how this mock maps to
// the real PostgreSQL model.

import * as db from "./mockDb";
// Lectura puntual y deliberada del mock de GES (pages/admin/ges/gesData.js)
// desde el mock del panel de cooperativa — igual que el resto de
// excepciones ya documentadas (ver mockDb.js `precioGesEntidadDe`): el
// dashboard de la entidad necesita su modalidad de compra (Bolsa/Crédito),
// el valor de cupo disponible con GES, y cuánto Storage comprado le queda
// por convenio — datos que solo existen en el mock de GES.
import { creditoDisponible, getAsignacionesPorCooperativa, getCooperativa } from "../pages/admin/ges/gesData";

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
  const usuario = id != null ? db.usuarios.find((u) => u.id === id && u.estado) : null;
  if (!usuario && required) {
    if (token) sessionExpired("admin");
    throw new ApiError("No autenticado.", 401, "No autenticado.");
  }
  return usuario ?? null;
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

// SUPER_ADMIN y GES no pertenecen a ninguna cooperativa (id_cooperativa:
// null) — un SUPER_ADMIN navega entre cooperativas con el selector
// persistente (cooperativaScopeStore); ADMIN/LECTOR solo ven la suya.
function resolveScope(usuario) {
  if (usuario.rol === "SUPER_ADMIN") {
    const stored = cooperativaScopeStore.get();
    return stored ? Number(stored) : null;
  }
  return usuario.id_cooperativa;
}

function paginate(items, params) {
  const page = Number(params.get("page") || 1);
  const pageSize = Number(params.get("page_size") || 20);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, page_size: pageSize };
}

function usuarioOut(u) {
  return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, cooperativa_id: u.id_cooperativa, estado: u.estado };
}

function usuarioConCooperativaOut(u) {
  return { ...usuarioOut(u), cooperativa_nombre: db.cooperativaNombre(u.id_cooperativa) };
}

function afiliadoOut(a) {
  return { ...db.afiliadoConCupo(a), cooperativa_id: a.id_cooperativa };
}

function afiliadoConCooperativaOut(a) {
  return { ...afiliadoOut(a), cooperativa_nombre: db.cooperativaNombre(a.id_cooperativa) };
}

// cooperativas_convenios (lo que el resto del frontend sigue llamando
// "convenio" — ver FRONTEND_DB_ALIGNMENT.md) tal como lo consume la UI del
// administrador: precio_normal/precio_beet, vigencia y estado ya viven en
// esta fila; el nombre/convenio maestro se copia como snapshot.
// `puede_activarse`: true cuando al menos un producto de este convenio ya
// tiene el porcentaje de ganancia configurado (sección 2 de la ronda de
// ajustes) — la UI usa esto para deshabilitar el switch de activación
// hasta que exista esa configuración previa.
function cooperativaConvenioOut(cc) {
  return { ...cc, puede_activarse: db.convenioListoParaActivar(cc) };
}

// ---------------------------------------------------------------------------
// Plantillas — mutual-exclusivity helper shared by convenio patch + plantilla patch
// ---------------------------------------------------------------------------

function setPlantillaActiva(cooperativaConvenioId, activa /* {tipo,id,nombre} | null */) {
  db.plantillasPersonalizadas.forEach((p) => {
    if (p.cooperativa_convenio_id === cooperativaConvenioId) p.en_uso = activa?.tipo === "personalizada" && p.id === activa.id;
  });
  const cc = db.cooperativasConvenios.find((c) => c.id === cooperativaConvenioId);
  if (cc) cc.plantilla_en_uso = activa ? activa.nombre : null;
}

function plantillasDisponiblesDe(cooperativaConvenioId) {
  const cc = db.cooperativasConvenios.find((c) => c.id === cooperativaConvenioId);
  const catalogo = db.catalogoPlantillas.map((c) => ({
    tipo: "catalogo",
    clave: c.clave,
    nombre: c.nombre,
    en_uso: cc?.plantilla_en_uso === c.nombre,
  }));
  const personalizadas = db.plantillasPersonalizadas
    .filter((p) => p.cooperativa_convenio_id === cooperativaConvenioId)
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

// PDF del ticket del afiliado — a diferencia de `fakePdfBlob`, este SÍ
// dibuja un QR y un código de barras (ver sección "Vista web sin QR/
// código de barras, PDF con ambos"): la vista web (TicketCard.jsx) nunca
// los muestra, pero el PDF descargado siempre los incluye, dibujados con
// simples rectángulos PDF (sin librerías nuevas) — un patrón determinista
// a partir del código del ticket, no un QR/código de barras real y
// escaneable, pero visualmente presente en el documento tal como pide la
// definición funcional.
function fakeTicketPdfBlob({ codigo, convenioNombre, productoNombre, estadoLabel, fechaVencimiento }) {
  const lineas = [
    "BEET Ticket",
    convenioNombre,
    productoNombre,
    `Codigo: ${codigo}`,
    estadoLabel ? `Estado: ${estadoLabel}` : null,
    fechaVencimiento ? `Vence: ${fechaVencimiento}` : null,
  ].filter(Boolean);

  let stream = "";
  let y = 390;
  lineas.forEach((linea) => {
    const seguro = String(linea).replace(/[()\\]/g, " ").slice(0, 60);
    stream += `BT /F1 14 Tf 24 ${y} Td (${seguro}) Tj ET\n`;
    y -= 20;
  });

  stream += "0 0 0 rg\n";

  // Código de barras: franjas verticales de ancho variable (mismo patrón
  // visual que ya usaba la tarjeta web, ahora solo aquí en el PDF).
  let barX = 24;
  const barY = 230;
  const barHeight = 50;
  for (let i = 0; i < 28; i++) {
    const ancho = i % 3 === 0 ? 3.5 : 1.6;
    stream += `${barX.toFixed(1)} ${barY} ${ancho} ${barHeight} re f\n`;
    barX += ancho + 3;
  }

  // QR: cuadrícula de celdas, patrón determinista a partir del código del
  // ticket (mismo código siempre genera el mismo "QR").
  const gridSize = 14;
  const cell = 8;
  const qrX = 24;
  const qrY = 40;
  let seed = 0;
  for (const ch of String(codigo)) seed += ch.charCodeAt(0);
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 2 === 0) {
        const x = qrX + col * cell;
        const yPos = qrY + row * cell;
        stream += `${x} ${yPos} ${cell - 1} ${cell - 1} re f\n`;
      }
    }
  }

  const pdf = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 320 420]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
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
// Compra del afiliado (pago tarjeta/cupo) — replica la simulación de
// pasarela que la propia pantalla PurchaseFlow ya documenta en su hint de
// desarrollo. Esto identifica un PRODUCTO (no un convenio completo: un
// convenio puede tener varios productos, sección 7) y hereda el precio de
// la fila cooperativas_convenios que habilitó ese convenio para la
// cooperativa del afiliado.
//
// Un pago rechazado por la pasarela (tarjeta terminada en 0001/0002) NO
// crea una fila de compra — nunca existió un estado "RECHAZADA" en el
// modelo (ver sección 11); el afiliado solo recibe el error y puede
// reintentar sin dejar un registro fantasma.
// ---------------------------------------------------------------------------

function ejecutarCompra(afiliado, { producto_id, cantidad, metodo_pago, numero_cuotas, firma_base64, numero_tarjeta }) {
  const producto = db.productoDe(producto_id);
  const cooperativaConvenio = db.cooperativaConvenioDeProducto(producto, afiliado.id_cooperativa);
  const cooperativaProducto = producto ? db.cooperativaProductoDe(afiliado.id_cooperativa, producto.id) : null;
  if (
    !producto || !producto.estado ||
    !cooperativaConvenio || !cooperativaConvenio.estado ||
    !cooperativaProducto || !cooperativaProducto.estado
  ) {
    throw new ApiError("Este beneficio ya no está disponible.", 404, "Producto no encontrado.");
  }

  const subtotal = cooperativaProducto.precio_beet * cantidad;
  const total = subtotal;

  if (metodo_pago === "CUPO") {
    const cupo = db.cupoDe(afiliado.id);
    if (!cupo || !cupo.estado) throw new ApiError("No tienes un cupo de crédito activo.", 400, "Sin cupo activo.");
    if (total > cupo.cupo_disponible) throw new ApiError("Saldo de cupo insuficiente.", 400, "Saldo de cupo insuficiente.");
    if (!firma_base64) throw new ApiError("La firma es obligatoria para pagar con cupo.", 422, "Falta la firma.");
  }

  let referencia_pago = null;

  if (metodo_pago === "TARJETA") {
    const last4 = String(numero_tarjeta || "").slice(-4);
    if (last4 === "0001") {
      throw new ApiError("Fondos insuficientes.", 402, "rechazado_fondos");
    } else if (last4 === "0002") {
      throw new ApiError("Tarjeta inválida o vencida.", 402, "rechazado_invalida");
    } else if (last4 === "0003") {
      throw new ApiError("La pasarela de pago no respondió a tiempo. Intenta nuevamente.", 502, "error_pasarela");
    }
    referencia_pago = `AUTH-${Math.floor(10000 + Math.random() * 89999)}`;
  }

  // Assign `cantidad` units: prefer already-DISPONIBLE seeded codes (more
  // realistic), synthesizing extra ones only if the demo pool runs out.
  const codigos = [];
  const disponibles = db.unidadesInventario.filter(
    (u) => u.id_producto === producto.id && u.id_cooperativa === afiliado.id_cooperativa && u.estado === "DISPONIBLE"
  );
  for (let i = 0; i < cantidad; i++) {
    const unidad = disponibles[i];
    if (unidad) {
      unidad.estado = "ENTREGADA";
      codigos.push(unidad.codigo);
    } else {
      const codigo = `${producto.nombre.slice(0, 3).toUpperCase()}-${db.newId("unidad")}`;
      db.unidadesInventario.push({
        id: db.newId("unidad"), id_producto: producto.id, id_cooperativa: afiliado.id_cooperativa,
        codigo, estado: "ENTREGADA", fecha_asignacion: db.dateOnly(),
      });
      codigos.push(codigo);
    }
    db.tickets.push({ id: db.newId("ticket"), afiliado_id: afiliado.id, id_producto: producto.id, codigo: codigos[i], estado: "ENTREGADA" });
  }

  const trx = {
    id: db.newId("transaccion"), afiliado_id: afiliado.id, id_producto: producto.id, cantidad, subtotal, total,
    metodo_pago, numero_cuotas: numero_cuotas ?? null, estado: "COMPLETADA", codigos, created_at: db.todayISO(),
    referencia_pago, resultado_pago: "aprobado",
  };
  db.transacciones.push(trx);

  if (metodo_pago === "CUPO") {
    const cupo = db.cupoDe(afiliado.id);
    cupo.cupo_disponible -= total;
    db.documentos.push({
      id: db.newId("documento"), afiliado_id: afiliado.id, id_producto: producto.id, transaccion_id: trx.id,
      producto_nombre: producto.nombre, convenio_nombre: cooperativaConvenio.nombre, valor: total, numero_cuotas,
      fecha_generacion: db.todayISO(), fecha_firma: db.todayISO(), estado: "FIRMADO",
    });
  }

  db.logsAuditoria.unshift({
    id: db.newId("log"), cooperativa_id: afiliado.id_cooperativa, accion: "compra_completada",
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
    const usuario = db.usuarios.find((u) => u.correo.toLowerCase() === String(body.correo || "").trim().toLowerCase());
    if (!usuario) throw new ApiError("Credenciales incorrectas.", 401, "Credenciales incorrectas.");
    if (!usuario.estado) throw new ApiError("Tu usuario está desactivado.", 403, "Usuario desactivado.");
    return { access_token: `admin:${usuario.id}`, usuario: usuarioOut(usuario) };
  }
  if (is("api", "auth", "admin", "me") && method === "GET") return usuarioOut(currentAdmin());
  if (is("api", "auth", "admin", "forgot-password") && method === "POST") return { detail: "Si el correo existe, se enviaron instrucciones." };
  if (is("api", "auth", "admin", "reset-password") && method === "POST") return { detail: "Contraseña actualizada." };

  if (is("api", "auth", "afiliado", "login") && method === "POST") {
    const afiliado = db.afiliados.find((a) => a.correo.toLowerCase() === String(body.correo || "").trim().toLowerCase());
    if (!afiliado) throw new ApiError("Credenciales incorrectas.", 401, "Credenciales incorrectas.");
    if (!afiliado.estado) throw new ApiError("Tu cuenta está inactiva. Contacta a tu entidad.", 403, "Afiliado inactivo.");
    return { access_token: `afiliado:${afiliado.id}`, afiliado: afiliadoConCooperativaOut(afiliado) };
  }
  if (is("api", "auth", "afiliado", "me") && method === "GET") return afiliadoConCooperativaOut(currentAfiliado());
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
    let rows = db.usuarios;
    const coopId = q.get("cooperativa_id");
    if (coopId) rows = rows.filter((u) => u.id_cooperativa === Number(coopId));
    const estado = q.get("estado");
    if (estado !== null && estado !== "") rows = rows.filter((u) => String(u.estado) === estado);
    const term = (q.get("q") || "").trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (u) => u.nombre.toLowerCase().includes(term) || u.correo.toLowerCase().includes(term) || (db.cooperativaNombre(u.id_cooperativa) || "").toLowerCase().includes(term)
      );
    }
    return rows.map(usuarioConCooperativaOut);
  }
  if (is("api", "admin", "usuarios") && method === "POST") {
    currentAdmin();
    if (db.usuarios.some((u) => u.correo.toLowerCase() === String(body.correo).toLowerCase())) {
      throw new ApiError("Ya existe un usuario con ese correo.", 409, "Correo duplicado.");
    }
    const usuario = {
      id: db.newId("usuario"), nombre: body.nombre, correo: body.correo, rol: body.rol,
      id_cooperativa: body.cooperativa_id ?? null, estado: true, fecha_creacion: db.dateOnly(),
    };
    db.usuarios.push(usuario);
    return usuarioConCooperativaOut(usuario);
  }
  if (is("api", "admin", "usuarios", "*") && method === "PATCH") {
    currentAdmin();
    const usuario = db.usuarios.find((u) => u.id === idAt(3));
    if (!usuario) throw new ApiError("Usuario no encontrado.", 404, "No encontrado.");
    const { cooperativa_id, ...rest } = body;
    Object.assign(usuario, rest, cooperativa_id !== undefined ? { id_cooperativa: cooperativa_id } : {});
    return usuarioConCooperativaOut(usuario);
  }
  if (is("api", "admin", "usuarios", "*") && method === "DELETE") {
    currentAdmin();
    const idx = db.usuarios.findIndex((u) => u.id === idAt(3));
    if (idx >= 0) db.usuarios.splice(idx, 1);
    return null;
  }
  if (is("api", "admin", "cooperativas") && method === "GET") {
    currentAdmin();
    return db.cooperativas;
  }
  if (is("api", "admin", "cooperativas") && method === "POST") {
    currentAdmin();
    if (db.cooperativas.some((c) => c.nit === body.nit)) throw new ApiError("Ya existe una entidad con ese NIT.", 409, "NIT duplicado.");
    const coop = { id: db.newId("cooperativa"), nombre: body.nombre, nit: body.nit, estado: true, fecha_creacion: db.dateOnly() };
    db.cooperativas.push(coop);
    return coop;
  }
  if (is("api", "admin", "cooperativa") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    if (!scope) throw new ApiError("Selecciona una entidad.", 400, "Sin entidad seleccionada.");
    const coop = db.cooperativas.find((c) => c.id === scope);
    if (!coop) throw new ApiError("Entidad no encontrada.", 404, "No encontrada.");
    return coop;
  }
  if (is("api", "admin", "cooperativa") && method === "PATCH") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    if (!scope) throw new ApiError("Selecciona una entidad.", 400, "Sin entidad seleccionada.");
    const coop = db.cooperativas.find((c) => c.id === scope);
    if (!coop) throw new ApiError("Entidad no encontrada.", 404, "No encontrada.");
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
    // SUPER_ADMIN sin entidad seleccionada: información GLOBAL de todas las
    // entidades (sección 9 de la ronda de ajustes) — antes esto devolvía
    // una lista vacía (ningún afiliado tiene id_cooperativa null). Sigue
    // siendo de solo lectura: crear/editar/eliminar exige seleccionar una
    // entidad primero (ver AfiliadosList.jsx).
    const esGlobal = admin.rol === "SUPER_ADMIN" && !scope;
    let rows = esGlobal ? db.afiliados : db.afiliados.filter((a) => a.id_cooperativa === scope);
    const estado = q.get("estado");
    if (estado) rows = rows.filter((a) => String(a.estado) === estado);
    const term = (q.get("q") || "").trim().toLowerCase();
    if (term) rows = rows.filter((a) => `${a.nombres} ${a.apellidos} ${a.documento} ${a.correo}`.toLowerCase().includes(term));
    const page = paginate(rows, q);
    return { ...page, items: page.items.map(esGlobal ? afiliadoConCooperativaOut : afiliadoOut) };
  }
  if (is("api", "afiliados", "me") && method === "GET") return afiliadoConCooperativaOut(currentAfiliado());
  if (is("api", "afiliados", "me") && method === "PATCH") {
    const afiliado = currentAfiliado();
    Object.assign(afiliado, { correo: body.correo ?? afiliado.correo, telefono: body.telefono ?? afiliado.telefono });
    return afiliadoConCooperativaOut(afiliado);
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
    return afiliadoOut(afiliado);
  }
  if (is("api", "afiliados") && method === "POST") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    if (db.afiliados.some((a) => a.id_cooperativa === scope && a.documento === body.documento)) {
      throw new ApiError("Ya existe un afiliado con ese documento en esta entidad.", 409, "Documento duplicado.");
    }
    const afiliado = { id: db.newId("afiliado"), estado: true, ...body, id_cooperativa: scope };
    db.afiliados.push(afiliado);
    return afiliadoOut(afiliado);
  }
  if (is("api", "afiliados", "*") && method === "PATCH") {
    currentAdmin();
    const afiliado = db.afiliados.find((a) => a.id === idAt(2));
    if (!afiliado) throw new ApiError("Afiliado no encontrado.", 404, "No encontrado.");
    Object.assign(afiliado, body);
    return afiliadoOut(afiliado);
  }
  if (is("api", "afiliados", "*") && method === "DELETE") {
    // Eliminación real (no un estado "RETIRADO") — ver ADMIN → Afiliados.
    currentAdmin();
    const idx = db.afiliados.findIndex((a) => a.id === idAt(2));
    if (idx < 0) throw new ApiError("Afiliado no encontrado.", 404, "No encontrado.");
    db.afiliados.splice(idx, 1);
    const cupoIdx = db.cupos.findIndex((c) => c.afiliado_id === idAt(2));
    if (cupoIdx >= 0) db.cupos.splice(cupoIdx, 1);
    return null;
  }

  // ---- CONVENIOS (cooperativas_convenios) --------------------------------
  // Lo que el resto del frontend sigue llamando "convenio" es, en el nuevo
  // modelo, la fila cooperativas_convenios: qué convenio del catálogo
  // maestro de GES (ver pages/admin/ges/gesData.js) activó esta cooperativa,
  // con qué precio BEET/normal y vigencia (sección 10).
  if (is("api", "convenios", "catalogo-maestro") && method === "GET") {
    currentAdmin();
    return db.conveniosCatalogo;
  }
  if (is("api", "convenios", "catalogo") && method === "GET") {
    // Catálogo del afiliado: un ítem POR PRODUCTO (un convenio puede tener
    // varios productos, sección 7), con el precio que SU cooperativa
    // configuró para ese producto (cooperativa_productos — ver REGLA
    // CRÍTICA en mockDb.js). Nunca expone cooperativa_id.
    const afiliado = currentAfiliado();
    return db.productosOfrecidosPorCooperativa(afiliado.id_cooperativa);
  }
  if (is("api", "convenios", "productos") && method === "GET") {
    // Productos del catálogo maestro para UN convenio (id_convenio) — usado
    // por el selector "Convenio → Producto" (secciones 9 y 14).
    currentAdmin({ required: false }) || currentAfiliado({ required: false });
    const idConvenio = q.get("id_convenio");
    return db.productosConvenio.filter((p) => p.id_convenio === idConvenio);
  }
  if (is("api", "convenios", "exportar") && method === "GET") {
    currentAdmin();
    return { __blob: fakeXlsxBlob(), __filename: "convenios.xlsx" };
  }
  if (is("api", "convenios") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    let rows = db.cooperativasConvenios.filter((c) => c.id_cooperativa === scope);
    const estado = q.get("estado");
    if (estado) rows = rows.filter((c) => String(c.estado) === estado);
    return paginate(rows.map(cooperativaConvenioOut), q);
  }
  if (is("api", "convenios") && method === "POST") {
    // Crea (adquiere) un convenio del catálogo maestro de GES para esta
    // entidad — nunca un convenio "inventado" fuera del catálogo (ver
    // sección 9/11 de FRONTEND_DB_ALIGNMENT.md). Llega SIEMPRE DESACTIVADO
    // (sección 2 de la ronda de ajustes): todavía falta configurar el
    // porcentaje de ganancia de al menos un producto antes de poder
    // activarlo — `estado` nunca se acepta en la creación, sin importar lo
    // que envíe el cliente.
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const idConvenio = body.id_convenio ?? db.conveniosCatalogo.find((c) => c.nombre === body.nombre)?.id ?? null;
    const { estado, precio_normal, precio_beet, ...resto } = body;
    void estado; void precio_normal; void precio_beet;
    const cc = {
      id: db.newId("cooperativaConvenio"), id_cooperativa: scope, id_convenio: idConvenio,
      plantilla_en_uso: null, imagen_marca_url: null, descripcion: null,
      ...resto, precio_normal: 0, precio_beet: 0, estado: false,
    };
    db.cooperativasConvenios.push(cc);
    return cooperativaConvenioOut(cc);
  }
  if (is("api", "convenios", "carga-masiva") && method === "POST") {
    currentAdmin();
    const file = body.get("file");
    return { detail: `Se procesó "${file?.name ?? "el archivo"}" correctamente.`, invalidos: 0, cambios: [], errores: [] };
  }
  if (is("api", "convenios", "*") && method === "GET") {
    currentAdmin();
    const cc = db.cooperativasConvenios.find((c) => c.id === idAt(2));
    if (!cc) throw new ApiError("Convenio no encontrado.", 404, "No encontrado.");
    return cooperativaConvenioOut(cc);
  }
  if (is("api", "convenios", "*") && method === "PATCH") {
    currentAdmin();
    const cc = db.cooperativasConvenios.find((c) => c.id === idAt(2));
    if (!cc) throw new ApiError("Convenio no encontrado.", 404, "No encontrado.");
    // Compuerta de activación (sección 2): no se puede activar un convenio
    // hasta que al menos uno de sus productos tenga el porcentaje de
    // ganancia configurado (precio calculado). No aplica al desactivar.
    if (body.estado === true && !db.convenioListoParaActivar(cc)) {
      throw new ApiError(
        "Configura el porcentaje de ganancia de al menos un producto antes de activar este convenio.",
        422,
        "Convenio sin productos configurados."
      );
    }
    // Ganancia de la entidad para TODO el convenio (sección 1 de "Ganancia
    // por convenio y precios por producto"): únicos valores permitidos
    // 5/10/15 — nunca un porcentaje libre ni por producto. Se aplica con
    // `setGananciaConvenio` (no con Object.assign directo) porque valida el
    // rango permitido.
    if (Object.prototype.hasOwnProperty.call(body, "porcentaje_ganancia_entidad")) {
      db.setGananciaConvenio(cc.id, body.porcentaje_ganancia_entidad);
      const { porcentaje_ganancia_entidad, ...resto } = body;
      void porcentaje_ganancia_entidad;
      body = resto;
    }
    if (Object.prototype.hasOwnProperty.call(body, "plantilla_catalogo_clave")) {
      const clave = body.plantilla_catalogo_clave;
      const catalogo = clave ? db.catalogoPlantillas.find((c) => c.clave === clave) : null;
      setPlantillaActiva(cc.id, catalogo ? { tipo: "catalogo", nombre: catalogo.nombre } : null);
      const { plantilla_catalogo_clave, ...rest } = body;
      void plantilla_catalogo_clave;
      Object.assign(cc, rest);
    } else {
      Object.assign(cc, body);
    }
    return cooperativaConvenioOut(cc);
  }

  // ---- COOPERATIVA_PRODUCTOS (ADMIN → Convenios: precio por cooperativa +
  // producto — sección 10.4/11) ------------------------------------------
  // ADMIN nunca edita `productosConvenio` (catálogo maestro de GES, ver
  // pages/admin/ges/gesData.js) — solo configura, por producto, el precio
  // que SU cooperativa ofrece a sus afiliados, su vigencia, descripción y
  // si está activo. Esto NO reemplaza `cooperativasConvenios` (que Lector/
  // Súper admin siguen usando tal cual) — es una tabla adicional.
  if (is("api", "cooperativa-productos") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const idConvenio = q.get("id_convenio");
    const productos = db.productosConvenio.filter((p) => p.id_convenio === idConvenio);
    const cc = db.cooperativasConvenios.find((c) => c.id_cooperativa === scope && c.id_convenio === idConvenio);
    return productos.map((p) => {
      const cp = db.cooperativaProductoDe(scope, p.id);
      const resumen = db.resumenInventarioDe(p.id);
      return {
        id_producto: p.id,
        nombre: p.nombre,
        descripcion_base: p.descripcion,
        disponible: resumen.disponible,
        configurado: db.cooperativaProductoConfigurado(scope, p.id),
        precio_beet: db.precioBeetDe(scope, p.id),
        precio_ges_entidad: db.precioGesEntidadDe(p.id),
        porcentaje_ganancia_entidad: cc?.porcentaje_ganancia_entidad ?? null,
        precio_normal: cp?.precio_normal ?? null,
        fecha_inicio: cp?.fecha_inicio ?? null,
        fecha_fin: cp?.fecha_fin ?? null,
        descripcion: cp?.descripcion ?? p.descripcion,
        estado: cp?.estado ?? false,
      };
    });
  }
  if (is("api", "cooperativa-productos", "*") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const producto = db.productoDe(idAt(2));
    if (!producto) throw new ApiError("Producto no encontrado.", 404, "No encontrado.");
    const cc = db.cooperativasConvenios.find((c) => c.id_cooperativa === scope && c.id_convenio === producto.id_convenio);
    const cp = db.cooperativaProductoDe(scope, producto.id);
    const resumen = db.resumenInventarioDe(producto.id);
    return {
      id_producto: producto.id,
      nombre: producto.nombre,
      descripcion_base: producto.descripcion,
      convenio_nombre: cc?.nombre ?? null,
      disponible: resumen.disponible,
      configurado: db.cooperativaProductoConfigurado(scope, producto.id),
      precio_beet: db.precioBeetDe(scope, producto.id),
      precio_ges_entidad: db.precioGesEntidadDe(producto.id),
      porcentaje_ganancia_entidad: cc?.porcentaje_ganancia_entidad ?? null,
      precio_normal: cp?.precio_normal ?? null,
      fecha_inicio: cp?.fecha_inicio ?? null,
      fecha_fin: cp?.fecha_fin ?? null,
      descripcion: cp?.descripcion ?? producto.descripcion,
      estado: cp?.estado ?? false,
    };
  }
  if (is("api", "cooperativa-productos", "*") && method === "PATCH") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const producto = db.productoDe(idAt(2));
    if (!producto) throw new ApiError("Producto no encontrado.", 404, "No encontrado.");
    const cc = db.cooperativasConvenios.find((c) => c.id_cooperativa === scope && c.id_convenio === producto.id_convenio);
    const cp = db.upsertCooperativaProducto(scope, producto.id, body);
    return {
      ...cp,
      nombre: producto.nombre,
      descripcion_base: producto.descripcion,
      convenio_nombre: cc?.nombre ?? null,
      disponible: db.resumenInventarioDe(producto.id).disponible,
      configurado: db.cooperativaProductoConfigurado(scope, producto.id),
      precio_beet: db.precioBeetDe(scope, producto.id),
      precio_ges_entidad: db.precioGesEntidadDe(producto.id),
      porcentaje_ganancia_entidad: cc?.porcentaje_ganancia_entidad ?? null,
    };
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
    const conveniosScope = db.cooperativasConvenios.filter((c) => c.id_cooperativa === scope);
    const afiliadosScope = db.afiliados.filter((a) => a.id_cooperativa === scope).map((a) => a.id);
    const trxScope = db.transacciones.filter((t) => afiliadosScope.includes(t.afiliado_id) && t.estado === "COMPLETADA");
    const ventasTarjeta = trxScope.filter((t) => t.metodo_pago === "TARJETA").reduce((s, t) => s + t.total, 0);
    const ventasCupo = trxScope.filter((t) => t.metodo_pago === "CUPO").reduce((s, t) => s + t.total, 0);
    const ventasTotal = ventasTarjeta + ventasCupo;
    const ahorro = trxScope.reduce((s, t) => {
      const producto = db.productoDe(t.id_producto);
      const cc = db.cooperativaConvenioDeProducto(producto, scope);
      return s + (cc ? (cc.precio_normal - cc.precio_beet) * t.cantidad : 0);
    }, 0);
    const en30dias = new Date();
    en30dias.setDate(en30dias.getDate() + 30);

    // Capacidad de compra de la entidad (sección "Ahorro generado" del
    // dashboard) — mismo cupo de crédito con GES que ya se ve en
    // GES → Entidades y en el panorama de Súper admin, nunca un valor
    // independiente. La bolsa es un monto que la entidad compra bajo
    // demanda (no un saldo corriente), así que este KPI usa el cupo de
    // crédito, que sí es un saldo disponible.
    const cooperativaGes = scope ? getCooperativa(scope) : null;

    // Inventario restante por convenio (sección "Cupo consumido de
    // afiliados" del dashboard, reemplazada): % de bonos/boletas que la
    // entidad todavía tiene disponibles de cada convenio que ya compró,
    // usando el mismo acumulado de Storage que ya se ve en GES.
    const inventarioRestantePorConvenio = scope
      ? getAsignacionesPorCooperativa(scope).map((a) => ({
          convenio_nombre: a.proveedorNombre,
          pct_restante: a.cantidad ? Math.round((a.disponibles / a.cantidad) * 100) : 0,
        }))
      : [];

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
      valor_disponible_compra: creditoDisponible(cooperativaGes?.credito),
      inventario_restante_por_convenio: inventarioRestantePorConvenio,
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
    const afiliado = db.afiliados.find((a) => a.id_cooperativa === scope && a.documento === documento);
    if (!afiliado) return { afiliado: null, documentos: [] };
    const nombreCompleto = `${afiliado.nombres} ${afiliado.apellidos}`.toLowerCase();
    const nombre_coincide = !nombresBuscados || nombreCompleto.includes(nombresBuscados);
    const documentos = db.documentos.filter((d) => d.afiliado_id === afiliado.id);
    return { afiliado: { ...afiliado, nombre_coincide }, documentos };
  }
  if (is("api", "documentos") && method === "GET") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const afiliadosScope = db.afiliados.filter((a) => a.id_cooperativa === scope).map((a) => a.id);
    return paginate(db.documentos.filter((d) => afiliadosScope.includes(d.afiliado_id)), q);
  }
  if (is("api", "documentos", "*", "descarga") && method === "GET") {
    currentAdmin();
    return { __blob: fakePdfBlob("Documento de asunción de deuda") };
  }

  // ---- INVENTARIO ---------------------------------------------------------
  // Las unidades de inventario ahora se identifican por PRODUCTO
  // (`producto_id`, sección 12) — cada convenio puede tener varios
  // productos y cada uno tiene su propia bolsa de códigos.
  if (is("api", "inventario", "resumen") && method === "GET") {
    currentAdmin();
    return db.resumenInventarioDe(q.get("producto_id"));
  }
  if (is("api", "inventario", "carga-masiva") && method === "POST") {
    currentAdmin();
    const file = body.get("file");
    return { detail: `Se procesó "${file?.name ?? "el archivo"}" correctamente.`, invalidos: 0, omitidos: 0, errores: [] };
  }
  if (is("api", "inventario", "carga") && method === "POST") {
    const admin = currentAdmin();
    const scope = resolveScope(admin);
    const productoId = Number(q.get("producto_id"));
    const producto = db.productoDe(productoId);
    const file = body.get("file");
    const cantidad = 5;
    for (let i = 0; i < cantidad; i++) {
      const codigo = `${(producto?.nombre ?? "NEW").slice(0, 3).toUpperCase()}-${db.newId("unidad")}`;
      db.unidadesInventario.push({ id: db.newId("unidad"), id_producto: productoId, id_cooperativa: scope, codigo, estado: "DISPONIBLE", fecha_asignacion: db.dateOnly() });
    }
    return { detail: `Se cargaron ${cantidad} códigos nuevos desde "${file?.name ?? "el archivo"}".`, invalidos: 0, omitidos: 0, errores: [] };
  }
  if (is("api", "inventario") && method === "GET") {
    currentAdmin();
    let rows = db.unidadesInventario.filter((u) => u.id_producto === Number(q.get("producto_id")));
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
    const cooperativaConvenioId = Number(body.get("convenio_id"));
    const html = body.get("html");
    if (!html || !String(html).trim()) throw new ApiError("El código HTML es obligatorio.", 422, "HTML vacío.");
    const cc = db.cooperativasConvenios.find((c) => c.id === cooperativaConvenioId);
    const version = db.plantillasPersonalizadas.filter((p) => p.cooperativa_convenio_id === cooperativaConvenioId).length + 1;
    const plantilla = {
      id: db.newId("plantilla"), cooperativa_convenio_id: cooperativaConvenioId,
      nombre: body.get("nombre") || cc?.nombre || "Plantilla personalizada",
      version, en_uso: true, html: String(html),
    };
    db.plantillasPersonalizadas.push(plantilla);
    setPlantillaActiva(cooperativaConvenioId, { tipo: "personalizada", id: plantilla.id, nombre: plantilla.nombre });
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
    if (body.estado) setPlantillaActiva(plantilla.cooperativa_convenio_id, { tipo: "personalizada", id: plantilla.id, nombre: plantilla.nombre });
    else setPlantillaActiva(plantilla.cooperativa_convenio_id, null);
    return plantilla;
  }
  if (is("api", "plantillas", "*") && method === "DELETE") {
    currentAdmin();
    const plantilla = db.plantillasPersonalizadas.find((p) => p.id === idAt(2));
    if (plantilla?.en_uso) setPlantillaActiva(plantilla.cooperativa_convenio_id, null);
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
    return db.cooperativasConvenios
      .filter((c) => c.id_cooperativa === scope)
      .flatMap((cc) =>
        db.productosDeCooperativaConvenio(cc).map((producto) => {
          const resumen = db.resumenInventarioDe(producto.id);
          const trx = db.transacciones.filter((t) => t.id_producto === producto.id && t.estado === "COMPLETADA");
          const unidadesVendidas = trx.reduce((s, t) => s + t.cantidad, 0);
          const ingresos = trx.reduce((s, t) => s + t.total, 0);
          return {
            convenio_id: producto.id, convenio_nombre: `${cc.nombre} · ${producto.nombre}`,
            unidades_vendidas: unidadesVendidas, ingresos,
            disponible: resumen.disponible, entregada: resumen.entregada,
            // "Tasa de redención" ahora muestra el porcentaje de ganancia
            // configurado para el convenio (ADMIN → Convenios) — ya no un
            // cálculo de redención independiente (BEET no controla la
            // redención del bono ante el proveedor).
            tasa_redencion: cc.porcentaje_ganancia_entidad ?? 0,
          };
        })
      );
  }

  // ---- TICKETS ------------------------------------------------------------
  if (is("api", "tickets", "me") && method === "GET") {
    // `fecha_vencimiento` se deriva de la vigencia (fecha_fin) que la
    // cooperativa configuró para ese producto (cooperativa_productos) — no
    // es un campo propio del ticket, reutiliza la vigencia ya existente
    // (sección "Alerta de tickets próximos a vencer").
    const afiliado = currentAfiliado();
    return db.tickets
      .filter((t) => t.afiliado_id === afiliado.id)
      .map((t) => {
        const producto = db.productoDe(t.id_producto);
        const cc = producto ? db.cooperativaConvenioDeProducto(producto, afiliado.id_cooperativa) : null;
        const cp = producto ? db.cooperativaProductoDe(afiliado.id_cooperativa, producto.id) : null;
        return {
          ...t,
          producto_nombre: producto?.nombre ?? null,
          convenio_nombre: cc?.nombre ?? null,
          fecha_vencimiento: cp?.fecha_fin ?? null,
        };
      });
  }
  if (is("api", "tickets", "me", "*", "descarga") && method === "GET") {
    const afiliado = currentAfiliado();
    const ticket = db.tickets.find((t) => t.id === idAt(3) && t.afiliado_id === afiliado.id);
    if (!ticket) throw new ApiError("Ticket no encontrado.", 404, "No encontrado.");
    const producto = db.productoDe(ticket.id_producto);
    const cc = producto ? db.cooperativaConvenioDeProducto(producto, afiliado.id_cooperativa) : null;
    const cp = producto ? db.cooperativaProductoDe(afiliado.id_cooperativa, producto.id) : null;
    const ESTADO_LABEL = { ENTREGADA: "Activo", VENCIDA: "Vencido" };
    return {
      __blob: fakeTicketPdfBlob({
        codigo: ticket.codigo,
        convenioNombre: cc?.nombre ?? null,
        productoNombre: producto?.nombre ?? null,
        estadoLabel: ESTADO_LABEL[ticket.estado] ?? ticket.estado,
        fechaVencimiento: cp?.fecha_fin ?? null,
      }),
    };
  }

  // ---- TRANSACCIONES (compra del afiliado) -------------------------------
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
    const afiliadosScope = db.afiliados.filter((a) => a.id_cooperativa === scope).map((a) => a.id);
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
