import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card, ProgressStatCard } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import Avatar from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import { Tabs } from '../../../components/ui/Nav';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import PermissionGate from '../../../components/ui/PermissionGate';
import { ConfirmDialog } from '../../../components/ui/Modal';
import CupoFormModal from '../cupos/CupoFormModal';
import * as afiliadosService from '../../../services/afiliadosService';
import * as cuposService from '../../../services/cuposService';
import { ApiError } from '../../../services/apiClient';
import { formatCOP, percent } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

const TABS = [
  { key: 'transacciones', label: 'Transacciones' },
  { key: 'documentos', label: 'Documentos' },
];

// Detalle de afiliado para ADMIN (secciones 7 y 8): conserva la asignación
// individual de cupo. "Marcar como retirado" fue reemplazado por "Eliminar
// afiliado" — una eliminación real, con confirmación explícita
// (Cancelar/Confirmar eliminación), no un estado nuevo.
export default function AfiliadoDetailAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const base = useAreaBase();

  const [afiliado, setAfiliado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cupo, setCupo] = useState(null); // null = sin cupo asignado (estado real, no un error)
  const [cupoLoading, setCupoLoading] = useState(true);

  const [tab, setTab] = useState('transacciones');
  const [cupoModalOpen, setCupoModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    afiliadosService
      .obtenerAfiliado(id)
      .then(setAfiliado)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar este afiliado.'))
      .finally(() => setLoading(false));

    setCupoLoading(true);
    cuposService
      .obtenerCupo(id)
      .then(setCupo)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) push({ title: 'No se pudo cargar el cupo', description: err.message, variant: 'error' });
        setCupo(null);
      })
      .finally(() => setCupoLoading(false));
  }, [id, push]);

  useEffect(() => { cargar(); }, [cargar]);

  const nombreCompleto = afiliado ? `${afiliado.nombres} ${afiliado.apellidos}` : 'Detalle';

  useSetBreadcrumbs([
    { label: 'Afiliados', to: `${base}/afiliados` },
    { label: nombreCompleto },
  ]);

  if (loading) return <LoadingState title="Cargando afiliado…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;
  if (!afiliado) {
    return <EmptyState title="Afiliado no encontrado" actionLabel="Volver a afiliados" onAction={() => navigate(`${base}/afiliados`)} />;
  }

  const guardarCupo = async ({ total }) => {
    try {
      const actualizado = await cuposService.actualizarCupo(afiliado.id, { cupo_total: total });
      setCupo(actualizado);
      push({ title: 'Cupo actualizado', description: `${nombreCompleto} · ${formatCOP(actualizado.cupo_total)}` });
      setCupoModalOpen(false);
    } catch (err) {
      push({ title: 'No se pudo actualizar el cupo', description: err.message, variant: 'error' });
    }
  };

  const eliminarAfiliado = async () => {
    setDeleting(true);
    try {
      await afiliadosService.eliminarAfiliado(afiliado.id);
      push({ title: 'Afiliado eliminado', description: nombreCompleto, variant: 'error' });
      navigate(`${base}/afiliados`);
    } catch (err) {
      push({ title: 'No se pudo eliminar el afiliado', description: err.message, variant: 'error' });
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const usado = cupo ? cupo.cupo_total - cupo.cupo_disponible : 0;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <Avatar name={nombreCompleto} size="md" />
          <div>
            <h1 className="text-h1 page-title" style={{ marginTop: 0 }}>{nombreCompleto}</h1>
            <p className="page-subtitle text-mono">{afiliado.documento} · {afiliado.correo} · {afiliado.telefono ?? 'sin teléfono'}</p>
          </div>
        </div>
        <div className="page-header-actions">
          <StatusBadge status={afiliado.estado} />
          <PermissionGate>
            <Button variant="secondary" onClick={() => setDeleteOpen(true)}>Eliminar afiliado</Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid detail-grid-2col section-gap" style={{ '--col-ratio': '1fr 1fr', gap: 16 }}>
        {cupoLoading ? (
          <Card><LoadingState title="Cargando cupo…" /></Card>
        ) : cupo ? (
          <ProgressStatCard
            label="Cupo de crédito"
            pct={percent(usado, cupo.cupo_total)}
            usedLabel={`Consumo ${formatCOP(usado)}`}
            availableLabel={`Disponible ${formatCOP(cupo.cupo_disponible)}`}
          />
        ) : (
          <Card>
            <EmptyState title="Sin cupo de crédito asignado" description="Asigna un cupo para que el afiliado pueda comprar con crédito de la entidad." />
          </Card>
        )}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="text-label">Cupo asignado</div>
              {cupo ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{formatCOP(cupo.cupo_total)}</div>
                  <StatusBadge status={cupo.estado} />
                </>
              ) : (
                <div className="text-small cell-muted" style={{ marginTop: 4 }}>No asignado</div>
              )}
            </div>
            <PermissionGate>
              <Button size="sm" variant="secondary" onClick={() => setCupoModalOpen(true)}>{cupo ? 'Editar cupo' : 'Asignar cupo'}</Button>
            </PermissionGate>
          </div>
        </Card>
      </div>

      <Card padding="card-pad-lg">
        <Tabs items={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 18 }}>
          {tab === 'transacciones' && (
            <EmptyState
              title="Conexión pendiente para esta sección"
              description="Este afiliado no tiene un endpoint propio de transacciones — consulta el listado general en Transacciones y filtra por este afiliado."
            />
          )}
          {tab === 'documentos' && (
            <EmptyState
              title="Conexión pendiente para esta sección"
              description="Este afiliado no tiene un endpoint propio de documentos — consulta el listado general en Transacciones › Documentos."
            />
          )}
        </div>
      </Card>

      <CupoFormModal
        open={cupoModalOpen}
        onClose={() => setCupoModalOpen(false)}
        afiliado={{ ...afiliado, cupo: { total: cupo?.cupo_total ?? 0 } }}
        onSave={guardarCupo}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title={`¿Eliminar a ${nombreCompleto}?`}
        description="Esta acción elimina permanentemente al afiliado de tu entidad. Puedes cancelar sin eliminar nada."
        confirmLabel="Confirmar eliminación"
        loading={deleting}
        onConfirm={eliminarAfiliado}
      />
    </div>
  );
}
