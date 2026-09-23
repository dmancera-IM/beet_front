import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import { IconBuscar, IconDescargar, IconPlus, IconUpload } from '../../../components/ui/Icons';
import { Pagination, Dropdown } from '../../../components/ui/Nav';
import { StatusBadge } from '../../../components/ui/Badge';
import Avatar from '../../../components/ui/Avatar';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import Modal, { ConfirmDialog } from '../../../components/ui/Modal';
import FileUploader from '../../../components/ui/FileUploader';
import Alert from '../../../components/ui/Alert';
import PermissionGate from '../../../components/ui/PermissionGate';
import CupoFormModal from '../cupos/CupoFormModal';
import { useTableState } from '../../../hooks/useTableState';
import * as afiliadosService from '../../../services/afiliadosService';
import * as reportesService from '../../../services/reportesService';
import * as cuposService from '../../../services/cuposService';
import { ApiError } from '../../../services/apiClient';
import { formatCOP, percent } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

const emptyCreateForm = { nombres: '', apellidos: '', documento: '', correo: '', telefono: '', cupoAsignado: '' };

// Afiliados para ADMIN (secciones 7 y 8): concentra la administración de
// afiliados y la gestión de cupo (asignado, consumo, disponible) en un
// solo lugar — "Cupos de crédito" dejó de existir como sección aparte.
// "Marcar como retirado" fue reemplazado por "Eliminar afiliado" (con
// confirmación); no se inventa ningún estado nuevo.
export default function AfiliadosListAdmin() {
  useSetBreadcrumbs([{ label: 'Afiliados' }]);
  const { push } = useToast();
  const base = useAreaBase();
  const navigate = useNavigate();

  const [filas, setFilas] = useState([]); // afiliado + cupo (o null) combinados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setCreating] = useState(false);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [cupoTarget, setCupoTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [masivoOpen, setMasivoOpen] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    afiliadosService
      .listarAfiliados({ pageSize: 100 })
      .then((data) =>
        Promise.all(
          data.items.map((a) =>
            cuposService
              .obtenerCupo(a.id)
              .then((cupo) => ({ ...a, cupo }))
              .catch(() => ({ ...a, cupo: null }))
          )
        )
      )
      .then(setFilas)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar los afiliados.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const { search, setSearch, filters, setFilter, pageRows, page, setPage, totalPages, total } = useTableState({
    data: filas,
    searchFields: ['nombres', 'apellidos', 'documento', 'correo'],
    pageSize: 10,
  });

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await afiliadosService.cargaMasivaAfiliados(file);
      setUploadResult(result);
      push({
        title: result.invalidos > 0 ? 'Carga procesada con filas inválidas' : 'Base de afiliados procesada',
        description: result.detail,
        variant: result.invalidos > 0 ? 'error' : 'success',
      });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo procesar el archivo', description: err.message, variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await reportesService.exportarAfiliados();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      push({ title: 'Afiliados exportados', description: filename });
    } catch (err) {
      push({ title: 'No se pudo exportar', description: err.message, variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!createForm.nombres.trim()) nextErrors.nombres = 'Los nombres son obligatorios.';
    if (!createForm.apellidos.trim()) nextErrors.apellidos = 'Los apellidos son obligatorios.';
    if (!createForm.documento.trim()) nextErrors.documento = 'El documento es obligatorio.';
    if (!createForm.correo.trim()) nextErrors.correo = 'El correo es obligatorio.';
    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setCreating(true);
    try {
      const nuevo = await afiliadosService.crearAfiliado({
        nombres: createForm.nombres.trim(),
        apellidos: createForm.apellidos.trim(),
        documento: createForm.documento.trim(),
        correo: createForm.correo.trim(),
        telefono: createForm.telefono.trim() || null,
      });
      const cupoInicial = Number(createForm.cupoAsignado);
      if (cupoInicial > 0) {
        await cuposService.actualizarCupo(nuevo.id, { cupo_total: cupoInicial });
      }
      push({ title: 'Afiliado creado', description: `${nuevo.nombres} ${nuevo.apellidos}` });
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      cargar();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateErrors({ documento: 'Ya existe un afiliado con ese documento en esta entidad.' });
      } else {
        push({ title: 'No se pudo crear el afiliado', description: err.message, variant: 'error' });
      }
    } finally {
      setCreating(false);
    }
  };

  const guardarCupo = async ({ total: cupo_total }) => {
    try {
      const cupo = await cuposService.actualizarCupo(cupoTarget.id, { cupo_total });
      setFilas((prev) => prev.map((a) => (a.id === cupoTarget.id ? { ...a, cupo } : a)));
      push({ title: 'Cupo actualizado', description: `${cupoTarget.nombres} ${cupoTarget.apellidos} · ${formatCOP(cupo.cupo_total)}` });
      setCupoTarget(null);
    } catch (err) {
      push({ title: 'No se pudo actualizar el cupo', description: err.message, variant: 'error' });
    }
  };

  const eliminarAfiliado = async () => {
    setDeleting(true);
    try {
      await afiliadosService.eliminarAfiliado(deleteTarget.id);
      push({ title: 'Afiliado eliminado', description: `${deleteTarget.nombres} ${deleteTarget.apellidos}`, variant: 'error' });
      setDeleteTarget(null);
      cargar();
    } catch (err) {
      push({ title: 'No se pudo eliminar el afiliado', description: err.message, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Afiliados</h1>
          <p className="page-subtitle">Base de afiliados de tu entidad, junto con el cupo de crédito de cada uno.</p>
        </div>
        <div className="page-header-actions">
          <Button variant="secondary" icon={<IconDescargar size={15} color="#1F2937" />} loading={exporting} onClick={handleExport}>Exportar</Button>
          <PermissionGate>
            <Button variant="secondary" icon={<IconUpload size={16} color="#1F2937" />} onClick={() => setUploadOpen(true)}>Cargar afiliados</Button>
            <Button variant="secondary" onClick={() => setMasivoOpen(true)}>Asignación masiva de cupo</Button>
            <Button icon={<IconPlus color="#fff" />} onClick={() => setCreateOpen(true)}>Nuevo afiliado</Button>
          </PermissionGate>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar por nombre, documento o correo" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Select style={{ width: 160 }} value={filters.estado ?? ''} onChange={(e) => setFilter('estado', e.target.value === '' ? '' : e.target.value === 'true')}>
              <option value="">Todo estado</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando afiliados…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="No hay afiliados registrados" description="Crea el primero o carga una base desde Excel/CSV." />
          ) : (
            <EmptyState title="Sin afiliados que coincidan" description="Ajusta los filtros o el término de búsqueda." />
          )
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Afiliado</th>
                  <th>Contacto</th>
                  <th className="right">Cupo asignado</th>
                  <th>Consumo</th>
                  <th className="right">Cupo disponible</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => {
                  const consumo = a.cupo ? a.cupo.cupo_total - a.cupo.cupo_disponible : 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={`${a.nombres} ${a.apellidos}`} size="sm" />
                          <div>
                            <Link to={`${base}/afiliados/${a.id}`} style={{ fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none' }}>{a.nombres} {a.apellidos}</Link>
                            <div className="cell-muted text-mono">{a.documento}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-small">{a.correo}<div className="cell-muted">{a.telefono ?? '—'}</div></td>
                      {a.cupo ? (
                        <>
                          <td className="right tabular">{formatCOP(a.cupo.cupo_total)}</td>
                          <td style={{ minWidth: 150 }}>
                            <div className="progress-track thin" style={{ marginBottom: 4 }}>
                              <div className="progress-fill green" style={{ width: `${percent(consumo, a.cupo.cupo_total)}%` }} />
                            </div>
                            <div className="cell-muted">{formatCOP(consumo)} ({percent(consumo, a.cupo.cupo_total)}%)</div>
                          </td>
                          <td className="right tabular">{formatCOP(a.cupo.cupo_disponible)}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="text-small cell-muted">Sin cupo asignado</td>
                      )}
                      <td><StatusBadge status={a.estado} /></td>
                      <td className="right" style={{ position: 'relative' }}>
                        <PermissionGate fallback={<Link to={`${base}/afiliados/${a.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver</Link>}>
                          <Button size="sm" variant="secondary" onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}>Gestionar</Button>
                          <Dropdown
                            open={openMenuId === a.id}
                            onClose={() => setOpenMenuId(null)}
                            style={{ top: 40, right: 0 }}
                            items={[
                              { label: 'Ver detalle', onClick: () => { setOpenMenuId(null); navigate(`${base}/afiliados/${a.id}`); } },
                              { label: a.cupo ? 'Editar cupo' : 'Asignar cupo', onClick: () => { setCupoTarget(a); setOpenMenuId(null); } },
                              { divider: true },
                              { label: 'Eliminar afiliado', danger: true, onClick: () => { setDeleteTarget(a); setOpenMenuId(null); } },
                            ]}
                          />
                        </PermissionGate>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalLabel={`Mostrando ${pageRows.length} de ${total} afiliados`} />
        )}
      </div>

      <Modal
        open={uploadOpen}
        onClose={() => { if (!uploading) { setUploadOpen(false); setUploadResult(null); } }}
        title="Cargar base de afiliados"
        actions={<Button variant="secondary" onClick={() => { setUploadOpen(false); setUploadResult(null); }} disabled={uploading}>Cerrar</Button>}
      >
        <p style={{ marginTop: 0 }}>Archivo Excel o CSV con columnas: documento, nombres, apellidos, correo, telefono, cupo_total, estado. Es un upsert: actualiza por documento si ya existe.</p>
        <FileUploader hint="Excel o CSV · máx. 10 MB" onFile={handleUpload} />
        {uploading && <LoadingState title="Procesando archivo…" />}
        {!uploading && uploadResult && (
          <div style={{ marginTop: 16 }}>
            <Alert tone={uploadResult.invalidos > 0 ? 'error' : 'success'} title={uploadResult.detail}>
              {uploadResult.errores?.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {uploadResult.errores.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {uploadResult.errores.length > 10 && <li>…y {uploadResult.errores.length - 10} fila(s) más.</li>}
                </ul>
              )}
            </Alert>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="Nuevo afiliado"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreate} loading={creating}>Crear afiliado</Button>
          </>
        }
      >
        <form onSubmit={handleCreate}>
          <Field label="Nombres" error={createErrors.nombres}>
            <Input value={createForm.nombres} onChange={(e) => setCreateForm((f) => ({ ...f, nombres: e.target.value }))} placeholder="Diana" />
          </Field>
          <Field label="Apellidos" error={createErrors.apellidos}>
            <Input value={createForm.apellidos} onChange={(e) => setCreateForm((f) => ({ ...f, apellidos: e.target.value }))} placeholder="Martínez" />
          </Field>
          <Field label="Documento" error={createErrors.documento}>
            <Input value={createForm.documento} onChange={(e) => setCreateForm((f) => ({ ...f, documento: e.target.value }))} placeholder="52114908" />
          </Field>
          <Field label="Correo electrónico" error={createErrors.correo}>
            <Input type="email" value={createForm.correo} onChange={(e) => setCreateForm((f) => ({ ...f, correo: e.target.value }))} placeholder="diana.martinez@correo.com" />
          </Field>
          <Field label="Teléfono" optional>
            <Input value={createForm.telefono} onChange={(e) => setCreateForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="3005124471" />
          </Field>
          <Field label="Cupo asignado" optional hint="Cupo de crédito disponible para este afiliado. Puedes dejarlo vacío y asignarlo después.">
            <Input type="number" min="0" step="10000" value={createForm.cupoAsignado} onChange={(e) => setCreateForm((f) => ({ ...f, cupoAsignado: e.target.value }))} placeholder="500000" />
          </Field>
        </form>
      </Modal>

      <CupoFormModal
        open={!!cupoTarget}
        onClose={() => setCupoTarget(null)}
        afiliado={cupoTarget ? { ...cupoTarget, cupo: { total: cupoTarget.cupo?.cupo_total ?? 0 } } : null}
        onSave={guardarCupo}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={deleteTarget ? `¿Eliminar a ${deleteTarget.nombres} ${deleteTarget.apellidos}?` : ''}
        description="Esta acción elimina permanentemente al afiliado de tu entidad. Puedes cancelar sin eliminar nada."
        confirmLabel="Confirmar eliminación"
        loading={deleting}
        onConfirm={eliminarAfiliado}
      />

      <AsignacionMasivaModal open={masivoOpen} onClose={() => setMasivoOpen(false)} afiliados={filas} onDone={cargar} />
    </div>
  );
}

function AsignacionMasivaModal({ open, onClose, afiliados, onDone }) {
  const { push } = useToast();
  const [monto, setMonto] = useState(500000);
  const [criterio, setCriterio] = useState('todos');
  const [saving, setSaving] = useState(false);

  const asignar = async () => {
    const objetivo = afiliados.filter((a) => a.estado && (criterio === 'todos' || !a.cupo));
    if (objetivo.length === 0) {
      push({ title: 'Nada que asignar', description: 'No hay afiliados que coincidan con el criterio seleccionado.', variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      const result = await cuposService.asignacionMasivaCupo({
        afiliado_ids: objetivo.map((a) => a.id),
        cupo_total: Number(monto),
      });
      push({ title: 'Cupo asignado de forma masiva', description: result.detail });
      onDone();
      onClose();
    } catch (err) {
      push({ title: 'No se pudo asignar el cupo', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Asignación masiva de cupo"
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={asignar} loading={saving}>Asignar cupo</Button>
        </>
      }
    >
      <Field label="Aplicar a">
        <Select value={criterio} onChange={(e) => setCriterio(e.target.value)}>
          <option value="todos">Todos los afiliados activos</option>
          <option value="sin-cupo">Afiliados activos sin cupo asignado</option>
        </Select>
      </Field>
      <Field label="Monto del cupo">
        <Input type="number" min="0" step="10000" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </Field>
    </Modal>
  );
}
