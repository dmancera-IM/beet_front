import { useCallback, useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Input, Select } from '../../../components/ui/Field';
import { IconBuscar } from '../../../components/ui/Icons';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import GesNav from './GesNav';
import SolicitudesTable from './SolicitudesTable';
import * as solicitudesService from '../../../services/solicitudesService';
import * as adminService from '../../../services/adminService';
import * as convenioService from '../../../services/convenioService';
import { useToast } from '../../../context/ToastContext';

// Real: `solicitudes_compra` completa (beet_backend/app/routers/solicitudes.py)
// — reemplaza el mock `getSolicitudes()` de gesData.js.
export default function GesTransacciones() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Transacciones' }]);
  const { push } = useToast();

  const [solicitudes, setSolicitudes] = useState([]);
  const [cooperativasById, setCooperativasById] = useState({});
  const [productosById, setProductosById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([solicitudesService.listarSolicitudes(), adminService.listarCooperativas(), convenioService.listarProductos({})])
      .then(([sols, coops, prods]) => {
        setSolicitudes(sols);
        setCooperativasById(Object.fromEntries(coops.map((c) => [c.id, c])));
        setProductosById(Object.fromEntries(prods.map((p) => [p.id, p])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const completar = async (id) => {
    try {
      await solicitudesService.completarSolicitud(id);
      push({ title: 'Solicitud completada', description: `Solicitud #${id}` });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo completar', description: err.message, variant: 'error' });
    }
  };

  const filtradas = solicitudes.filter((s) => {
    if (estadoFiltro && s.estado !== estadoFiltro) return false;
    if (!search.trim()) return true;
    const nombre = cooperativasById[s.id_cooperativa]?.nombre ?? '';
    return nombre.toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Transacciones</h1>
          <p className="page-subtitle">Solicitudes de compra entre GES y las entidades.</p>
        </div>
      </div>

      <GesNav />

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar entidad..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Select style={{ width: 160 }} value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
              <option value="">Todo estado</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="COMPLETADA">Completada</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando solicitudes desde PostgreSQL…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : filtradas.length === 0 ? (
          <EmptyState title="Sin solicitudes" description="Las solicitudes de compra entre GES y las entidades aparecerán aquí." />
        ) : (
          <SolicitudesTable solicitudes={filtradas} cooperativasById={cooperativasById} productosById={productosById} onCompletar={completar} />
        )}
      </div>
    </div>
  );
}
