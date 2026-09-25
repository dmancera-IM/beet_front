import { apiClient, ApiError } from "./apiClient";

function blobDePlantilla(data) {
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}

export function listarCatalogoPlantillas() {
  // El backend real maneja una plantilla PDF por convenio, no un catálogo fijo
  // de diseños. Se conserva la API para no romper modales antiguos.
  return Promise.resolve([]);
}

export function previsualizarCatalogoPlantilla(clave) {
  return Promise.resolve(blobDePlantilla({ tipo: "catalogo", clave }));
}

export async function listarPlantillasDisponibles(convenioId) {
  const plantilla = await apiClient.get(`/convenios/${convenioId}/plantilla-pdf`, { tokenAudience: "admin" });
  if (!plantilla) return [];
  return [{
    tipo: "personalizada",
    id: convenioId,
    nombre: plantilla.nombre,
    version: 1,
    en_uso: plantilla.estado === "ACTIVA",
    archivo_url: plantilla.archivo_url,
  }];
}

export function previsualizarPlantillaHtml(formData) {
  const convenioId = formData.get("convenio_id");
  const nombre = formData.get("nombre") || "Plantilla HTML";
  const html = formData.get("html") || "";
  return Promise.resolve(blobDePlantilla({ convenio_id: convenioId, nombre, html }));
}

export async function crearPlantillaHtml(formData) {
  const convenioId = formData.get("convenio_id");
  if (!convenioId) throw new ApiError("Falta convenio_id.", 422, null);
  const nombre = formData.get("nombre") || "Plantilla personalizada";
  const html = formData.get("html") || "";
  const plantilla = await apiClient.patch(
    `/convenios/${convenioId}/plantilla-pdf`,
    { nombre, archivo_url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`, estado: "ACTIVA" },
    { tokenAudience: "admin" }
  );
  return { ...plantilla, version: 1 };
}

export async function previsualizarPlantillaPorId(convenioId) {
  const plantilla = await apiClient.get(`/convenios/${convenioId}/plantilla-pdf/descargar`, { tokenAudience: "admin" });
  return blobDePlantilla(plantilla);
}

export function actualizarEstadoPlantilla(convenioId, estado) {
  return apiClient.patch(
    `/convenios/${convenioId}/plantilla-pdf`,
    { estado: estado ? "ACTIVA" : "INACTIVA" },
    { tokenAudience: "admin" }
  );
}

export function eliminarPlantilla(convenioId) {
  return actualizarEstadoPlantilla(convenioId, false);
}
