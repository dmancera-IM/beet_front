import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, KpiCard } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { Field, Input } from '../../../components/ui/Field';
import { Tabs } from '../../../components/ui/Nav';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { useToast } from '../../../context/ToastContext';
import { formatCOP } from '../../../utils/format';
import SolicitudesTable from './SolicitudesTable';
import * as adminService from '../../../services/adminService';
import * as solicitudesService from '../../../services/solicitudesService';
import * as inventarioService from '../../../services/inventarioService';
import * as afiliadosService from '../../../services/afiliadosService';
import * as convenioService from '../../../services/convenioService';

const TABS = [
  { key: 'inventario', label: 'Inventario' },
  { key: 'solicitudes', label: 'Solicitudes' },
];

// ADAPTADO AL BACKEND REAL: reemplaza por completo gesData.js. La bolsa y el
// crédito se leen/editan vía /cooperativas/{id}/bolsa|credito; el inventario
// y las solicitudes son reales. Ya no hay "asignar inventario" manual desde
// GES — el inventario de una cooperativa solo crece cuando una de sus
// solicitudes de compra se completa (ver solicitudesService.js).
export default function CooperativaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [tab, setTab] = useState('inventario');

  const [cooperativa, setCooperativa] = useState(null);
  const [bolsa, setBolsa] = useState(null);
  const [credito, setCredito] = useState(null);
  const [inventario, setInventario] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [afiliadosCount, setAfiliadosCount] = useState(0);
  const [productosById, setProductosById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [bolsaModalOpen, setBolsaModalOpen] = useState(false);
  const [nuevaBolsa, setNuevaBolsa] = useState('');
  const [bolsaSaving, setBolsaSaving] = useState(false);

  const [creditoModalOpen, setCreditoModalOpen] = useState(false);
  const [nuevoCredito, setNuevoCredito] = useState('');
  const [creditoSaving, setCreditoSaving] = useState(false);

  useSetBreadcrumbs([
    { label: 'GES', to: '/ges' },
    { label: 'Entidades', to: '/ges/cooperativas' },
    { label: cooperativa?.nombre ?? 'Detalle' },
  ]);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      adminService.obtenerCooperativa(id),
      adminService.obtenerBolsa(id),
      adminService.obtenerCredito(id),
      inventarioService.listarInventario({ cooperativaId: id }),
      solicitudesService.listarSolicitudes({ cooperativaId: id }),
      afiliadosService.listarAfiliados({ cooperativaId: id }),
      convenioService.listarProductos({}),
    ])
      .then(([coop, b, c, inv, sols, afiliados, prods]) => {
        setCooperativa(coop);
        setBolsa(b);
        setCredito(c);
        setInventario(inv);
        setSolicitudes(sols);
        setAfiliadosCount(afiliados.length);
        setProductosById(Object.fromEntries(prods.map((p) => [p.id, p])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const completarSolicitud = async (solicitudId) => {
    try {
      await solicitudesService.completarSolicitud(solicitudId);
      push({ title: 'Solicitud completada' });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo completar', description: err.message, variant: 'error' });
    }
  };

  const abrirModalBolsa = () => { setNuevaBolsa(String(bolsa?.valor ?? 0)); setBolsaModalOpen(true); };
  const guardarBolsa = async () => {
    setBolsaSaving(true);
    try {
      const actualizado = await adminService.fijarBolsa(id, Number(nuevaBolsa));
      setBolsa(actualizado);
      push({ title: 'Bolsa actualizada', description: formatCOP(actualizado.valor) });
      setBolsaModalOpen(false);
    } catch (err) {
      push({ title: 'No se pudo actualizar la bolsa', description: err.message, variant: 'error' });
    } finally {
      setBolsaSaving(false);
    }
  };

  const abrirModalCredito = () => { setNuevoCredito(String(credito?.cupo_autorizado ?? 0)); setCreditoModalOpen(true); };
  const guardarCredito = async () => {
    setCreditoSaving(true);
    try {
      const actualizado = await adminService.fijarCredito(id, Number(nuevoCredito));
      setCredito(actualizado);
      push({ title: 'Cupo de crédito actualizado', description: formatCOP(actualizado.cupo_autorizado) });
      setCreditoModalOpen(false);
    } catch (err) {
      push({ title: 'No se pudo actualizar el crédito', description: err.message, variant: 'error' });
    } finally {
      setCreditoSaving(false);
    }
  };

  if (loading) return <LoadingState title="Cargando entidad desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;
  if (!cooperativa) {
    return <EmptyState title="Entidad no encontrada" actionLabel="Volver a entidades" onAction={() => navigate('/ges/cooperativas')} />;
  }

  const disponibles = inventario.filter((u) => u.estado === 'DISPONIBLE').length;
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{cooperativa.nombre}</h1>
          <p className="page-subtitle">NIT {cooperativa.nit}</p>
        </div>
        <div className="page-header-actions">
          <StatusBadge status={cooperativa.estado} />
        </div>
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Afiliados" value={afiliadosCount.toLocaleString('es-CO')} deltaTone="neutral" delta="Base registrada" />
        <KpiCard label="Inventario total" value={inventario.length.toLocaleString('es-CO')} deltaTone="neutral" delta="Asignado desde Storage" />
        <KpiCard label="Inventario disponible" value={disponibles.toLocaleString('es-CO')} deltaTone="neutral" delta="Todavía puede vender" />
        <KpiCard
          label="Solicitudes pendientes"
          value={solicitudesPendientes}
          deltaTone={solicitudesPendientes > 0 ? 'warning' : 'neutral'}
          delta={solicitudesPendientes > 0 ? 'Requieren storage' : 'Al día'}
        />
      </div>

      <div className="grid grid-2 section-gap">
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 12 }}>Bolsa</div>
          <Row label="Valor de la bolsa" value={formatCOP(bolsa.valor)} />
          <Row label="Consumido" value={formatCOP(bolsa.consumido)} />
          <Row label="Disponible" value={formatCOP(bolsa.valor - bolsa.consumido)} />
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" onClick={abrirModalBolsa}>Fijar valor de bolsa</Button>
          </div>
        </Card>
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 12 }}>Crédito</div>
          <Row label="Cupo autorizado por GES" value={formatCOP(credito.cupo_autorizado)} />
          <Row label="Utilizado" value={formatCOP(credito.utilizado)} />
          <Row label="Disponible" value={formatCOP(credito.cupo_autorizado - credito.utilizado)} />
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" onClick={abrirModalCredito}>Fijar cupo autorizado</Button>
          </div>
        </Card>
      </div>

      <Card padding="card-pad-lg">
        <Tabs items={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 18 }}>
          {tab === 'inventario' && (
            inventario.length === 0 ? (
              <EmptyState title="Sin inventario asignado todavía" description="Cuando esta entidad complete una solicitud de compra, sus unidades aparecerán aquí." />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Producto</th><th>Código</th><th>Estado</th></tr></thead>
                  <tbody>
                    {inventario.map((u) => (
                      <tr key={u.id}>
                        <td className="cell-primary">{productosById[u.id_producto]?.nombre ?? `#${u.id_producto}`}</td>
                        <td className="text-small tabular">{u.codigo}</td>
                        <td><StatusBadge status={u.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === 'solicitudes' && (
            <SolicitudesTable solicitudes={solicitudes} productosById={productosById} showCooperativa={false} onCompletar={completarSolicitud} />
          )}
        </div>
      </Card>

      <Modal
        open={bolsaModalOpen}
        onClose={() => !bolsaSaving && setBolsaModalOpen(false)}
        title="Fijar valor de la bolsa"
        actions={
          <>
            <Button variant="secondary" onClick={() => setBolsaModalOpen(false)} disabled={bolsaSaving}>Cancelar</Button>
            <Button onClick={guardarBolsa} loading={bolsaSaving}>Guardar</Button>
          </>
        }
      >
        <p className="text-caption cell-muted" style={{ marginTop: -4, marginBottom: 12 }}>
          Consumido actual: {formatCOP(bolsa.consumido)}. El nuevo valor no puede ser menor que lo ya consumido.
        </p>
        <Field label="Nuevo valor de la bolsa">
          <Input type="number" min="0" step="10000" value={nuevaBolsa} onChange={(e) => setNuevaBolsa(e.target.value)} />
        </Field>
      </Modal>

      <Modal
        open={creditoModalOpen}
        onClose={() => !creditoSaving && setCreditoModalOpen(false)}
        title="Fijar cupo de crédito autorizado"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreditoModalOpen(false)} disabled={creditoSaving}>Cancelar</Button>
            <Button onClick={guardarCredito} loading={creditoSaving}>Guardar</Button>
          </>
        }
      >
        <p className="text-caption cell-muted" style={{ marginTop: -4, marginBottom: 12 }}>
          Utilizado actual: {formatCOP(credito.utilizado)}. El nuevo cupo no puede ser menor que lo ya utilizado.
        </p>
        <Field label="Nuevo cupo autorizado">
          <Input type="number" min="0" step="10000" value={nuevoCredito} onChange={(e) => setNuevoCredito(e.target.value)} />
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
