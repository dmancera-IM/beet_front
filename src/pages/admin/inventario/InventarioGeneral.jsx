import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { KpiCard } from '../../../components/ui/Card';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { IconWarningTriangle } from '../../../components/ui/Icons';
import { ErrorState, LoadingState, EmptyState } from '../../../components/ui/States';
import { useCooperativa } from '../../../context/CooperativaContext';
import RequireCooperativaSeleccionada from '../../../components/layout/RequireCooperativaSeleccionada';
import * as convenioService from '../../../services/convenioService';
import * as inventarioService from '../../../services/inventarioService';
import { ApiError } from '../../../services/apiClient';
import { useAreaBase } from '../../../hooks/useAreaBase';

export default function InventarioGeneral() {
  useSetBreadcrumbs([{ label: 'Inventario' }]);
  const { necesitaSeleccion, selectedId } = useCooperativa();
  const base = useAreaBase();

  const [convenios, setConvenios] = useState([]);
  const [resumenes, setResumenes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    if (necesitaSeleccion) return;
    setLoading(true);
    setError(null);
    convenioService
      .listarConvenios({ pageSize: 100 })
      .then((data) => {
        setConvenios(data.items);
        return Promise.all(
          data.items.map((c) =>
            inventarioService
              .resumenInventario(c.id)
              .then((r) => [c.id, r])
              .catch(() => [c.id, null])
          )
        );
      })
      .then((pairs) => setResumenes(Object.fromEntries(pairs)))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar el inventario.'))
      .finally(() => setLoading(false));
  }, [necesitaSeleccion]);

  useEffect(() => { cargar(); }, [cargar, selectedId]);

  if (necesitaSeleccion) {
    return (
      <div>
        <div className="page-header">
          <div><h1 className="text-h1 page-title">Inventario</h1></div>
        </div>
        <RequireCooperativaSeleccionada />
      </div>
    );
  }

  if (loading) return <LoadingState title="Cargando inventario desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;

  const totales = Object.values(resumenes).reduce(
    (acc, r) => ({
      disponible: acc.disponible + (r?.disponible ?? 0),
      entregada: acc.entregada + (r?.entregada ?? 0),
      vencida: acc.vencida + (r?.vencida ?? 0),
      cancelada: acc.cancelada + (r?.cancelada ?? 0),
    }),
    { disponible: 0, entregada: 0, vencida: 0, cancelada: 0 }
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Inventario</h1>
          <p className="page-subtitle">Visibilidad en tiempo real del inventario por convenio, directamente desde PostgreSQL.</p>
        </div>
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Disponible" value={totales.disponible} deltaTone="neutral" delta="Unidades listas para venta" />
        <KpiCard label="Entregada" value={totales.entregada} deltaTone="neutral" delta="Asignadas a afiliados" />
        <KpiCard label="Vencidas" value={totales.vencida} deltaTone="warning" delta="Sin redimir, fuera de vigencia" icon={<IconWarningTriangle size={14} color="var(--warning)" />} />
        <KpiCard label="Canceladas" value={totales.cancelada} deltaTone="neutral" delta="Códigos anulados" />
      </div>

      {convenios.length === 0 ? (
        <EmptyState title="No hay convenios registrados" description="Crea un convenio para poder cargar inventario." />
      ) : (
        <div className="table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th className="right">Disponible</th>
                  <th className="right">Entregada</th>
                  <th className="right">Vencida</th>
                  <th className="right">Cancelada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {convenios.map((c) => {
                  const inv = resumenes[c.id];
                  return (
                    <tr key={c.id}>
                      <td className="cell-primary">
                        {c.nombre}
                        {!c.estado && <StatusBadge status={c.estado} />}
                      </td>
                      <td className="right tabular">{inv?.disponible ?? '—'}</td>
                      <td className="right tabular">{inv?.entregada ?? '—'}</td>
                      <td className="right">
                        {inv?.vencida > 0 ? <Badge tone="amber">{inv.vencida}</Badge> : <span className="tabular">{inv?.vencida ?? 0}</span>}
                      </td>
                      <td className="right tabular">{inv?.cancelada ?? '—'}</td>
                      <td className="right"><Link to={`${base}/inventario/${c.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver detalle</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
