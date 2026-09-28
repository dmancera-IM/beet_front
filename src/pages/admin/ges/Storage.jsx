import { useCallback, useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { KpiCard } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Field';
import { IconBuscar } from '../../../components/ui/Icons';
import { Input } from '../../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/Badge';
import { Pagination } from '../../../components/ui/Nav';
import * as storageService from '../../../services/storageService';
import * as convenioService from '../../../services/convenioService';
import GesNav from './GesNav';

// Storage es SOLO consulta/listado: la carga de códigos reales (recibidos
// del proveedor, nunca generados por BEET) vive exclusivamente en
// "Carga de bonos y boletas" (ComprarBonos.jsx), que sube el Excel real y
// llama al mismo POST /storage/bulk. Esta pantalla ya no permite cargar
// nada — evita que haya dos caminos distintos para meter códigos.
export default function Storage() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Storage' }]);

  const [storage, setStorage] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [convenioFiltro, setConvenioFiltro] = useState('');
  const [page, setPage] = useState(1);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([storageService.listarStorage(), convenioService.listarConvenios(), convenioService.listarProductos({})])
      .then(([s, c, p]) => {
        setStorage(s);
        setConvenios(c);
        setProductos(p);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const productoNombre = (id) => productos.find((p) => p.id === id)?.nombre ?? `#${id}`;
  const convenioNombreDeProducto = (idProducto) => {
    const p = productos.find((pr) => pr.id === idProducto);
    return convenios.find((c) => c.id === p?.id_convenio)?.nombre ?? '—';
  };

  const filtrado = storage
    .filter((s) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${convenioNombreDeProducto(s.id_producto)} ${productoNombre(s.id_producto)} ${s.codigo} ${s.estado}`.toLowerCase().includes(q);
    })
    .filter((s) => !convenioFiltro || String(productos.find((p) => p.id === s.id_producto)?.id_convenio) === String(convenioFiltro))
    .filter((s) => !estadoFiltro || s.estado === estadoFiltro);
  const totalPages = Math.max(1, Math.ceil(filtrado.length / 20));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtrado.slice((currentPage - 1) * 20, currentPage * 20);
  const disponibles = storage.filter((s) => s.estado === 'DISPONIBLE').length;
  const asignados = storage.filter((s) => s.estado === 'ASIGNADO').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Storage</h1>
          <p className="page-subtitle">Consulta de códigos cargados, desde PostgreSQL. La carga se hace desde "Carga de bonos y boletas".</p>
        </div>
      </div>

      <GesNav />

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Disponibles" value={disponibles.toLocaleString('es-CO')} deltaTone="neutral" delta="Listos para asignar" />
        <KpiCard label="Asignados" value={asignados.toLocaleString('es-CO')} deltaTone="neutral" delta="Entregados a entidades" />
        <KpiCard label="Total" value={storage.length.toLocaleString('es-CO')} deltaTone="neutral" delta="En Storage" />
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 260 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar convenio, producto o código..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </label>
            <Select style={{ width: 210 }} value={convenioFiltro} onChange={(e) => { setConvenioFiltro(e.target.value); setPage(1); }}>
              <option value="">Todo convenio</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
            <Select style={{ width: 180 }} value={estadoFiltro} onChange={(e) => { setEstadoFiltro(e.target.value); setPage(1); }}>
              <option value="">Todo estado</option>
              <option value="DISPONIBLE">Disponible</option>
              <option value="ASIGNADO">Asignado</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando storage desde PostgreSQL…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : filtrado.length === 0 ? (
          <EmptyState title="Sin códigos en Storage" description="Carga códigos desde 'Carga de bonos y boletas'." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-primary">{convenioNombreDeProducto(s.id_producto)}</td>
                    <td>{productoNombre(s.id_producto)}</td>
                    <td className="text-small tabular">{s.codigo}</td>
                    <td><StatusBadge status={s.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} totalLabel={`Mostrando ${pageRows.length} de ${filtrado.length} códigos`} />
          </div>
        )}
      </div>
    </div>
  );
}
