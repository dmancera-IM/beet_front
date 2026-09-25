// ADAPTADO AL BACKEND REAL: `convenios.imagen_url` es una URL pública
// simple (sin autenticación) — ya no hay una plantilla/logo servida detrás
// del JWT del afiliado, así que esto ya no necesita descargar un blob
// autenticado. Cae al placeholder genérico si no hay imagen o si falla la
// carga, igual que antes.
export default function ConvenioImagenMarca({ imagenMarcaUrl, nombre, className = '', style }) {
  if (imagenMarcaUrl) {
    return (
      <div className={`benefit-card-image benefit-card-image--photo ${className}`} style={style}>
        <img src={imagenMarcaUrl} alt={nombre} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      </div>
    );
  }

  return (
    <div className={`benefit-card-image ${className}`} style={style}>
      <span className="benefit-card-image-label">{nombre}</span>
    </div>
  );
}
