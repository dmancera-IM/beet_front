import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import ConvenioImagenMarca from './ConvenioImagenMarca';
import { formatCOP } from '../../utils/format';

// ADAPTADO AL BACKEND REAL: `convenio` aquí es un PRODUCTO real del
// catálogo (id/nombre/descripcion/precio, ver
// convenioService.obtenerCatalogoAfiliado). No hay `precio_normal` ni
// vigencia por cooperativa en el esquema actual — solo un precio
// (`productos.precio_venta_entidad`), así que no se calcula ni muestra
// ningún "ahorro" inventado.
export default function BenefitCard({ convenio }) {
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
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
            <span className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{formatCOP(convenio.precio)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
