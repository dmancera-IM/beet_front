import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import { Checkbox, Input, Select, Switch } from '../../../components/ui/Field';
import { IconBuscar, IconDescargar, IconPlus } from '../../../components/ui/Icons';
import { Pagination } from '../../../components/ui/Nav';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import PermissionGate from '../../../components/ui/PermissionGate';
import Modal from '../../../components/ui/Modal';
import { useTableState } from '../../../hooks/useTableState';
import * as convenioService from '../../../services/convenioService';
import * as inventarioService from '../../../services/inventarioService';
import { ApiError } from '../../../services/apiClient';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

// Vista de Convenios para ADMIN (sección 10 de la definición funcional):
// GES mantiene el catálogo maestro (convenio → productos); ADMIN solo
// elige qué convenios usa su cooperativa (switch activar/desactivar) y ve
// el inventario que ya adquirió, agregado por convenio. El precio ya NO se
// configura aquí (ver REGLA CRÍTICA, sección 11) — eso se hace por
// producto, dentro del detalle de cada convenio.
export default function ConveniosListAdmin() {
  useSetBreadcrumbs([{ label: 'Convenios' }]);
  const navigate = useNavigate();
  const { push } = useToast();
  const base = useAreaBase();

  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inventarioPorConvenio, setInventarioPorConvenio] = useState({});
  const [exporting, setExporting] = useState(false);

  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [seleccionCatalogo, setSeleccionCatalogo] = useState({});
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);
  const [catalogoMaestro, setCatalogoMaestro] = useState([]);
  const [cargandoCatalogoMaestro, setCargandoCatalogoMaestro] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    convenioService
      .listarConvenios({ pageSize: 100 })
      .then((data) => {
        setConvenios(data.items);
        // El inventario se muestra agregado por convenio (sección 10.2):
        // suma de "disponible" de todos los productos de ese convenio.
        Promise.all(
          data.items.map((c) =>
            convenioService
              .listarProductosDeConvenio(c.id_convenio)
              .then((productos) =>
                productos.length === 0
                  ? [c.id, null]
                  : Promise.all(productos.map((p) => inventarioService.resumenInventario(p.id).catch(() => null))).then((resumenes) => [
                      c.id,
                      resumenes.reduce((s, r) => s + (r?.disponible ?? 0), 0),
                    ])
              )
              .catch(() => [c.id, null])
          )
        ).then((pairs) => setInventarioPorConvenio(Object.fromEntries(pairs)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar los convenios.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const { search, setSearch, filters, setFilter, pageRows, page, setPage, totalPages, total } = useTableState({
    data: convenios,
    searchFields: ['nombre', 'id'],
    pageSize: 10,
    defaultFilters: { estado: true },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await convenioService.exportarConvenios();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      push({ title: 'Convenios exportados', description: filename });
    } catch (err) {
      push({ title: 'No se pudo exportar', description: err.message, variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const toggleEstado = async (convenio) => {
    const nuevoEstado = !convenio.estado;
    try {
      const actualizado = await convenioService.actualizarConvenio(convenio.id, { estado: nuevoEstado });
      setConvenios((prev) => prev.map((c) => (c.id === convenio.id ? actualizado : c)));
      push({ title: nuevoEstado ? 'Convenio activado' : 'Convenio desactivado', description: convenio.nombre });
    } catch (err) {
      push({ title: 'No se pudo actualizar el convenio', description: err.message, variant: 'error' });
    }
  };

  // Catálogo maestro de convenios creado por GES — la cooperativa solo
  // puede elegir de esta lista, nunca escribir un nombre nuevo (sección 11:
  // ADMIN no modifica el catálogo maestro de GES).
  const idsYaAgregados = new Set(convenios.map((c) => c.id_convenio));
  const catalogoDisponible = catalogoMaestro.filter((p) => !idsYaAgregados.has(p.id));

  const abrirCatalogo = () => {
    setSeleccionCatalogo({});
    setCatalogoOpen(true);
    setCargandoCatalogoMaestro(true);
    convenioService
      .listarCatalogoMaestroConvenios()
      .then(setCatalogoMaestro)
      .catch((err) => push({ title: 'No se pudo cargar el catálogo maestro', description: err.message, variant: 'error' }))
      .finally(() => setCargandoCatalogoMaestro(false));
  };

  const confirmarAgregarConvenios = async () => {
    const seleccionados = catalogoDisponible.filter((p) => seleccionCatalogo[p.id]);
    if (seleccionados.length === 0) return;
    setGuardandoCatalogo(true);
    try {
      await Promise.all(
        seleccionados.map((p) => convenioService.crearConvenio({ id_convenio: p.id, nombre: p.nombre, estado: true }))
      );
      push({
        title: seleccionados.length === 1 ? 'Convenio agregado' : 'Convenios agregados',
        description: `${seleccionados.map((p) => p.nombre).join(', ')} — configura precio y vigencia por producto desde el detalle del convenio.`,
      });
      setCatalogoOpen(false);
      cargar();
    } catch (err) {
      push({ title: 'No se pudieron agregar los convenios', description: err.message, variant: 'error' });
    } finally {
      setGuardandoCatalogo(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Convenios</h1>
          <p className="page-subtitle">Convenios que tu cooperativa activó desde el catálogo maestro de GES, con su inventario disponible.</p>
        </div>
        <div className="page-header-actions">
          <PermissionGate>
            <Button icon={<IconPlus color="#fff" />} onClick={abrirCatalogo}>Agregar convenio</Button>
          </PermissionGate>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 260 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar por nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Select
              style={{ width: 140 }}
              value={filters.estado === undefined ? '' : String(filters.estado)}
              onChange={(e) => setFilter('estado', e.target.value === '' ? undefined : e.target.value === 'true')}
            >
              <option value="">Todo estado</option>
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando convenios…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="No hay convenios activados" description="Agrega el primer convenio desde el catálogo maestro de GES." />
          ) : (
            <EmptyState title="Sin convenios que coincidan" description="Ajusta los filtros o el término de búsqueda." />
          )
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th className="right">Inventario disponible</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => {
                  const disponible = inventarioPorConvenio[c.id];
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`${base}/convenios/${c.id}`} className="cell-primary" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{c.nombre}</Link>
                      </td>
                      <td className="right tabular">{disponible == null ? '—' : `${disponible} unidades`}</td>
                      <td>
                        <PermissionGate fallback={<Switch label={c.estado ? 'Activo' : 'Inactivo'} checked={c.estado} disabled />}>
                          <Switch label={c.estado ? 'Activo' : 'Inactivo'} checked={c.estado} onChange={() => toggleEstado(c)} />
                        </PermissionGate>
                      </td>
                      <td className="right"><Link to={`${base}/convenios/${c.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver detalle</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalLabel={`Mostrando ${pageRows.length} de ${total} convenios`} />
        )}
      </div>

      <Modal
        open={catalogoOpen}
        onClose={() => !guardandoCatalogo && setCatalogoOpen(false)}
        title="Agregar convenio"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCatalogoOpen(false)} disabled={guardandoCatalogo}>Cancelar</Button>
            <Button onClick={confirmarAgregarConvenios} loading={guardandoCatalogo} disabled={catalogoDisponible.length === 0}>Agregar</Button>
          </>
        }
      >
        <p className="text-caption cell-muted" style={{ marginTop: 0 }}>
          Selecciona uno o varios convenios del catálogo maestro de GES. El precio para tus afiliados se configura después, producto por producto, desde el detalle del convenio.
        </p>
        {cargandoCatalogoMaestro ? (
          <LoadingState title="Cargando catálogo maestro…" />
        ) : catalogoDisponible.length === 0 ? (
          <EmptyState title="Ya agregaste todos los convenios disponibles" description="GES todavía no ha publicado más convenios en el catálogo maestro." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catalogoDisponible.map((p) => (
              <Checkbox
                key={p.id}
                label={p.nombre}
                checked={!!seleccionCatalogo[p.id]}
                onChange={(e) => setSeleccionCatalogo((s) => ({ ...s, [p.id]: e.target.checked }))}
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
