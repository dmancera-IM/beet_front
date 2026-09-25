import { useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, KpiCard } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { formatCOP } from '../../../utils/format';
import * as adminService from '../../../services/adminService';
import * as afiliadosService from '../../../services/afiliadosService';
import * as inventarioService from '../../../services/inventarioService';
import * as transaccionesService from '../../../services/transaccionesService';
import * as convenioService from '../../../services/convenioService';
import * as solicitudesService from '../../../services/solicitudesService';

// ADAPTADO AL BACKEND REAL: reemplaza por completo superAdminData.js (100%
// mock, leía directamente los arrays en memoria de services/mockDb.js).
// Cada número aquí sale de un endpoint real — con el costo de una llamada
// por cooperativa (N+1), aceptable al tamaño de datos de esta integración
// porque no existe un endpoint agregado global en el backend actual.
export default function SuperAdminDashboard() {
  useSetBreadcrumbs([{ label: 'Dashboard Súper admin' }]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = () => {
    setLoading(true);
    setError(null);
    adminService
      .listarCooperativas()
      .then(async (cooperativas) => {
        const [convenios, productos, solicitudesPendientes] = await Promise.all([
          convenioService.listarConvenios(),
          convenioService.listarProductos({}),
          solicitudesService.listarSolicitudes({ estado: 'PENDIENTE' }),
        ]);

        const porCooperativa = await Promise.all(
          cooperativas.map(async (c) => {
            const [bolsa, credito, afiliados, inventario, transacciones] = await Promise.all([
              adminService.obtenerBolsa(c.id).catch(() => null),
              adminService.obtenerCredito(c.id).catch(() => null),
              afiliadosService.listarAfiliados({ cooperativaId: c.id }).catch(() => []),
              inventarioService.listarInventario({ cooperativaId: c.id }).catch(() => []),
              transaccionesService.listarTransacciones({ cooperativaId: c.id }).catch(() => []),
            ]);
            const ventas = transacciones.filter((t) => t.estado === 'COMPLETADA').reduce((s, t) => s + t.total, 0);
            return { cooperativa: c, bolsa, credito, afiliados, inventario, transacciones, ventas };
          })
        );

        setData({ cooperativas, convenios, productos, solicitudesPendientes, porCooperativa });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, []);

  if (loading) return <LoadingState title="Cargando panorama desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;

  const { cooperativas, convenios, solicitudesPendientes, porCooperativa } = data;
  const cooperativasActivas = cooperativas.filter((c) => c.estado).length;
  const totalAfiliados = porCooperativa.reduce((s, c) => s + c.afiliados.length, 0);
  const totalTransacciones = porCooperativa.reduce((s, c) => s + c.transacciones.length, 0);
  const inventarioTotal = porCooperativa.reduce((s, c) => s + c.inventario.length, 0);
  const inventarioDisponible = porCooperativa.reduce((s, c) => s + c.inventario.filter((u) => u.estado === 'DISPONIBLE').length, 0);
  const inventarioEntregado = porCooperativa.reduce((s, c) => s + c.inventario.filter((u) => u.estado === 'ENTREGADA').length, 0);
  const ventasPorCooperativa = [...porCooperativa].sort((a, b) => b.ventas - a.ventas);
  const maxVentas = Math.max(1, ...ventasPorCooperativa.map((c) => c.ventas));

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="text-label">Súper administrador</span>
          <h1 className="text-h1 page-title">Dashboard Súper admin</h1>
          <p className="page-subtitle">Vista panorámica de todo BEET, desde PostgreSQL.</p>
        </div>
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Entidades" value={cooperativas.length} deltaTone="neutral" delta="Registradas en BEET" />
        <KpiCard label="Entidades activas" value={cooperativasActivas} deltaTone="neutral" delta={`de ${cooperativas.length} en total`} />
        <KpiCard label="Afiliados" value={totalAfiliados.toLocaleString('es-CO')} deltaTone="neutral" delta="En todas las entidades" />
        <KpiCard label="Convenios en catálogo" value={convenios.length} deltaTone="neutral" delta={`${convenios.filter((c) => c.estado).length} activos`} />
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard
          label="Solicitudes pendientes"
          value={solicitudesPendientes.length}
          deltaTone={solicitudesPendientes.length > 0 ? 'warning' : 'neutral'}
          delta="Entidad → GES"
        />
        <KpiCard label="Transacciones" value={totalTransacciones.toLocaleString('es-CO')} deltaTone="neutral" delta="De afiliados" />
        <KpiCard label="Inventario total" value={inventarioTotal.toLocaleString('es-CO')} deltaTone="neutral" delta="Cargado por entidad" />
        <KpiCard label="Inventario disponible" value={inventarioDisponible.toLocaleString('es-CO')} deltaTone="neutral" delta="Listo para vender" />
      </div>

      <Card padding="card-pad-lg" className="section-gap">
        <div className="text-label" style={{ marginBottom: 4 }}>Inventario BEET</div>
        <p className="text-caption cell-muted" style={{ marginTop: 0, marginBottom: 14 }}>
          Inventario de las entidades (distinto del Storage central de GES).
        </p>
        <div className="grid grid-3">
          <div>
            <div className="text-label">Total</div>
            <div className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{inventarioTotal.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div className="text-label">Disponible</div>
            <div className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{inventarioDisponible.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div className="text-label">Entregado</div>
            <div className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{inventarioEntregado.toLocaleString('es-CO')}</div>
          </div>
        </div>
      </Card>

      <Card padding="card-pad-lg" className="section-gap">
        <div className="text-label" style={{ marginBottom: 14 }}>Ventas por entidad</div>
        {ventasPorCooperativa.every((c) => c.ventas === 0) ? (
          <div className="text-small cell-muted">Sin ventas registradas todavía.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ventasPorCooperativa.map((c) => (
              <div key={c.cooperativa.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>{c.cooperativa.nombre}</span>
                  <span className="tabular" style={{ color: 'var(--text-muted)' }}>{formatCOP(c.ventas)} · {c.afiliados.length.toLocaleString('es-CO')} afiliados</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill brand" style={{ width: `${(c.ventas / maxVentas) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <span className="text-label" style={{ marginBottom: 0 }}>Resumen de entidades</span>
          </div>
        </div>
        {porCooperativa.length === 0 ? (
          <EmptyState title="No hay entidades registradas" description="Las entidades de BEET aparecerán aquí." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entidad</th>
                  <th>Estado</th>
                  <th className="right">Afiliados</th>
                  <th className="right">Inventario</th>
                  <th className="right">Ventas</th>
                  <th className="right">Bolsa disponible</th>
                  <th className="right">Crédito disponible</th>
                </tr>
              </thead>
              <tbody>
                {porCooperativa.map((c) => (
                  <tr key={c.cooperativa.id}>
                    <td className="cell-primary">{c.cooperativa.nombre}</td>
                    <td><StatusBadge status={c.cooperativa.estado} /></td>
                    <td className="right tabular">{c.afiliados.length.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{c.inventario.length.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{formatCOP(c.ventas)}</td>
                    <td className="right tabular">{c.bolsa ? formatCOP(c.bolsa.valor - c.bolsa.consumido) : '—'}</td>
                    <td className="right tabular">{c.credito ? formatCOP(c.credito.cupo_autorizado - c.credito.utilizado) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
