import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, KpiCard } from '../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Nav';
import { EmptyState } from '../../../components/ui/States';
import PermissionGate from '../../../components/ui/PermissionGate';
import { formatDate, formatDateTime } from '../../../utils/format';
import SolicitudesTable from './SolicitudesTable';
import AsignarInventarioModal from './AsignarInventarioModal';
import {
  PROVEEDORES,
  getAsignacionesPorCooperativa,
  getActividadPorCooperativa,
  getCooperativa,
  getSolicitudesPorCooperativa,
} from './gesData';

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'solicitudes', label: 'Transacciones' },
];

export default function CooperativaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('resumen');
  const [version, setVersion] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);

  const cooperativa = useMemo(() => getCooperativa(id), [id, version]);
  const asignaciones = useMemo(() => getAsignacionesPorCooperativa(id), [id, version]);
  const solicitudes = useMemo(() => getSolicitudesPorCooperativa(id), [id, version]);
 

  useSetBreadcrumbs([
    { label: 'GES', to: '/ges' },
    { label: 'Cooperativas', to: '/ges/cooperativas' },
    { label: cooperativa?.nombre ?? 'Detalle' },
  ]);

  if (!cooperativa) {
    return <EmptyState title="Cooperativa no encontrada" actionLabel="Volver a cooperativas" onAction={() => navigate('/ges/cooperativas')} />;
  }

  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'Pendiente').length;
  const inventarioDisponible = asignaciones.reduce((sum, a) => sum + a.disponibles, 0);
  const refrescar = () => setVersion((v) => v + 1);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{cooperativa.nombre}</h1>
          <p className="page-subtitle">Cooperativa administrada por GES · creada el {formatDate(cooperativa.fechaCreacion)}</p>
        </div>
        <div className="page-header-actions">
          <StatusBadge status={cooperativa.estado} />
        </div>
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Afiliados" value={cooperativa.afiliados.toLocaleString('es-CO')} deltaTone="neutral" delta="Base registrada" />
        <KpiCard label="Convenios activos" value={cooperativa.conveniosActivos} deltaTone="neutral" delta={`de ${PROVEEDORES.length} proveedores`} />
        <KpiCard label="Inventario total" value={cooperativa.inventarioAsignado.toLocaleString('es-CO')} deltaTone="neutral" delta="Asignado desde GES" />
        <KpiCard label="Inventario disponible" value={inventarioDisponible.toLocaleString('es-CO')} deltaTone="neutral" delta="Todavía puede vender" />
        <KpiCard
          label="Solicitudes pendientes"
          value={solicitudesPendientes}
          deltaTone={solicitudesPendientes > 0 ? 'warning' : 'neutral'}
          delta={solicitudesPendientes > 0 ? 'Requieren revisión' : 'Al día'}
        />
      </div>

      <Card padding="card-pad-lg">
        <Tabs items={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 18 }}>
          {tab === 'resumen' && (
            asignaciones.length === 0 ? (
              <EmptyState title="Sin inventario asignado todavía" description="Asigna inventario desde GES para que esta cooperativa pueda distribuirlo a sus afiliados." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Convenio</th><th className="right">Disponibles</th><th className="right">Vendidas</th></tr></thead>
                  <tbody>
                    {asignaciones.map((a) => (
                      <tr key={a.proveedorId}>
                        <td className="cell-primary">{a.proveedorNombre}</td>
                        <td className="right tabular">{a.disponibles.toLocaleString('es-CO')}</td>
                        <td className="right tabular">{a.vendidas.toLocaleString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'inventario' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              </div>
              {asignaciones.length === 0 ? (
                <EmptyState title="Sin inventario asignado" description="Esta cooperativa todavía no tiene inventario asignado desde GES." />
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>Convenio</th><th className="right">Cantidad asignada</th></tr></thead>
                    <tbody>
                      {asignaciones.map((a) => (
                        <tr key={a.proveedorId}>
                          <td className="cell-primary">{a.proveedorNombre}</td>
                          <td className="right tabular">{a.cantidad.toLocaleString('es-CO')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'convenios' && (
            asignaciones.length === 0 ? (
              <EmptyState title="Sin convenios asociados" description="Esta cooperativa todavía no tiene convenios con inventario asignado desde GES." />
            ) : (
              <div>
                <div className="text-label" style={{ marginBottom: 10 }}>Convenios de la cooperativa</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {asignaciones.map((a) => (
                    <Badge key={a.proveedorId} tone="blue">{a.proveedorNombre}</Badge>
                  ))}
                </div>
              </div>
            )
          )}

          {tab === 'solicitudes' && (
            <SolicitudesTable solicitudes={solicitudes} showCooperativa={false} />
          )}

      
        </div>
      </Card>

      <AsignarInventarioModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        cooperativa={cooperativa}
        onAssigned={refrescar}
      />
    </div>
  );
}
