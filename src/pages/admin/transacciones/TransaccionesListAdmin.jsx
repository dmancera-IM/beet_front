import { useCallback, useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Input } from '../../../components/ui/Field';
import { IconBuscar } from '../../../components/ui/Icons';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/Badge';
import { formatDateTime } from '../../../utils/format';
import * as solicitudesService from '../../../services/solicitudesService';
import * as convenioService from '../../../services/convenioService';

// ADAPTADO AL BACKEND REAL: reemplaza gesData.js — historial real de
// `solicitudes_compra` de tu propia entidad (el backend la scopea
// automáticamente con tu id_cooperativa, tomado del JWT).
export default function TransaccionesListAdmin() {
  useSetBreadcrumbs([{ label: 'Transacciones' }]);

  const [solicitudes, setSolicitudes] = useState([]);
  const [productosById, setProductosById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([solicitudesService.listarSolicitudes(), convenioService.listarProductos({})])
      .then(([sols, prods]) => { setSolicitudes(sols); setProductosById(Object.fromEntries(prods.map((p) => [p.id, p]))); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = solicitudes.filter((s) => {
    if (!search.trim()) return true;
    const nombre = productosById[s.id_producto]?.nombre ?? '';
    return nombre.toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Transacciones</h1>
          <p className="page-subtitle">Historial de solicitudes de compra que tu entidad ha hecho a GES.</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar por producto" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando transacciones desde PostgreSQL…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : filtradas.length === 0 ? (
          <EmptyState title="Sin transacciones registradas" description="Las solicitudes de compra que hagas a GES aparecerán aquí." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="right">Cantidad</th>
                  <th>Fecha</th>
                  <th>Forma de pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-primary">{productosById[s.id_producto]?.nombre ?? `#${s.id_producto}`}</td>
                    <td className="right tabular">{s.cantidad.toLocaleString('es-CO')}</td>
                    <td className="text-small">{formatDateTime(s.fecha_solicitud)}</td>
                    <td className="text-small">{s.forma_pago}</td>
                    <td><StatusBadge status={s.estado} /></td>
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
