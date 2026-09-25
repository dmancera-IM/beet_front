import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Tabs } from '../../../components/ui/Nav';
import { StatusBadge } from '../../../components/ui/Badge';
import { Field, Select } from '../../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import Alert from '../../../components/ui/Alert';
import * as convenioService from '../../../services/convenioService';
import * as inventarioService from '../../../services/inventarioService';
import { useCooperativa } from '../../../context/CooperativaContext';
import { formatDateTime } from '../../../utils/format';
import { useAreaBase } from '../../../hooks/useAreaBase';

const TABS = [
  { key: 'DISPONIBLE', label: 'Disponibles' },
  { key: 'ENTREGADA', label: 'Entregadas' },
  { key: 'VENCIDA', label: 'Vencidas' },
  { key: '', label: 'Todo el historial' },
];

// ADAPTADO AL BACKEND REAL: `:convenioId` identifica un convenio real; un
// convenio puede tener varios productos, así que se elige cuál ver con el
// Select. No existe carga de inventario por archivo en el backend real — el
// inventario solo crece cuando una solicitud de compra se completa (ver
// solicitudesService.js) — así que se retiró el uploader por uno que nunca
// podría completarse contra la base de datos real.
export default function InventarioConvenio() {
  const { convenioId } = useParams();
  const navigate = useNavigate();
  const { selectedId } = useCooperativa();
  const base = useAreaBase();

  const [convenio, setConvenio] = useState(null);
  const [loadingConvenio, setLoadingConvenio] = useState(true);
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState('');

  const [tab, setTab] = useState('DISPONIBLE');
  const [unidades, setUnidades] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [error, setError] = useState(null);

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
        return convenioService.listarProductos({ idConvenio: c.id });
      })
      .then((prods) => {
        setProductos(prods);
        setProductoId((prev) => prev || String(prods[0]?.id ?? ''));
      })
      .catch(() => setConvenio(null))
      .finally(() => setLoadingConvenio(false));
  }, [convenioId]);

  const cargarUnidades = useCallback(() => {
    if (!productoId) { setUnidades([]); setLoadingUnidades(false); return; }
    setLoadingUnidades(true);
    setError(null);
    inventarioService
      .listarInventario({ cooperativaId: selectedId || undefined, idProducto: productoId, estado: tab || undefined })
      .then(setUnidades)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingUnidades(false));
  }, [productoId, tab, selectedId]);

  useEffect(() => { cargarUnidades(); }, [cargarUnidades]);

  if (loadingConvenio) return <LoadingState title="Cargando convenio…" />;
  if (!convenio) {
    return <EmptyState title="Convenio no encontrado" actionLabel="Volver a inventario" onAction={() => navigate(`${base}/inventario`)} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{convenio.nombre}</h1>
          <p className="page-subtitle">Inventario real de tu entidad para este convenio.</p>
        </div>
      </div>

      <Alert tone="info" title="Sin carga manual de inventario">
        El inventario solo crece cuando una solicitud de compra se completa (Bolsa/Crédito → Storage GES → tu entidad).
      </Alert>

      <Card padding="card-pad-lg" className="section-gap">
        <Field label="Producto" hint={productos.length === 0 ? 'GES todavía no registró productos para este convenio.' : undefined}>
          <Select value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={productos.length === 0}>
            {productos.length === 0 && <option value="">Sin productos</option>}
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </Field>
      </Card>

      <Card padding="card-pad-lg">
        <Tabs items={TABS} active={tab} onChange={setTab} />
        <div style={{ marginTop: 18 }}>
          {loadingUnidades ? (
            <LoadingState title="Cargando unidades…" />
          ) : error ? (
            <ErrorState description={error} onRetry={cargarUnidades} />
          ) : unidades.length === 0 ? (
            <EmptyState title="No hay unidades en este estado" description="Cuando se complete una solicitud de compra, aparecerán aquí." />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Estado</th>
                    <th>Fecha de asignación</th>
                  </tr>
                </thead>
                <tbody>
                  {unidades.map((u) => (
                    <tr key={u.id}>
                      <td className="text-mono">{u.codigo}</td>
                      <td><StatusBadge status={u.estado} /></td>
                      <td className="text-small">{formatDateTime(u.fecha_asignacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
