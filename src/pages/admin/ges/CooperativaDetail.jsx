import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, KpiCard } from '../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { Field, Input } from '../../../components/ui/Field';
import { Tabs } from '../../../components/ui/Nav';
import { EmptyState } from '../../../components/ui/States';
import PermissionGate from '../../../components/ui/PermissionGate';
import { useToast } from '../../../context/ToastContext';
import { formatCOP, formatDate, formatDateTime } from '../../../utils/format';
import SolicitudesTable from './SolicitudesTable';
import AsignarInventarioModal from './AsignarInventarioModal';
import {
  PROVEEDORES,
  aumentarCupoCreditoGes,
  bolsaDisponible,
  creditoDisponible,
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
  const { push } = useToast();
  const [tab, setTab] = useState('resumen');
  const [version, setVersion] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [cupoModalOpen, setCupoModalOpen] = useState(false);
  const [nuevoCupo, setNuevoCupo] = useState('');
  const [cupoSaving, setCupoSaving] = useState(false);

  const cooperativa = useMemo(() => getCooperativa(id), [id, version]);
  const asignaciones = useMemo(() => getAsignacionesPorCooperativa(id), [id, version]);
  const solicitudes = useMemo(() => getSolicitudesPorCooperativa(id), [id, version]);
 

  useSetBreadcrumbs([
    { label: 'GES', to: '/ges' },
    { label: 'Entidades', to: '/ges/cooperativas' },
    { label: cooperativa?.nombre ?? 'Detalle' },
  ]);

  if (!cooperativa) {
    return <EmptyState title="Entidad no encontrada" actionLabel="Volver a entidades" onAction={() => navigate('/ges/cooperativas')} />;
  }

  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'Pendiente').length;
  const inventarioDisponible = asignaciones.reduce((sum, a) => sum + a.disponibles, 0);
  const refrescar = () => setVersion((v) => v + 1);

  const abrirModalCupo = () => {
    setNuevoCupo(String(cooperativa.credito.cupoAutorizado));
    setCupoModalOpen(true);
  };
  const cerrarModalCupo = () => {
    if (cupoSaving) return;
    setCupoModalOpen(false);
    setNuevoCupo('');
  };
  const guardarNuevoCupo = () => {
    setCupoSaving(true);
    try {
      aumentarCupoCreditoGes(cooperativa.id, nuevoCupo);
      push({ title: 'Cupo de crédito actualizado', description: `Nuevo cupo autorizado: ${formatCOP(Number(nuevoCupo))}. El crédito utilizado y la bolsa no cambiaron.` });
      cerrarModalCupo();
      refrescar();
    } catch (err) {
      push({ title: 'No se pudo actualizar el cupo', description: err.message, variant: 'error' });
    } finally {
      setCupoSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{cooperativa.nombre}</h1>
          <p className="page-subtitle">Entidad administrada por GES · creada el {formatDate(cooperativa.fechaCreacion)}</p>
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

      {/* Bolsa y crédito son dos conceptos independientes — NUNCA se
          mezclan en un único "cupo utilizado"/"cupo disponible" (ronda
          "Corrección visual de Bolsa/Crédito"). La bolsa es un monto que
          la entidad ya compró y va consumiendo; el crédito es un LÍMITE
          que GES autoriza y la entidad solicita dentro de ese límite. */}
      <Card padding="card-pad-lg" className="section-gap">
        <div className="grid grid-2" style={{ gap: 20 }}>
          <div>
            <div className="text-label" style={{ marginBottom: 10 }}>Bolsa</div>
            <Row label="Valor de la bolsa" value={formatCOP(cooperativa.bolsa.valor)} />
            <Row label="Consumido" value={formatCOP(cooperativa.bolsa.consumido)} />
            <Row label="Disponible" value={formatCOP(bolsaDisponible(cooperativa.bolsa))} />
          </div>
          <div>
            <div className="text-label" style={{ marginBottom: 10 }}>Crédito</div>
            <Row label="Cupo autorizado por GES" value={formatCOP(cooperativa.credito.cupoAutorizado)} />
            <Row label="Utilizado" value={formatCOP(cooperativa.credito.utilizado)} />
            <Row label="Disponible" value={formatCOP(creditoDisponible(cooperativa.credito))} />
            <Button variant="secondary" onClick={abrirModalCupo} style={{ marginTop: 8 }}>Aumentar cupo de crédito</Button>
          </div>
        </div>
      </Card>

      <Card padding="card-pad-lg">
        <Tabs items={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 18 }}>
          {tab === 'resumen' && (
            asignaciones.length === 0 ? (
              <EmptyState title="Sin inventario asignado todavía" description="Asigna inventario desde GES para que esta entidad pueda distribuirlo a sus afiliados." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Convenio</th><th>Producto</th><th className="right">Disponibles</th><th className="right">Vendidas</th></tr></thead>
                  <tbody>
                    {asignaciones.map((a) => (
                      <tr key={`${a.proveedorId}-${a.productoNombre}`}>
                        <td className="cell-primary">{a.proveedorNombre}</td>
                        <td>{a.productoNombre}</td>
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
                <EmptyState title="Sin inventario asignado" description="Esta entidad todavía no tiene inventario asignado desde GES." />
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead><tr><th>Convenio</th><th>Producto</th><th className="right">Cantidad asignada</th></tr></thead>
                    <tbody>
                      {asignaciones.map((a) => (
                        <tr key={`${a.proveedorId}-${a.productoNombre}`}>
                          <td className="cell-primary">{a.proveedorNombre}</td>
                          <td>{a.productoNombre}</td>
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
              <EmptyState title="Sin convenios asociados" description="Esta entidad todavía no tiene convenios con inventario asignado desde GES." />
            ) : (
              <div>
                <div className="text-label" style={{ marginBottom: 10 }}>Convenios de la entidad</div>
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

      <Modal
        open={cupoModalOpen}
        onClose={cerrarModalCupo}
        title="Aumentar cupo de crédito"
        actions={
          <>
            <Button variant="secondary" onClick={cerrarModalCupo} disabled={cupoSaving}>Cancelar</Button>
            <Button onClick={guardarNuevoCupo} loading={cupoSaving}>Guardar</Button>
          </>
        }
      >
        <p className="text-caption cell-muted" style={{ marginTop: -4, marginBottom: 12 }}>
          Cupo actual: {formatCOP(cooperativa.credito.cupoAutorizado)}. Aumentar el cupo solo cambia el límite máximo autorizado — no modifica el crédito ya utilizado ni la bolsa de la entidad.
        </p>
        <Field label="Nuevo cupo de crédito autorizado">
          <Input type="number" min="1" step="10000" value={nuevoCupo} onChange={(e) => setNuevoCupo(e.target.value)} placeholder="15000000" />
        </Field>
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
      <span className="text-small">{label}</span>
      <span className="tabular" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
