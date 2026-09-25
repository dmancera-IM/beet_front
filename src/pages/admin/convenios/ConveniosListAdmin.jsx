import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import { Checkbox, Input, Select, Switch } from '../../../components/ui/Field';
import { IconBuscar, IconPlus } from '../../../components/ui/Icons';
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

const PORCENTAJES_GANANCIA = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

export default function ConveniosListAdmin() {
  useSetBreadcrumbs([{ label: 'Convenios' }]);
  const { push } = useToast();
  const base = useAreaBase();

  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inventarioPorConvenio, setInventarioPorConvenio] = useState({});

  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [seleccionCatalogo, setSeleccionCatalogo] = useState({});
  const [guardandoCatalogo, setGuardandoCatalogo] = useState(false);
  const [catalogoDisponible, setCatalogoDisponible] = useState([]);
  const [cargandoCatalogoMaestro, setCargandoCatalogoMaestro] = useState(false);
  const [guardandoGanancia, setGuardandoGanancia] = useState(null);
  const [guardandoEstado, setGuardandoEstado] = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    convenioService
      .listarConveniosCooperativa()
      .then((data) => {
        setConvenios(data);
        Promise.all(
          data.map((c) =>
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
    searchFields: ['nombre', 'id_convenio'],
    pageSize: 10,
  });

  const cambiarGanancia = async (convenio, porcentaje) => {
    setGuardandoGanancia(convenio.id);
    try {
      await convenioService.actualizarConvenioCooperativa(convenio.id_convenio, { porcentaje_ganancia_entidad: Number(porcentaje) });
      push({ title: 'Ganancia actualizada', description: `${convenio.nombre}: ${porcentaje}% — todos sus productos la heredan.` });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo actualizar la ganancia', description: err.message, variant: 'error' });
    } finally {
      setGuardandoGanancia(null);
    }
  };

  const toggleEstado = async (convenio) => {
    const nuevoEstado = !convenio.estado;
    if (nuevoEstado && !convenio.puede_activarse) {
      push({ title: 'Faltan datos para activar', description: 'Configura el porcentaje y al menos un producto activo con precio público.', variant: 'error' });
      return;
    }
    setGuardandoEstado(convenio.id);
    try {
      await convenioService.cambiarEstadoConvenioCooperativa(convenio.id_convenio, nuevoEstado);
      push({ title: nuevoEstado ? 'Convenio activado' : 'Convenio desactivado', description: convenio.nombre });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo actualizar el convenio', description: err.message, variant: 'error' });
    } finally {
      setGuardandoEstado(null);
    }
  };

  const abrirCatalogo = () => {
    setSeleccionCatalogo({});
    setCatalogoOpen(true);
    setCargandoCatalogoMaestro(true);
    convenioService
      .listarConveniosDisponiblesCooperativa()
      .then(setCatalogoDisponible)
      .catch((err) => push({ title: 'No se pudo cargar el catálogo maestro', description: err.message, variant: 'error' }))
      .finally(() => setCargandoCatalogoMaestro(false));
  };

  const confirmarAgregarConvenios = async () => {
    const seleccionados = catalogoDisponible.filter((p) => seleccionCatalogo[p.id]);
    if (seleccionados.length === 0) return;
    setGuardandoCatalogo(true);
    try {
      await Promise.all(seleccionados.map((p) => convenioService.agregarConvenioCooperativa(p.id)));
      push({
        title: seleccionados.length === 1 ? 'Convenio agregado' : 'Convenios agregados',
        description: 'Quedan desactivados hasta configurar ganancia y productos.',
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
          <p className="page-subtitle">Convenios que tu entidad agregó desde el catálogo maestro de GES.</p>
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
          total === 0 ? <EmptyState title="No hay convenios agregados" description="Agrega el primer convenio desde el catálogo maestro de GES." /> : <EmptyState title="Sin convenios que coincidan" description="Ajusta los filtros o el término de búsqueda." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th className="right">Inventario disponible</th>
                  <th>Ganancia de la entidad</th>
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
                        <Link to={`${base}/convenios/${c.id_convenio}`} className="cell-primary" style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{c.nombre}</Link>
                      </td>
                      <td className="right tabular">{disponible == null ? '—' : `${disponible} unidades`}</td>
                      <td>
                        <PermissionGate fallback={<span className="text-small">{c.porcentaje_ganancia_entidad != null ? `${c.porcentaje_ganancia_entidad}%` : 'Sin configurar'}</span>}>
                          <Select
                            style={{ width: 100 }}
                            value={c.porcentaje_ganancia_entidad ?? ''}
                            disabled={guardandoGanancia === c.id}
                            onChange={(e) => cambiarGanancia(c, e.target.value)}
                          >
                            <option value="" disabled>Elegir</option>
                            {PORCENTAJES_GANANCIA.map((p) => <option key={p} value={p}>{p}%</option>)}
                          </Select>
                        </PermissionGate>
                      </td>
                      <td>
                        <PermissionGate fallback={<Switch label={c.estado ? 'Activo' : 'Inactivo'} checked={c.estado} disabled />}>
                          <Switch
                            label={c.estado ? 'Activo' : 'Inactivo'}
                            checked={c.estado}
                            onChange={() => toggleEstado(c)}
                            disabled={guardandoEstado === c.id || (!c.estado && !c.puede_activarse)}
                            title={!c.estado && !c.puede_activarse ? 'Configura porcentaje y al menos un producto antes de activar' : undefined}
                          />
                        </PermissionGate>
                      </td>
                      <td className="right">
                        <Link to={`${base}/convenios/${c.id_convenio}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          {!c.estado && !c.puede_activarse ? 'Configurar' : 'Ver detalle'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && <Pagination page={page} totalPages={totalPages} onChange={setPage} totalLabel={`Mostrando ${pageRows.length} de ${total} convenios`} />}
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
          Selecciona uno o varios convenios del catálogo maestro de GES. Luego configura ganancia y productos.
        </p>
        {cargandoCatalogoMaestro ? (
          <LoadingState title="Cargando catálogo maestro…" />
        ) : catalogoDisponible.length === 0 ? (
          <EmptyState title="Ya agregaste todos los convenios disponibles" description="GES todavía no ha publicado más convenios activos." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catalogoDisponible.map((p) => (
              <Checkbox key={p.id} label={p.nombre} checked={!!seleccionCatalogo[p.id]} onChange={(e) => setSeleccionCatalogo((s) => ({ ...s, [p.id]: e.target.checked }))} />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
