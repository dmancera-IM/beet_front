import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, KpiCard } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import { IconWarningTriangle } from '../../../components/ui/Icons';
import { formatCOP, formatDate } from '../../../utils/format';
import GesNav from './GesNav';
import { getCooperativas, getDineroDisponibleParaCompras, getInventarioCentral, getSolicitudes } from './gesData';

export default function GesDashboard() {
  useSetBreadcrumbs([{ label: 'GES' }]);

  const cooperativas = getCooperativas();
  const inventario = getInventarioCentral();
  const solicitudes = getSolicitudes();

  const cooperativasActivas = cooperativas.filter((c) => c.estado === 'Activa').length;
  const bonosEnStorage = inventario.reduce((sum, i) => sum + i.disponible, 0);
  const pendientes = solicitudes.filter((s) => s.estado === 'Pendiente');
  const dineroDisponible = getDineroDisponibleParaCompras();

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="text-label">Panel GES</span>
          <h1 className="text-h1 page-title">GES</h1>
          <p className="page-subtitle">
            Storage y cooperativas: proveedor → GES → Storage → cooperativa → afiliados.
          </p>
        </div>
      </div>

      <GesNav />

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Bonos/boletas en Storage" value={bonosEnStorage.toLocaleString('es-CO')} delta="Disponibles para asignar" deltaTone="neutral" />
        <KpiCard
          label="Solicitudes"
          value={pendientes.length}
          delta={pendientes.length > 0 ? 'Pendientes de revisión' : 'Sin solicitudes pendientes'}
          deltaTone={pendientes.length > 0 ? 'warning' : 'neutral'}
          icon={pendientes.length > 0 ? <IconWarningTriangle size={14} color="var(--warning)" /> : undefined}
        />
        <KpiCard label="Cooperativas activas" value={cooperativasActivas} delta={`${cooperativas.length} en total`} deltaTone="neutral" />
        <KpiCard label="Dinero disponible para compras" value={formatCOP(dineroDisponible)} delta="Para comprar bonos/boletas a proveedores" deltaTone="neutral" />
      </div>

      <div className="grid detail-grid-2col" style={{ '--col-ratio': '1.3fr 1fr', gap: 16 }}>
        <Card padding="card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span className="text-label" style={{ marginBottom: 0 }}>Storage por proveedor</span>
            <Link to="/ges/storage" className="text-small" style={{ fontWeight: 600 }}>Ver Storage</Link>
          </div>
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th className="right">Disponible</th>
                  <th className="right">Asignado</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {inventario.map((i) => (
                  <tr key={i.proveedorId}>
                    <td className="cell-primary">{i.proveedor}</td>
                    <td className="right tabular">{i.disponible.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{i.asignado.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{i.total.toLocaleString('es-CO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span className="text-label" style={{ marginBottom: 0 }}>Transacciones pendientes</span>
            <Link to="/ges/transacciones" className="text-small" style={{ fontWeight: 600 }}>Ver todas</Link>
          </div>
          {pendientes.length === 0 ? (
            <div className="text-small cell-muted">Sin solicitudes pendientes.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pendientes.slice(0, 5).map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.cooperativaNombre}</div>
                    <div className="text-caption">{s.proveedorNombre} · {s.cantidad.toLocaleString('es-CO')} unidades · {formatDate(s.fecha)}</div>
                  </div>
                  <StatusBadge status={s.estado} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
