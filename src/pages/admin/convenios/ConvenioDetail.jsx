import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { Field, Input } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import * as convenioService from '../../../services/convenioService';
import { formatCOP } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

// ADAPTADO AL BACKEND REAL: sin `cooperativa_convenios`/`cooperativa_productos`
// no hay precio al afiliado, vigencia ni inventario "por convenio" que
// mostrar aquí — solo lo que el catálogo global de GES realmente guarda
// (productos con su `precio_venta_entidad`, el precio que GES le cobra a
// la cooperativa). Ver informe de integración.
export default function ConvenioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useAreaBase();
  const { push } = useToast();
  const { role, roles } = useAuth();
  const puedeEscribir = role === roles.GES || role === roles.SUPER_ADMIN;

  const [convenio, setConvenio] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({ nombre: '', descripcion: '', precio_venta_entidad: '' });
  const [saving, setSaving] = useState(false);

  useSetBreadcrumbs([
    { label: 'Convenios', to: `${base}/convenios` },
    { label: convenio?.nombre ?? 'Detalle' },
  ]);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    convenioService
      .obtenerConvenio(id)
      .then((c) => {
        setConvenio(c);
        return convenioService.listarProductos({ idConvenio: c.id });
      })
      .then(setProductos)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const crearProducto = async () => {
    setSaving(true);
    try {
      await convenioService.crearProducto({
        id_convenio: convenio.id,
        nombre: draft.nombre.trim(),
        descripcion: draft.descripcion.trim() || null,
        precio_venta_entidad: draft.precio_venta_entidad ? Number(draft.precio_venta_entidad) : null,
      });
      push({ title: 'Producto creado', description: draft.nombre });
      setFormOpen(false);
      setDraft({ nombre: '', descripcion: '', precio_venta_entidad: '' });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo crear el producto', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleProducto = async (producto) => {
    try {
      const actualizado = await convenioService.actualizarProducto(producto.id, { estado: !producto.estado });
      setProductos((prev) => prev.map((p) => (p.id === producto.id ? actualizado : p)));
    } catch (err) {
      push({ title: 'No se pudo actualizar el producto', description: err.message, variant: 'error' });
    }
  };

  if (loading) return <LoadingState title="Cargando convenio desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;
  if (!convenio) {
    return <EmptyState title="Convenio no encontrado" actionLabel="Volver a convenios" onAction={() => navigate(`${base}/convenios`)} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{convenio.nombre}</h1>
          <p className="page-subtitle">Catálogo global de GES.</p>
        </div>
        <div className="page-header-actions">
          <StatusBadge status={convenio.estado} />
          {puedeEscribir && (
            <Button variant="secondary" onClick={() => navigate(`${base}/convenios/${convenio.id}/editar`)}>Editar</Button>
          )}
        </div>
      </div>

      <Card padding="card-pad-lg">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span className="text-label">Productos de este convenio</span>
          {puedeEscribir && (
            <Button size="sm" onClick={() => setFormOpen(true)}>Agregar producto</Button>
          )}
        </div>
        {productos.length === 0 ? (
          <EmptyState title="Sin productos" description="Este convenio todavía no tiene productos registrados." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Descripción</th>
                  <th className="right">Precio de venta a la entidad</th>
                  <th>Estado</th>
                  {puedeEscribir && <th></th>}
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-primary">{p.nombre}</td>
                    <td className="cell-muted">{p.descripcion ?? '—'}</td>
                    <td className="right tabular">{p.precio_venta_entidad != null ? formatCOP(p.precio_venta_entidad) : 'Sin configurar'}</td>
                    <td><StatusBadge status={p.estado} /></td>
                    {puedeEscribir && (
                      <td className="right">
                        <Button size="sm" variant="secondary" onClick={() => toggleProducto(p)} disabled={p.estado === false && p.precio_venta_entidad == null}>
                          {p.estado ? 'Desactivar' : 'Activar'}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title="Agregar producto"
        actions={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={crearProducto} loading={saving} disabled={!draft.nombre.trim()}>Crear producto</Button>
          </>
        }
      >
        <Field label="Nombre">
          <Input value={draft.nombre} onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))} placeholder="Entrada 2D" />
        </Field>
        <Field label="Descripción" optional>
          <Input value={draft.descripcion} onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))} />
        </Field>
        <Field label="Precio de venta a la entidad" optional hint="Un producto solo puede activarse una vez tenga precio configurado.">
          <Input type="number" min="0" value={draft.precio_venta_entidad} onChange={(e) => setDraft((d) => ({ ...d, precio_venta_entidad: e.target.value }))} placeholder="4500" />
        </Field>
      </Modal>
    </div>
  );
}
