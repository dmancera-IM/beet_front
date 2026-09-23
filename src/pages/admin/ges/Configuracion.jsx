import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Field, Select } from '../../../components/ui/Field';
import FileUploader from '../../../components/ui/FileUploader';
import { IconClose } from '../../../components/ui/Icons';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { useToast } from '../../../context/ToastContext';
import { fileToDataUrl } from '../../../services/logoStore';
import GesNav from './GesNav';
import { getConveniosConProductos, setImagenConvenio, setPlantillaConvenio } from './gesData';

// GES → Configuración: identidad visual y plantilla PDF, siempre a nivel
// de CONVENIO — nunca por producto. Un único selector + un único espacio
// de configuración reutilizable (NO una tarjeta/bloque permanente por
// convenio — con muchos convenios eso sería inmanejable): se elige el
// convenio arriba y el mismo panel de abajo carga su imagen y su
// plantilla, cualquiera que sea el convenio.
//
//   Seleccionar convenio → cargar su config → imagen actual → plantilla
//   actual → permitir reemplazar ambas (mismo panel, sin duplicar código)
//
// Los productos de un convenio (ej. Cine Colombia → Entrada 2D/3D) solo
// pertenecen al convenio; comparten siempre la misma imagen y la misma
// plantilla — nunca tienen una propia. 100% mock — sin backend, sin
// PostgreSQL.
export default function Configuracion() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Configuración' }]);
  const { push } = useToast();
  const [, setVersion] = useState(0);

  const convenios = getConveniosConProductos();
  const [idSeleccionado, setIdSeleccionado] = useState(convenios[0]?.idConvenio ?? '');
  const convenio = convenios.find((c) => c.idConvenio === idSeleccionado) ?? null;

  const handleImagen = async (file) => {
    if (!file.type.startsWith('image/')) {
      push({ title: 'Archivo no válido', description: 'Selecciona una imagen (PNG, JPG o SVG).', variant: 'error' });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImagenConvenio(convenio.idConvenio, dataUrl);
      push({ title: 'Imagen actualizada', description: `${convenio.nombre}: los beneficios de este convenio usarán esta imagen.` });
      setVersion((v) => v + 1);
    } catch {
      push({ title: 'No se pudo cargar la imagen', description: 'Intenta con otro archivo.', variant: 'error' });
    }
  };

  const quitarImagen = () => {
    setImagenConvenio(convenio.idConvenio, null);
    push({ title: 'Imagen eliminada', description: `${convenio.nombre} volverá a mostrar el placeholder.` });
    setVersion((v) => v + 1);
  };

  const handlePlantilla = (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      push({ title: 'Archivo no válido', description: 'Solo se aceptan archivos .pdf.', variant: 'error' });
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setPlantillaConvenio(convenio.idConvenio, { nombre: file.name, blobUrl });
    push({ title: 'Plantilla actualizada', description: `${convenio.nombre}: todos sus productos usarán ${file.name}.` });
    setVersion((v) => v + 1);
  };

  const previsualizarPlantilla = () => {
    if (convenio.plantillaPdf?.blobUrl) {
      window.open(convenio.plantillaPdf.blobUrl, '_blank', 'noopener,noreferrer');
    } else {
      push({ title: 'Sin archivo para previsualizar', description: 'Esta plantilla todavía no tiene un PDF cargado en esta sesión.', variant: 'error' });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Configuración</h1>
          <p className="page-subtitle">Imagen de identidad visual y plantilla PDF de cada convenio — una sola de cada una por convenio, compartida por todos sus productos.</p>
        </div>
      </div>

      <GesNav />

      <Card padding="card-pad-lg" className="section-gap" style={{ maxWidth: 420 }}>
        <div className="text-label" style={{ marginBottom: 12 }}>Configurar convenio</div>
        <Field label="Seleccionar convenio">
          <Select value={idSeleccionado} onChange={(e) => setIdSeleccionado(e.target.value)}>
            {convenios.map((c) => (
              <option key={c.idConvenio} value={c.idConvenio}>{c.nombre}</option>
            ))}
          </Select>
        </Field>
      </Card>

      {convenio && (
        <Card padding="card-pad-lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <span className="text-h2">{convenio.nombre}</span>
            <Badge tone={convenio.estado ? 'green' : 'neutral'} dot>{convenio.estado ? 'Activo' : 'Inactivo'}</Badge>
          </div>

          <div className="grid grid-2" style={{ gap: 20 }}>
            <div>
              <div className="text-label" style={{ marginBottom: 10 }}>Imagen del convenio</div>
              <div className={`benefit-card-image ${convenio.imagen ? 'benefit-card-image--photo' : ''}`} style={{ marginBottom: 10, borderRadius: 10 }}>
                {convenio.imagen ? (
                  <img src={convenio.imagen} alt={convenio.nombre} />
                ) : (
                  <span className="benefit-card-image-label">{convenio.nombre}</span>
                )}
              </div>
              <FileUploader
                label="Cambiar imagen"
                hint="PNG, JPG o SVG"
                accept="image/*"
                onFile={handleImagen}
              />
              {convenio.imagen && (
                <Button variant="ghost" size="sm" icon={<IconClose size={14} color="#1F2937" />} onClick={quitarImagen} style={{ marginTop: 8 }}>
                  Quitar imagen
                </Button>
              )}
              <p className="text-caption cell-muted" style={{ marginTop: 8 }}>
                Le da identidad visual al beneficio en el portal del afiliado 
              </p>
            </div>

            <div>
              <div className="text-label" style={{ marginBottom: 10 }}>Plantilla PDF del convenio</div>
              {convenio.plantillaPdf ? (
                <div className="table-card" style={{ padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{convenio.plantillaPdf.nombre}</span>
                    <Badge tone="green" dot>Activa</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-small cell-muted" style={{ marginBottom: 10 }}>Sin plantilla configurada.</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <Button variant="secondary" size="sm" disabled={!convenio.plantillaPdf} onClick={previsualizarPlantilla}>
                  Previsualizar
                </Button>
              </div>
              <FileUploader
                label={convenio.plantillaPdf ? 'Reemplazar plantilla' : 'Cargar plantilla'}
                hint="Solo .pdf"
                accept=".pdf"
                onFile={handlePlantilla}
              />
              <p className="text-caption cell-muted" style={{ marginTop: 8 }}>
                Se usa al generar el PDF de cualquier producto de este convenio — una sola plantilla para todos, nunca una por producto.
              </p>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
            <div className="text-label" style={{ marginBottom: 8 }}>Productos de este convenio</div>
            {convenio.productos.length === 0 ? (
              <span className="text-small cell-muted">Sin productos todavía.</span>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {convenio.productos.map((p) => (
                  <Badge key={p.id} tone="outline">{p.nombre}</Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
