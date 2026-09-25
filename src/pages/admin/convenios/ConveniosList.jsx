import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import { Field, Input } from '../../../components/ui/Field';
import { IconBuscar, IconPlus } from '../../../components/ui/Icons';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import * as convenioService from '../../../services/convenioService';
import { ApiError } from '../../../services/apiClient';
import { formatCOP } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

// ADAPTADO AL BACKEND REAL: la tabla `convenios` (y `productos`) es un
// catálogo GLOBAL de GES — no existe `cooperativa_convenios` (que traía
// precio_normal/precio_beet/vigencia POR cooperativa) en las 13 tablas de
// este alcance. Por eso esta pantalla ahora muestra el catálogo real tal
// cual, sin precios/ahorro/vigencia por entidad (esos campos no existen en
// ningún lado del esquema actual). Solo GES/SUPER_ADMIN pueden crear/activar
// convenios y productos (el backend lo exige); ADMIN/LECTOR lo ven en
// modo lectura.
export default function ConveniosList() {
  useSetBreadcrumbs([{ label: 'Convenios' }]);
  const navigate = useNavigate();
  const { push } = useToast();
  const { role, roles } = useAuth();
  const base = useAreaBase();
  const puedeEscribir = role === roles.GES || role === roles.SUPER_ADMIN;

  const [convenios, setConvenios] = useState([]);
  const [productosPorConvenio, setProductosPorConvenio] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    convenioService
      .listarConvenios()
      .then(async (data) => {
        setConvenios(data);
        const pares = await Promise.all(
          data.map((c) => convenioService.listarProductos({ idConvenio: c.id }).then((p) => [c.id, p]).catch(() => [c.id, []]))
        );
        setProductosPorConvenio(Object.fromEntries(pares));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar los convenios.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleEstado = async (convenio) => {
    try {
      const actualizado = await convenioService.actualizarConvenio(convenio.id, { estado: !convenio.estado });
      setConvenios((prev) => prev.map((c) => (c.id === convenio.id ? actualizado : c)));
      push({ title: actualizado.estado ? 'Convenio activado' : 'Convenio desactivado', description: convenio.nombre });
    } catch (err) {
      push({ title: 'No se pudo actualizar el convenio', description: err.message, variant: 'error' });
    }
  };

  const filtrados = convenios.filter((c) => c.nombre.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Convenios</h1>
          <p className="page-subtitle">Catálogo de convenios y productos, desde PostgreSQL.</p>
        </div>
        {puedeEscribir && (
          <div className="page-header-actions">
            <Button icon={<IconPlus color="#fff" />} onClick={() => navigate(`${base}/convenios/nuevo`)}>Crear convenio</Button>
          </div>
        )}
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 260 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar por nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando convenios desde PostgreSQL…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : filtrados.length === 0 ? (
          <EmptyState title="No hay convenios registrados" description="GES todavía no ha creado ningún convenio." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th>Productos</th>
                  <th>Estado</th>
                  {puedeEscribir && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const productos = productosPorConvenio[c.id] ?? [];
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`${base}/convenios/${c.id}`} className="cell-primary" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{c.nombre}</Link>
                      </td>
                      <td className="text-small">
                        {productos.length === 0
                          ? 'Sin productos'
                          : productos.map((p) => `${p.nombre} (${p.precio_venta_entidad != null ? formatCOP(p.precio_venta_entidad) : 'sin precio'})`).join(', ')}
                      </td>
                      <td><StatusBadge status={c.estado} /></td>
                      {puedeEscribir && (
                        <td className="right">
                          <Button size="sm" variant="secondary" onClick={() => toggleEstado(c)}>
                            {c.estado ? 'Desactivar' : 'Activar'}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
