// Almacenamiento del logo personalizado de cada entidad cooperativa
// (sección 5 de la ronda de ajustes). Todavía estamos en frontend/mock —
// no hay Firebase Storage ni almacenamiento real en servidor: se guarda el
// logo como un data URL en localStorage, con una llave por entidad, para
// que la personalización sobreviva a recargas de página (a diferencia del
// resto de mockDb.js, que sí se reinicia en cada recarga) y se pueda
// demostrar visualmente el comportamiento "cada entidad tiene su propio
// logo". Cuando exista backend real, esto se reemplaza por una URL servida
// desde almacenamiento de archivos de verdad — la API de este módulo
// (get/set/clear por id de entidad) no debería tener que cambiar.

const PREFIX = 'beetticket_logo_cooperativa_';

export function getLogo(cooperativaId) {
  if (!cooperativaId) return null;
  try {
    return localStorage.getItem(`${PREFIX}${cooperativaId}`);
  } catch {
    return null;
  }
}

export function setLogo(cooperativaId, dataUrl) {
  if (!cooperativaId) return;
  try {
    localStorage.setItem(`${PREFIX}${cooperativaId}`, dataUrl);
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena, etc.) — la
    // personalización simplemente no persiste; no es un error bloqueante.
  }
}

export function clearLogo(cooperativaId) {
  if (!cooperativaId) return;
  try {
    localStorage.removeItem(`${PREFIX}${cooperativaId}`);
  } catch {
    // ignorar
  }
}

// Lee un <input type="file"> y lo convierte a data URL para poder
// guardarlo/mostrarlo sin backend.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
