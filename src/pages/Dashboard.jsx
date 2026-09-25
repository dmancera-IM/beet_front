import { useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../components/layout/breadcrumbs';
import { KpiCard, Card } from '../components/ui/Card';
import { ErrorState, LoadingState } from '../components/ui/States';
import * as adminService from '../services/adminService';
import * as afiliadosService from '../services/afiliadosService';
import * as transaccionesService from '../services/transaccionesService';
import * as convenioService from '../services/convenioService';
import { formatCOP } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useCooperativa } from '../context/CooperativaContext';
import RequireCooperativaSeleccionada from '../components/layout/RequireCooperativaSeleccionada';

// ADAPTADO AL BACKEND REAL: no existe GET /dashboard/stats ni
// /reportes/rendimiento-convenios en el backend actual, así que este
// dashboard se reescribió para calcular sus KPIs a partir de endpoints
// reales que sí existen: bolsa, crédito, afiliados y transacciones de la
// cooperativa. "Actividad reciente" se retiró (no existe tabla de
// auditoría en las 13 tablas de este alcance) en vez de simularla.
export default function Dashboard() {
  useSetBreadcrumbs([{ label: 'Dashboard' }]);
  const { nombreEntidad, cooperativaId } = useAuth();
  const { necesitaSeleccion, selectedId, selected, isSuperAdmin } = useCooperativa();
  const idCooperativaActual = isSuperAdmin ? selectedId : cooperativaId;
  const nombreCooperativaActual = isSuperAdmin ? (selected?.nombre ?? 'Selecciona una entidad') : nombreEntidad;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = () => {
    if (necesitaSeleccion || !idCooperativaActual) return;
    setLoading(true);
    setError(null);
    Promise.all([
      adminService.obtenerBolsa(idCooperativaActual),
      adminService.obtenerCredito(idCooperativaActual),
      afiliadosService.listarAfiliados({ cooperativaId: idCooperativaActual }),
      transaccionesService.listarTransacciones({ cooperativaId: idCooperativaActual }),
      convenioService.listarConvenios({ soloActivos: true }),
    ])
      .then(([bolsa, credito, afiliados, transacciones, convenios]) => setData({ bolsa, credito, afiliados, transacciones, convenios }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, [necesitaSeleccion, idCooperativaActual]); // eslint-disable-line react-hooks/exhaustive-deps

  if (necesitaSeleccion) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="text-h1 page-title">Dashboard</h1>
          </div>
        </div>
        <RequireCooperativaSeleccionada />
      </div>
    );
  }

  if (loading || !data) return <LoadingState title="Cargando estadísticas desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;

  const { bolsa, credito, afiliados, transacciones, convenios } = data;
  const completadas = transacciones.filter((t) => t.estado === 'COMPLETADA');
  const ventasTarjeta = completadas.filter((t) => t.metodo_pago === 'TARJETA').reduce((s, t) => s + t.total, 0);
  const ventasCupo = completadas.filter((t) => t.metodo_pago === 'CUPO').reduce((s, t) => s + t.total, 0);
  const ventasTotal = ventasTarjeta + ventasCupo;
  const afiliadosActivos = afiliados.filter((a) => a.estado).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="text-label">{nombreCooperativaActual}</span>
          <h1 className="text-h1 page-title">Dashboard</h1>
          <p className="page-subtitle">Visibilidad en tiempo real de ventas, bolsa y crédito, directamente desde PostgreSQL.</p>
        </div>
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Ventas totales" value={formatCOP(ventasTotal)} delta={`${completadas.length} transacciones`} deltaTone="neutral" />
        <KpiCard label="Afiliados" value={afiliados.length} delta={`${afiliadosActivos} activos`} deltaTone="neutral" />
        <KpiCard label="Convenios activos" value={convenios.length} delta="En catálogo" deltaTone="neutral" />
        <KpiCard label="Bolsa disponible" value={formatCOP(bolsa.valor - bolsa.consumido)} delta={`de ${formatCOP(bolsa.valor)}`} deltaTone="neutral" />
        <KpiCard label="Crédito disponible" value={formatCOP(credito.cupo_autorizado - credito.utilizado)} delta="Otorgado por GES" deltaTone="neutral" />
      </div>

      <div className="grid grid-2 section-gap">
        <Card>
          <div className="text-label" style={{ marginBottom: 14 }}>Ventas por forma de pago</div>
          {ventasTotal === 0 ? (
            <div className="text-small cell-muted">Sin ventas registradas todavía.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>Tarjeta</span><span className="tabular" style={{ color: 'var(--text-muted)' }}>{Math.round((ventasTarjeta / ventasTotal) * 100)}%</span>
                </div>
                <div className="progress-track"><div className="progress-fill brand" style={{ width: `${(ventasTarjeta / ventasTotal) * 100}%` }} /></div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>Cupo de la entidad</span><span className="tabular" style={{ color: 'var(--text-muted)' }}>{Math.round((ventasCupo / ventasTotal) * 100)}%</span>
                </div>
                <div className="progress-track"><div className="progress-fill green" style={{ width: `${(ventasCupo / ventasTotal) * 100}%` }} /></div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-default)' }} className="text-caption">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--brand-primary)' }} />Tarjeta · {formatCOP(ventasTarjeta)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent-green)' }} />Cupo · {formatCOP(ventasCupo)}</span>
          </div>
        </Card>

        <Card>
          <div className="text-label" style={{ marginBottom: 14 }}>Bolsa y crédito</div>
          <Row label="Bolsa comprada" value={formatCOP(bolsa.valor)} />
          <Row label="Bolsa consumida" value={formatCOP(bolsa.consumido)} />
          <Row label="Crédito autorizado" value={formatCOP(credito.cupo_autorizado)} />
          <Row label="Crédito utilizado" value={formatCOP(credito.utilizado)} />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, fontSize: 13 }}>
      <span>{label}</span>
      <span className="tabular" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
