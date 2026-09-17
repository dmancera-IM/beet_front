import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Tabs, Pagination } from '../../../components/ui/Nav';
import { StatusBadge } from '../../../components/ui/Badge';
import { Field, Select } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import FileUploader from '../../../components/ui/FileUploader';
import Alert from '../../../components/ui/Alert';
import PermissionGate from '../../../components/ui/PermissionGate';
import { IconDescargar } from '../../../components/ui/Icons';
import * as convenioService from '../../../services/convenioService';
import * as inventarioService from '../../../services/inventarioService';
import { formatDate } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

const TABS = [
  { key: 'DISPONIBLE', label: 'Disponibles' },
  { key: 'ENTREGADA', label: 'Entregadas' },
  { key: 'VENCIDA', label: 'Vencidas' },
  { key: '', label: 'Todo el historial' },
];

// NOTE on the route param: `:convenioId` still identifies the
// cooperativas_convenios row (ConveniosList links here with `c.id`) — but
// inventory now keys off a PRODUCTO id, and one convenio can have several
// productos (sección 7). So this page loads the convenio, loads its
// productos from GES's master catalog, and lets the admin choose which
// producto's inventory to view/load with a Select at the top.
export default function InventarioConvenio() {
  const { convenioId } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const base = useAreaBase();

  const [convenio, setConvenio] = useState(null);
  const [loadingConvenio, setLoadingConvenio] = useState(true);
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState('');

  const [tab, setTab] = useState('DISPONIBLE');
  const [page, setPage] = useState(1);
  const [unidades, setUnidades] = useState({ items: [], total: 0, page: 1, page_size: 8 });
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [error, setError] = useState(null);

  const [uploadState, setUploadState] = useState(null); // { fileName, status, message }
  const [uploading, setUploading] = useState(false);

  useSetBreadcrumbs([
    { label: 'Inventario', to: `${base}/inventario` },
    { label: convenio?.nombre ?? 'Detalle' },
  ]);

  useEffect(() => {
    setLoadingConvenio(true);
    convenioService
      .obtenerConvenio(convenioId)
      .then((c) => {
        setConvenio(c);
        return convenioService.listarProductosDeConvenio(c.id_convenio);
      })
      .then((prods) => {
        setProductos(prods);
        setProductoId((prev) => prev || String(prods[0]?.id ?? ''));
      })
      .catch(() => setConvenio(null))
      .finally(() => setLoadingConvenio(false));
  }, [convenioId]);

  const cargarUnidades = useCallback(() => {
    if (!productoId) { setUnidades({ items: [], total: 0, page: 1, page_size: 8 }); setLoadingUnidades(false); return; }
    setLoadingUnidades(true);
    setError(null);
    inventarioService
      .listarInventario(productoId, { estado: tab || undefined, page, pageSize: 8 })
      .then(setUnidades)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingUnidades(false));
  }, [productoId, tab, page]);

  useEffect(() => { cargarUnidades(); }, [cargarUnidades]);

  if (loadingConvenio) return <LoadingState title="Cargando convenio…" />;
  if (!convenio) {
    return <EmptyState title="Convenio no encontrado" actionLabel="Volver a inventario" onAction={() => navigate(`${base}/inventario`)} />;
  }

  const handleFile = async (file) => {
    const isCsvOrXlsx = /\.(csv|xlsx|xls)$/i.test(file.name);
    if (!isCsvOrXlsx) {
      setUploadState({ fileName: file.name, status: 'error', message: 'Formato no soportado. Usa Excel (.xlsx) o CSV.', errores: [] });
      return;
    }
    setUploading(true);
    try {
      const result = await inventarioService.cargaInventario(productoId, file);
      // A 200 response only means the file was PROCESSED — invalid/duplicate
      // rows still happened, so the box color reflects that instead of
      // always claiming unconditional success.
      const tieneProblemas = result.invalidos > 0 || result.omitidos > 0;
      setUploadState({ fileName: file.name, status: tieneProblemas ? 'error' : 'success', message: result.detail, errores: result.errores ?? [] });
      push({
        title: tieneProblemas ? 'Carga procesada con filas inválidas o duplicadas' : 'Inventario cargado correctamente',
        description: result.detail,
        variant: tieneProblemas ? 'error' : 'success',
      });
      setPage(1);
      cargarUnidades();
    } catch (err) {
      setUploadState({ fileName: file.name, status: 'error', message: err.message, errores: [] });
      push({ title: 'No se pudo cargar el inventario', description: err.message, variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{convenio.nombre}</h1>
          <p className="page-subtitle">Agrega nuevos lotes de códigos a este convenio sin afectar el inventario que ya tienes cargado.</p>
        </div>
      </div>

      <Card padding="card-pad-lg" className="section-gap">
        <Field label="Producto" hint={productos.length === 0 ? 'GES todavía no registró productos para este convenio.' : 'Un convenio puede tener varios productos; el inventario se administra por separado para cada uno.'}>
          <Select value={productoId} onChange={(e) => { setProductoId(e.target.value); setPage(1); }} disabled={productos.length === 0}>
            {productos.length === 0 && <option value="">Sin productos</option>}
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </Field>
      </Card>

      

      <Card padding="card-pad-lg">
        <Tabs items={TABS} active={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        <div style={{ marginTop: 18 }}>
          {loadingUnidades ? (
            <LoadingState title="Cargando unidades…" />
          ) : error ? (
            <ErrorState description={error} onRetry={cargarUnidades} />
          ) : unidades.items.length === 0 ? (
            <EmptyState title="No hay unidades en este estado" description="Cuando se cargue o consuma inventario, aparecerá aquí." />
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Estado</th>
                      <th>Fecha de ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unidades.items.map((u) => (
                      <tr key={u.id}>
                        <td className="text-mono">{u.codigo}</td>
                        <td><StatusBadge status={u.estado} /></td>
                        <td className="text-small">{formatDate(u.fecha_asignacion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={unidades.page}
                totalPages={Math.max(1, Math.ceil(unidades.total / unidades.page_size))}
                onChange={setPage}
                totalLabel={`Mostrando ${unidades.items.length} de ${unidades.total} unidades`}
              />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
