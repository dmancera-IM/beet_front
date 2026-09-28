import { useState } from 'react';

// ADAPTADO AL BACKEND REAL: `convenios.imagen_url` es una URL pública
// simple (sin autenticación) — ya no hay una plantilla/logo servida detrás
// del JWT del afiliado, así que esto ya no necesita descargar un blob
// autenticado. Cae al placeholder genérico si no hay imagen o si falla la
// carga, igual que antes.
export default function ConvenioImagenMarca({ imagenMarcaUrl, nombre, className = '', style }) {
  const [falloImagen, setFalloImagen] = useState(false);

  if (imagenMarcaUrl && !falloImagen) {
    return (
      <div className={`benefit-card-image benefit-card-image--photo ${className}`} style={style}>
        <img src={imagenMarcaUrl} alt={nombre} onError={() => setFalloImagen(true)} />
      </div>
    );
  }

  return (
    <div className={`benefit-card-image ${className}`} style={style}>
      <span className="benefit-card-image-label">{nombre}</span>
    </div>
  );
}
