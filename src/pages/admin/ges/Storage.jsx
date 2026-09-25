import { useCallback, useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { KpiCard } from '../../../components/ui/Card';
import { Field, Select, Textarea } from '../../../components/ui/Field';
import { IconBuscar, IconPlus } from '../../../components/ui/Icons';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Alert from '../../../components/ui/Alert';
import { Input } from '../../../components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/Badge';
import { useToast } from '../../../context/ToastContext';
import * as storageService from '../../../services/storageService';
import * as convenioService from '../../../services/convenioService';
import GesNav from './GesNav';

// ADAPTADO AL BACKEND REAL (beet_backend/app/routers/storage.py): no hay
// parser de Excel/XML definido todavía — el formato del archivo del
// proveedor no está oficialmente definido, así que esta pantalla ya NO
// simula una carga de XML. En su lugar, envía la lista de códigos (uno por
// línea, tal cual, sin generar ni prefijar nada) al endpoint real
// `POST /storage/bulk`. Cuando exista un formato de archivo oficial, un
// parser puede reemplazar este textarea sin tocar el backend.
export default function Storage() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Storage' }]);
  const { push } = useToast();

  const [storage, setStorage] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [convenioId, setConvenioId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [codigosTexto, setCodigosTexto] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [saving, setSaving] = useState(false);

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

  const productosDelConvenio = productos.filter((p) => String(p.id_convenio) === String(convenioId));
  const productoNombre = (id) => productos.find((p) => p.id === id)?.nombre ?? `#${id}`;
  const convenioNombreDeProducto = (idProducto) => {
    const p = productos.find((pr) => pr.id === idProducto);
    return convenios.find((c) => c.id === p?.id_convenio)?.nombre ?? '—';
  };

  const abrirForm = () => {
    const primerConvenio = convenios[0]?.id ?? '';
    setConvenioId(primerConvenio);
    setProductoId(productos.find((p) => String(p.id_convenio) === String(primerConvenio))?.id ?? '');
    setCodigosTexto('');
    setFechaVencimiento('');
    setFormOpen(true);
  };

  const handleConvenioChange = (id) => {
    setConvenioId(id);
    setProductoId(productos.find((p) => String(p.id_convenio) === String(id))?.id ?? '');
  };

  const codigos = codigosTexto.split('\n').map((c) => c.trim()).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productoId || codigos.length === 0) return;
    setSaving(true);
    try {
      await storageService.cargarCodigosEnLote({ idProducto: Number(productoId), codigos, fechaVencimiento: fechaVencimiento || null });
      push({ title: 'Códigos cargados', description: `${codigos.length} código(s) agregados a Storage.` });
      setFormOpen(false);
      cargar();
    } catch (err) {
      push({ title: 'No se pudo cargar el storage', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const filtrado = storage.filter((s) => productoNombre(s.id_producto).toLowerCase().includes(search.trim().toLowerCase()));
  const disponibles = storage.filter((s) => s.estado === 'DISPONIBLE').length;
  const asignados = storage.filter((s) => s.estado === 'ASIGNADO').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Storage</h1>
          <p className="page-subtitle">Códigos disponibles para asignar a las entidades, desde PostgreSQL.</p>
        </div>
        <div className="page-header-actions">
          <Button icon={<IconPlus color="#fff" />} onClick={abrirForm} disabled={convenios.length === 0}>Agregar códigos</Button>
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
              <Input placeholder="Buscar producto..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando storage desde PostgreSQL…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : filtrado.length === 0 ? (
          <EmptyState title="Sin códigos en Storage" description="Los códigos que cargues aparecerán aquí." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {filtrado.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-primary">{convenioNombreDeProducto(s.id_producto)}</td>
                    <td>{productoNombre(s.id_producto)}</td>
                    <td className="text-small tabular">{s.codigo}</td>
                    <td><StatusBadge status={s.estado} /></td>
                    <td className="text-small">{s.fecha_vencimiento ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title="Agregar códigos a Storage"
        actions={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={saving} disabled={!productoId || codigos.length === 0}>
              Cargar {codigos.length > 0 ? `${codigos.length} código(s)` : ''}
            </Button>
          </>
        }
      >
        <Alert tone="info" title="Sin formato de Excel/XML definido todavía">
          El backend actual no tiene un parser de archivo definido — pega aquí los códigos exactamente como vienen de la fuente,
          uno por línea. No se genera ni prefija ningún código.
        </Alert>
        <Field label="Convenio">
          <Select value={convenioId} onChange={(e) => handleConvenioChange(e.target.value)}>
            {convenios.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
        </Field>
        <Field label="Producto">
          <Select value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={productosDelConvenio.length === 0}>
            {productosDelConvenio.length === 0 ? (
              <option value="">Sin productos para este convenio</option>
            ) : (
              productosDelConvenio.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))
            )}
          </Select>
        </Field>
        <Field label="Fecha de vencimiento" optional>
          <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
        </Field>
        <Field label="Códigos (uno por línea)">
          <Textarea rows={6} value={codigosTexto} onChange={(e) => setCodigosTexto(e.target.value)} placeholder={'ABC-001\nABC-002\nABC-003'} />
        </Field>
      </Modal>
    </div>
  );
}
