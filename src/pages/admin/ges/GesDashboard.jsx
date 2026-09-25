import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, KpiCard } from '../../../components/ui/Card';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import { IconWarningTriangle } from '../../../components/ui/Icons';
import GesNav from './GesNav';
import * as adminService from '../../../services/adminService';
import * as convenioService from '../../../services/convenioService';
import * as storageService from '../../../services/storageService';
import * as solicitudesService from '../../../services/solicitudesService';

// ADAPTADO AL BACKEND REAL: reemplaza gesData.js — cada número viene de un
// endpoint real (cooperativas, convenios, storage, solicitudes-compra). No
// hay un "dinero ganado por ventas" agregado en el backend actual (no
// existe una tabla de movimientos/ledger) — ese KPI se retiró en vez de
// inventarlo.
export default function GesDashboard() {
  useSetBreadcrumbs([{ label: 'GES' }]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      adminService.listarCooperativas(),
      convenioService.listarConvenios(),
      storageService.listarStorage({ estado: 'DISPONIBLE' }),
      solicitudesService.listarSolicitudes({ estado: 'PENDIENTE' }),
    ])
      .then(([cooperativas, convenios, storageDisponible, pendientes]) => setData({ cooperativas, convenios, storageDisponible, pendientes }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, []);

  if (loading) return <LoadingState title="Cargando estadísticas desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;

  const cooperativasActivas = data.cooperativas.filter((c) => c.estado).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="text-label">Panel GES</span>
          <h1 className="text-h1 page-title">GES</h1>
          <p className="page-subtitle">Storage y entidades: proveedor → GES → Storage → entidad → afiliados.</p>
        </div>
      </div>

      <GesNav />

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Códigos disponibles en Storage" value={data.storageDisponible.length.toLocaleString('es-CO')} delta="Listos para asignar" deltaTone="neutral" />
        <KpiCard
          label="Solicitudes pendientes"
          value={data.pendientes.length}
          delta={data.pendientes.length > 0 ? 'Requieren más storage' : 'Sin solicitudes pendientes'}
          deltaTone={data.pendientes.length > 0 ? 'warning' : 'neutral'}
          icon={data.pendientes.length > 0 ? <IconWarningTriangle size={14} color="var(--warning)" /> : undefined}
        />
        <KpiCard label="Entidades activas" value={cooperativasActivas} delta={`${data.cooperativas.length} en total`} deltaTone="neutral" />
        <KpiCard label="Convenios en catálogo" value={data.convenios.length} delta={`${data.convenios.filter((c) => c.estado).length} activos`} deltaTone="neutral" />
      </div>

      <Card padding="card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <span className="text-label" style={{ marginBottom: 0 }}>Solicitudes pendientes</span>
          <Link to="/ges/transacciones" className="text-small" style={{ fontWeight: 600 }}>Ver todas</Link>
        </div>
        {data.pendientes.length === 0 ? (
          <div className="text-small cell-muted">Sin solicitudes pendientes.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.pendientes.slice(0, 5).map((s) => (
              <div key={s.id} className="text-small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Entidad #{s.id_cooperativa} · Producto #{s.id_producto}</span>
                <span className="tabular">{s.cantidad} unidades</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
