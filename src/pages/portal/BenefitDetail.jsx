import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ConvenioImagenMarca from '../../components/portal/ConvenioImagenMarca';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import * as convenioService from '../../services/convenioService';
import { formatCOP } from '../../utils/format';

// ADAPTADO AL BACKEND REAL: sin precio "normal" ni vigencia por cooperativa
// en el esquema actual, no hay ahorro/porcentaje que mostrar ni fechas de
// vigencia — solo el producto real y su precio (ver
// convenioService.obtenerCatalogoAfiliado).
export default function BenefitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [convenio, setConvenio] = useState(undefined); // undefined = loading, null = not found
  const [error, setError] = useState(null);

  useEffect(() => {
    convenioService
      .obtenerCatalogoAfiliado()
      .then((data) => setConvenio(data.find((c) => c.id === Number(id)) ?? null))
      .catch((err) => setError(err.message || 'No fue posible cargar la información.'));
  }, [id]);

  if (error) return <ErrorState description={error} onRetry={() => window.location.reload()} />;
  if (convenio === undefined) return <LoadingState title="Cargando beneficio…" />;
  if (!convenio) {
    return <EmptyState title="Beneficio no encontrado" description="Puede que ya no esté disponible en el catálogo." actionLabel="Volver al catálogo" onAction={() => navigate('/portal/catalogo')} />;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate('/portal/catalogo')} className="text-small" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--brand-primary)', fontWeight: 600 }}>
          ← Volver al catálogo
        </button>
      </div>

      <div className="grid detail-grid-2col" style={{ '--col-ratio': '1.1fr 1fr', gap: 20, alignItems: 'start' }}>
        <Card padding="" style={{ overflow: 'hidden' }}>
          <ConvenioImagenMarca imagenMarcaUrl={convenio.imagen_marca_url} nombre={convenio.convenio_nombre} style={{ height: 220 }} />
        </Card>

        <div>
          <div className="text-label">{convenio.convenio_nombre}</div>
          <h1 className="text-h1" style={{ margin: '0 0 10px' }}>{convenio.nombre}</h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <span className="text-display tabular">{formatCOP(convenio.precio)}</span>
          </div>

          <p className="text-body" style={{ color: 'var(--text-muted)' }}>{convenio.descripcion || 'Sin descripción adicional registrada.'}</p>

          <Button style={{ width: '100%', marginTop: 12 }} onClick={() => navigate(`/portal/comprar/${convenio.id}`)}>
            Comprar este beneficio
          </Button>
        </div>
      </div>
    </div>
  );
}
