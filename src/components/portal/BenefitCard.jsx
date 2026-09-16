import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import ConvenioImagenMarca from './ConvenioImagenMarca';
import { formatCOP, formatDate } from '../../utils/format';

// `convenio` aquí es un PRODUCTO del catálogo del afiliado (un convenio
// puede tener varios, ej. Cine Colombia → Entrada 2D / Entrada 3D) con el
// precio heredado del cooperativas_convenios que lo habilitó — ver
// mockDb.productoPublico / FRONTEND_DB_ALIGNMENT.md.
export default function BenefitCard({ convenio }) {
  const ahorro = convenio.precio_normal - convenio.precio_beet;
  const ahorroPct = Math.round((ahorro / convenio.precio_normal) * 100);

  return (
    <Link to={`/portal/catalogo/${convenio.id}`} className="benefit-card-link">
      <Card padding="" className="benefit-card">
        <ConvenioImagenMarca imagenMarcaUrl={convenio.imagen_marca_url} nombre={convenio.convenio_nombre} />
        <div className="benefit-card-body">
          <div className="benefit-card-top">
            <div>
              <div className="text-caption">{convenio.convenio_nombre}</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{convenio.nombre}</div>
            </div>
            <Badge tone="green" dot>Ahorras {ahorroPct}%</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
            <span className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{formatCOP(convenio.precio_beet)}</span>
            <span className="tabular text-small" style={{ textDecoration: 'line-through' }}>{formatCOP(convenio.precio_normal)}</span>
          </div>
          <div className="text-caption" style={{ marginTop: 8 }}>
            {convenio.fecha_fin ? `Vigente hasta ${formatDate(convenio.fecha_fin)}` : 'Sin fecha de vencimiento'}
          </div>
        </div>
      </Card>
    </Link>
  );
}
