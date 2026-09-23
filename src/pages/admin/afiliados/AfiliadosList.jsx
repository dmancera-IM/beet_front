import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import { IconBuscar, IconDescargar, IconPlus, IconUpload } from '../../../components/ui/Icons';
import { Pagination } from '../../../components/ui/Nav';
import { KpiCard, Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import Avatar from '../../../components/ui/Avatar';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import Modal from '../../../components/ui/Modal';
import FileUploader from '../../../components/ui/FileUploader';
import Alert from '../../../components/ui/Alert';
import PermissionGate from '../../../components/ui/PermissionGate';
import { useTableState } from '../../../hooks/useTableState';
import * as afiliadosService from '../../../services/afiliadosService';
import * as reportesService from '../../../services/reportesService';
import { ApiError } from '../../../services/apiClient';
import { useToast } from '../../../context/ToastContext';
import { useCooperativa } from '../../../context/CooperativaContext';
import { formatCOP } from '../../../utils/format';
import { useAreaBase } from '../../../hooks/useAreaBase';
import { getMetricasAfiliados } from '../superadmin/superAdminData';

const emptyCreateForm = { nombres: '', apellidos: '', documento: '', correo: '', telefono: '' };

// Compartida entre Lector y Súper admin (ver App.jsx `paginasCooperativa`).
// Para Súper admin SIN entidad seleccionada, esto ya no bloquea con
// "selecciona una entidad": muestra la información GLOBAL de afiliados de
// TODAS las entidades (sección 9 de la ronda de ajustes), con una columna
// "Entidad" adicional y sin acciones de creación/edición (no tiene sentido
// crear un afiliado sin decidir a qué entidad pertenece). En cuanto Súper
// admin selecciona una entidad en el selector del header, vuelve al modo
// de siempre (scoped a esa entidad, con todas sus acciones). Lector nunca
// entra en modo global — siempre tiene exactamente una entidad.
export default function AfiliadosList() {
  useSetBreadcrumbs([{ label: 'Afiliados' }]);
  const { push } = useToast();
  const { necesitaSeleccion, selectedId, selected, isSuperAdmin } = useCooperativa();
  const base = useAreaBase();
  const modoGlobal = necesitaSeleccion; // isSuperAdmin && !selectedId

  // Métricas agregadas (secciones 10 y 11): GLOBAL cuando Súper admin no ha
  // seleccionado ninguna entidad, scoped a esa entidad en cuanto selecciona
  // una — el selector realmente filtra estos datos, no es solo visual.
  const metricas = useMemo(() => (isSuperAdmin ? getMetricasAfiliados(selectedId ?? null) : null), [isSuperAdmin, selectedId]);

  const [afiliados, setAfiliados] = useState([]);
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

  const cargarAfiliados = useCallback(() => {
    setLoading(true);
    setError(null);
    // 100 covers the current test dataset — a future pass should page this
    // properly against the backend's own page/page_size instead of fetching
    // everything client-side.
    afiliadosService
      .listarAfiliados({ pageSize: 100 })
      .then((data) => setAfiliados(data.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar los afiliados.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargarAfiliados(); }, [cargarAfiliados, selectedId]);

  const { search, setSearch, filters, setFilter, pageRows, page, setPage, totalPages, total } = useTableState({
    data: afiliados,
    searchFields: ['nombres', 'apellidos', 'documento', 'correo', 'cooperativa_nombre'],
    pageSize: 10,
  });

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await afiliadosService.cargaMasivaAfiliados(file);
      setUploadResult(result);
      // A 200 response only means the upload was PROCESSED — some rows may
      // still have failed validation, so the toast variant reflects that
      // instead of always claiming unconditional success.
      push({
        title: result.invalidos > 0 ? 'Carga procesada con filas inválidas' : 'Base de afiliados procesada',
        description: result.detail,
        variant: result.invalidos > 0 ? 'error' : 'success',
      });
      cargarAfiliados(); // proves the new rows came from PostgreSQL, not local state
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
      push({ title: 'Afiliado creado', description: `${nuevo.nombres} ${nuevo.apellidos} se guardó en PostgreSQL.` });
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      cargarAfiliados(); // refetch from the backend — confirms it's really there
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Afiliados</h1>
          <p className="page-subtitle">
            {modoGlobal ? 'Afiliados de todas las entidades cooperativas, obtenidos directamente de PostgreSQL.' : 'Base de afiliados de la entidad, obtenida directamente de PostgreSQL.'}
          </p>
          {isSuperAdmin && (
            <p className="text-caption" style={{ marginTop: 4 }}>
              {selected ? `Estás gestionando datos de: ${selected.nombre}` : 'Todas las entidades cooperativas — selecciona una arriba para gestionar una en particular.'}
            </p>
          )}
        </div>
        {!modoGlobal && (
          <div className="page-header-actions">
            <Button variant="secondary" icon={<IconDescargar size={15} color="#1F2937" />} loading={exporting} onClick={handleExport}>Exportar</Button>
            <PermissionGate>
              <Button variant="secondary" icon={<IconUpload size={16} color="#1F2937" />} onClick={() => setUploadOpen(true)}>Cargar afiliados</Button>
              <Button icon={<IconPlus color="#fff" />} onClick={() => setCreateOpen(true)}>Nuevo afiliado</Button>
            </PermissionGate>
          </div>
        )}
      </div>

      {metricas && (
        <>
          <div className="grid grid-kpi section-gap">
            <KpiCard label="Total afiliados" value={metricas.totalAfiliados} deltaTone="neutral" delta={modoGlobal ? 'Todas las entidades' : selected?.nombre ?? ''} />
            <KpiCard label="Activos" value={metricas.activos} deltaTone="neutral" delta={`${metricas.inactivos} inactivos`} />
            <KpiCard label="Compras completadas" value={metricas.cantidadCompras} deltaTone="neutral" delta="Transacciones de afiliados" />
            <KpiCard label="Valor de compras" value={formatCOP(metricas.valorCompras)} deltaTone="neutral" delta="Acumulado" />
          </div>

          <div className="grid grid-2 section-gap">
            {modoGlobal && (
              <Card padding="card-pad">
                <div className="text-label" style={{ marginBottom: 14 }}>Afiliados por entidad</div>
                {metricas.porEntidad.length === 0 ? (
                  <div className="text-small cell-muted">Sin entidades registradas.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {metricas.porEntidad.map((e) => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span>{e.nombre}</span>
                        <span className="tabular" style={{ fontWeight: 600 }}>{e.afiliados}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
            <Card padding="card-pad">
              <div className="text-label" style={{ marginBottom: 14 }}>
                Productos más comprados {modoGlobal ? 'por todos los afiliados' : `por afiliados de ${selected?.nombre ?? 'esta entidad'}`}
              </div>
              {metricas.productosMasComprados.length === 0 ? (
                <div className="text-small cell-muted">Sin compras registradas todavía.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {metricas.productosMasComprados.map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{p.nombre}</span>
                      <span className="tabular" style={{ fontWeight: 600 }}>{p.cantidad}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder={modoGlobal ? 'Buscar por nombre, documento, correo o entidad' : 'Buscar por nombre, documento o correo'} value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Select style={{ width: 160 }} value={filters.estado ?? ''} onChange={(e) => setFilter('estado', e.target.value === '' ? '' : e.target.value === 'true')}>
              <option value="">Todo estado</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando afiliados desde PostgreSQL…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargarAfiliados} />
        ) : pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="No hay afiliados registrados" description={modoGlobal ? 'Ninguna entidad tiene afiliados registrados todavía.' : 'Crea el primero o carga una base desde Excel/CSV.'} />
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
                  {modoGlobal && <th>Entidad</th>}
                  <th>Cupo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={`${a.nombres} ${a.apellidos}`} size="sm" />
                        <div>
                          <div style={{ fontWeight: 500 }}>{a.nombres} {a.apellidos}</div>
                          <div className="cell-muted text-mono">{a.documento}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-small">{a.correo}<div className="cell-muted">{a.telefono ?? '—'}</div></td>
                    {modoGlobal && <td className="text-small">{a.cooperativa_nombre ?? '—'}</td>}
                    <td className="text-small">
                      {a.cupo_total != null ? (
                        <>
                          <span className="tabular">{formatCOP(a.cupo_disponible)}</span>
                          <div className="cell-muted">de {formatCOP(a.cupo_total)}</div>
                        </>
                      ) : (
                        <span className="cell-muted">Sin cupo asignado</span>
                      )}
                    </td>
                    <td><StatusBadge status={a.estado} /></td>
                    <td className="right">{!modoGlobal && <Link to={`${base}/afiliados/${a.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver</Link>}</td>
                  </tr>
                ))}
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
        <p style={{ marginTop: 0 }}>Archivo Excel o CSV con columnas: documento, nombres, apellidos, correo, telefono, cupo_total, estado. Es un upsert: actualiza por documento si ya existe. Se envía a <code>POST /api/afiliados/carga-masiva</code>.</p>
        {isSuperAdmin && selected && (
          <p className="text-caption" style={{ marginTop: -8, marginBottom: 12 }}>Estás gestionando datos de: <strong>{selected.nombre}</strong></p>
        )}
        <FileUploader hint="Excel o CSV · máx. 10 MB" onFile={handleUpload} />
        {uploading && <LoadingState title="Procesando archivo en el backend…" />}
        {!uploading && uploadResult && (
          <div style={{ marginTop: 16 }}>
            <Alert tone={uploadResult.invalidos > 0 ? 'error' : 'success'} title={uploadResult.detail}>
              {uploadResult.errores?.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {uploadResult.errores.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {uploadResult.errores.length > 10 && <li>…y {uploadResult.errores.length - 10} fila(s) más.</li>}
                </ul>
              )}
              {uploadResult.cambios?.length > 0 && (
                <>
                  <div className="text-caption" style={{ marginTop: 10, fontWeight: 600 }}>Qué cambió exactamente:</div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {uploadResult.cambios.slice(0, 10).map((c, i) => <li key={i}>{c}</li>)}
                    {uploadResult.cambios.length > 10 && <li>…y {uploadResult.cambios.length - 10} cambio(s) más.</li>}
                  </ul>
                </>
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
          {isSuperAdmin && selected && (
            <p className="text-caption" style={{ marginTop: 0, marginBottom: 12 }}>Estás gestionando datos de: <strong>{selected.nombre}</strong></p>
          )}
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
        </form>
      </Modal>
    </div>
  );
}
