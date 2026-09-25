import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { KpiCard } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { IconWarningTriangle } from '../../../components/ui/Icons';
import { ErrorState, LoadingState, EmptyState } from '../../../components/ui/States';
import { useCooperativa } from '../../../context/CooperativaContext';
import RequireCooperativaSeleccionada from '../../../components/layout/RequireCooperativaSeleccionada';
import * as convenioService from '../../../services/convenioService';
import * as inventarioService from '../../../services/inventarioService';
import { ApiError } from '../../../services/apiClient';
import { useAreaBase } from '../../../hooks/useAreaBase';

// ADAPTADO AL BACKEND REAL: `GET /inventario` es solo lectura y devuelve
// unidades individuales (id, id_producto, codigo, estado) — no hay un
// endpoint de resumen agregado. Este resumen por convenio/producto se
// calcula aquí mismo, en el cliente, a partir de la lista real.
export default function InventarioGeneral() {
  useSetBreadcrumbs([{ label: 'Inventario' }]);
  const { necesitaSeleccion, selectedId } = useCooperativa();
  const base = useAreaBase();

  const [convenios, setConvenios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    if (necesitaSeleccion) return;
    setLoading(true);
    setError(null);
    Promise.all([
      convenioService.listarConvenios(),
      convenioService.listarProductos({}),
      inventarioService.listarInventario({ cooperativaId: selectedId || undefined }),
    ])
      .then(([c, p, u]) => { setConvenios(c); setProductos(p); setUnidades(u); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar el inventario.'))
      .finally(() => setLoading(false));
  }, [necesitaSeleccion, selectedId]);

  useEffect(() => { cargar(); }, [cargar]);

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

  const resumenPorConvenio = convenios.map((c) => {
    const idsProductos = new Set(productos.filter((p) => p.id_convenio === c.id).map((p) => p.id));
    const unidadesConvenio = unidades.filter((u) => idsProductos.has(u.id_producto));
    return {
      convenio: c,
      disponible: unidadesConvenio.filter((u) => u.estado === 'DISPONIBLE').length,
      entregada: unidadesConvenio.filter((u) => u.estado === 'ENTREGADA').length,
      vencida: unidadesConvenio.filter((u) => u.estado === 'VENCIDA').length,
    };
  }).filter((r) => r.disponible + r.entregada + r.vencida > 0);

  const totales = {
    disponible: unidades.filter((u) => u.estado === 'DISPONIBLE').length,
    entregada: unidades.filter((u) => u.estado === 'ENTREGADA').length,
    vencida: unidades.filter((u) => u.estado === 'VENCIDA').length,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Inventario</h1>
          <p className="page-subtitle">Visibilidad en tiempo real del inventario, directamente desde PostgreSQL.</p>
        </div>
      </div>

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Disponible" value={totales.disponible} deltaTone="neutral" delta="Unidades listas para venta" />
        <KpiCard label="Entregada" value={totales.entregada} deltaTone="neutral" delta="Asignadas a afiliados" />
        <KpiCard label="Vencidas" value={totales.vencida} deltaTone="warning" delta="Fuera de vigencia" icon={<IconWarningTriangle size={14} color="var(--warning)" />} />
      </div>

      {resumenPorConvenio.length === 0 ? (
        <EmptyState title="Sin inventario todavía" description="Cuando una solicitud de compra se complete, el inventario aparecerá aquí." />
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {resumenPorConvenio.map(({ convenio, disponible, entregada, vencida }) => (
                  <tr key={convenio.id}>
                    <td className="cell-primary">{convenio.nombre}</td>
                    <td className="right tabular">{disponible}</td>
                    <td className="right tabular">{entregada}</td>
                    <td className="right">{vencida > 0 ? <Badge tone="amber">{vencida}</Badge> : <span className="tabular">0</span>}</td>
                    <td className="right"><Link to={`${base}/inventario/${convenio.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver detalle</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
