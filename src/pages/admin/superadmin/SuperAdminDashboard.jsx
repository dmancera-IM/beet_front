import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, KpiCard } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/States';
import { formatCOP } from '../../../utils/format';
import { getConveniosMasUtilizados, getResumenCooperativas, getResumenGlobal, getVentasPorCooperativa } from './superAdminData';

// Vista panorámica principal de Súper admin (sección 6-11 de la definición
// funcional): todo BEET desde una sola pantalla, sin necesidad de elegir
// una cooperativa primero — a diferencia del Dashboard de cooperativa
// (pages/Dashboard.jsx), que sigue intacto y disponible desde "Dashboard"
// en el menú para cuando Súper admin quiera entrar al detalle de una sola.
export default function SuperAdminDashboard() {
  useSetBreadcrumbs([{ label: 'Dashboard Súper admin' }]);

  const resumen = getResumenGlobal();
  const ventasPorCooperativa = getVentasPorCooperativa().sort((a, b) => b.ventas - a.ventas);
  const conveniosMasUtilizados = getConveniosMasUtilizados();
  const resumenCooperativas = getResumenCooperativas();
  const maxVentas = Math.max(1, ...ventasPorCooperativa.map((c) => c.ventas));

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="text-label">Súper administrador</span>
          <h1 className="text-h1 page-title">Dashboard Súper admin</h1>
          <p className="page-subtitle">Vista panorámica de todo BEET: entidades, ventas, inventario y convenios.</p>
        </div>
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Entidades" value={resumen.cooperativas} deltaTone="neutral" delta="Registradas en BEET" />
        <KpiCard label="Entidades activas" value={resumen.cooperativasActivas} deltaTone="neutral" delta={`de ${resumen.cooperativas} en total`} />
        <KpiCard label="Afiliados" value={resumen.afiliados.toLocaleString('es-CO')} deltaTone="neutral" delta="En todas las entidades" />
        <KpiCard label="Bonos/boletas vendidos" value={resumen.bonosVendidos.toLocaleString('es-CO')} deltaTone="neutral" delta="Transacciones completadas" />
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard
          label="Solicitudes pendientes"
          value={resumen.solicitudesPendientes}
          deltaTone={resumen.solicitudesPendientes > 0 ? 'warning' : 'neutral'}
          delta="Entidad → GES"
        />
        <KpiCard label="Transacciones" value={resumen.transacciones.toLocaleString('es-CO')} deltaTone="neutral" delta="Registradas en el sistema" />
        <KpiCard label="Inventario total" value={resumen.inventarioTotal.toLocaleString('es-CO')} deltaTone="neutral" delta="Cargado por entidad" />
        <KpiCard label="Inventario disponible" value={resumen.inventarioDisponible.toLocaleString('es-CO')} deltaTone="neutral" delta="Listo para vender" />
      </div>

      <Card padding="card-pad-lg" className="section-gap">
        <div className="text-label" style={{ marginBottom: 4 }}>Inventario BEET</div>
        <p className="text-caption cell-muted" style={{ marginTop: 0, marginBottom: 14 }}>
          Inventario de las entidades (distinto del Storage central de GES).
        </p>
        <div className="grid grid-3">
          <div>
            <div className="text-label">Total</div>
            <div className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{resumen.inventarioTotal.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div className="text-label">Disponible</div>
            <div className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{resumen.inventarioDisponible.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div className="text-label">Vendido</div>
            <div className="tabular" style={{ fontSize: 20, fontWeight: 600 }}>{resumen.inventarioVendido.toLocaleString('es-CO')}</div>
          </div>
        </div>
      </Card>

      <div className="grid detail-grid-2col section-gap" style={{ '--col-ratio': '1.2fr 1fr', gap: 16 }}>
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 14 }}>Ventas por entidad</div>
          {ventasPorCooperativa.length === 0 ? (
            <div className="text-small cell-muted">Sin ventas registradas todavía.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {ventasPorCooperativa.map((c) => (
                <div key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{c.nombre}</span>
                    <span className="tabular" style={{ color: 'var(--text-muted)' }}>{formatCOP(c.ventas)} · {c.afiliados.toLocaleString('es-CO')} afiliados</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill brand" style={{ width: `${(c.ventas / maxVentas) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 14 }}>Convenios más utilizados</div>
          {conveniosMasUtilizados.length === 0 ? (
            <div className="text-small cell-muted">Sin transacciones registradas todavía.</div>
          ) : (
            <div className="table-scroll">
              <table className="data-table" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Convenio</th>
                    <th className="right">Boletas vendidas</th>
                  </tr>
                </thead>
                <tbody>
                  {conveniosMasUtilizados.map((c) => (
                    <tr key={c.id}>
                      <td className="cell-primary">{c.nombre}</td>
                      <td className="right tabular">{c.cantidad.toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <span className="text-label" style={{ marginBottom: 0 }}>Resumen de entidades</span>
          </div>
        </div>
        {resumenCooperativas.length === 0 ? (
          <EmptyState title="No hay entidades registradas" description="Las entidades de BEET aparecerán aquí." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entidad</th>
                  <th>Estado</th>
                  <th className="right">Afiliados</th>
                  <th className="right">Convenios activos</th>
                  <th className="right">Inventario</th>
                  <th className="right">Ventas</th>
                  <th className="right">Cupo disponible</th>
                  <th className="right">Cupo gastado</th>
                </tr>
              </thead>
              <tbody>
                {resumenCooperativas.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-primary">{c.nombre}</td>
                    <td><StatusBadge status={c.estado} /></td>
                    <td className="right tabular">{c.afiliados.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{c.conveniosActivos}</td>
                    <td className="right tabular">{c.inventario.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{formatCOP(c.ventas)}</td>
                    <td className="right tabular">{formatCOP(c.cupoDisponible)}</td>
                    <td className="right tabular">{formatCOP(c.cupoGastado)}</td>
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
