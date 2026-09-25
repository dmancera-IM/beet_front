import { apiClient } from "./apiClient";

function paginar(items, page = 1, pageSize = 20) {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, page_size: pageSize };
}

function documentoBlob(doc) {
  const contenido = JSON.stringify(doc, null, 2);
  return new Blob([contenido], { type: "application/json" });
}

function normalizarDocumento(d) {
  return { ...d, transaccion_id: d.id_transaccion, afiliado_id: d.id_afiliado };
}

export async function misDocumentos({ page = 1, pageSize = 20 } = {}) {
  const rows = await apiClient.get("/portal/documentos", { tokenAudience: "afiliado" });
  return paginar(rows.map(normalizarDocumento), page, pageSize);
}

export async function descargarMiDocumento(id) {
  const docs = await apiClient.get("/portal/documentos", { tokenAudience: "afiliado" });
  const doc = docs.map(normalizarDocumento).find((d) => String(d.id) === String(id));
  if (!doc) throw new Error("Documento no encontrado.");
  return documentoBlob(doc);
}

export async function listarDocumentos({ page = 1, pageSize = 20 } = {}) {
  const rows = await apiClient.get("/documentos-asuncion-deuda", { tokenAudience: "admin" });
  return paginar(rows.map(normalizarDocumento), page, pageSize);
}

export async function buscarDocumentosLegales({ documento, nombres }) {
  const [afiliados, documentos] = await Promise.all([
    apiClient.get("/afiliados", { tokenAudience: "admin" }),
    apiClient.get("/documentos-asuncion-deuda", { tokenAudience: "admin" }),
  ]);
  const afiliado = afiliados.find((a) => String(a.documento).trim() === String(documento).trim());
  if (!afiliado) return { afiliado: null, documentos: [] };
  const nombreCompleto = `${afiliado.nombres} ${afiliado.apellidos}`.toLowerCase();
  const nombreBuscado = String(nombres || "").trim().toLowerCase();
  const docs = documentos
    .filter((d) => d.id_afiliado === afiliado.id)
    .map((d) => ({ ...normalizarDocumento(d), convenio_nombre: d.convenio_nombre ?? `Producto ${d.id_producto}` }));
  return {
    afiliado: { ...afiliado, nombre_coincide: !nombreBuscado || nombreCompleto.includes(nombreBuscado) },
    documentos: docs,
  };
}

export async function descargarDocumento(id) {
  const doc = await apiClient.get(`/documentos-asuncion-deuda/${id}/descargar`, { tokenAudience: "admin" });
  return documentoBlob(normalizarDocumento(doc));
}
