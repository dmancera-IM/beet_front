import { useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { Field, Input, Switch } from '../../../components/ui/Field';
import { IconPlus } from '../../../components/ui/Icons';
import { EmptyState } from '../../../components/ui/States';
import { useToast } from '../../../context/ToastContext';
import GesNav from './GesNav';
import { PROVEEDORES, agregarConvenioCatalogo, agregarProducto, getProductos, toggleConvenioCatalogo, toggleProducto } from './gesData';

// Catálogo maestro de convenios de BEET (sección 9): GES lo crea y
// mantiene aquí; las cooperativas solo pueden seleccionar de esta lista
// desde "Agregar convenio" en su propio panel — nunca escriben un nombre
// nuevo. Todavía no se definen contratos, precios ni condiciones acá, eso
// lo configura cada cooperativa por su lado (Convenios → Modificar convenio).
export default function ConveniosCatalogo() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Convenios' }]);
  const { push } = useToast();

  const [, setVersion] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [productosConvenio, setProductosConvenio] = useState(null);
  const [nuevoProducto, setNuevoProducto] = useState('');
  const [productoError, setProductoError] = useState('');
  const [savingProducto, setSavingProducto] = useState(false);

  // PROVEEDORES se muta in-place (push), nunca se reasigna — leerlo
  // directamente en cada render ya refleja los convenios agregados; solo
  // hace falta forzar el re-render con setVersion tras agregar uno.
  const catalogo = PROVEEDORES;

  const handleClose = () => {
    if (saving) return;
    setFormOpen(false);
    setNombre('');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const nuevo = agregarConvenioCatalogo(nombre);
      push({ title: 'Convenio agregado al catálogo', description: nuevo.nombre });
      setFormOpen(false);
      setNombre('');
      setError('');
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (p) => {
    toggleConvenioCatalogo(p.id);
    push({ title: p.estado ? 'Convenio desactivado' : 'Convenio activado', description: `${p.nombre} · catálogo maestro de GES` });
    setVersion((v) => v + 1);
  };

  const abrirProductos = (convenio) => {
    setProductosConvenio(convenio);
    setNuevoProducto('');
    setProductoError('');
  };

  const cerrarProductos = () => {
    if (savingProducto) return;
    setProductosConvenio(null);
  };

  const handleToggleProducto = (producto) => {
    toggleProducto(producto.id);
    push({ title: producto.estado ? 'Producto desactivado' : 'Producto activado', description: `${producto.nombre} · ${productosConvenio.nombre}` });
    setVersion((v) => v + 1);
  };

  const handleAgregarProducto = (e) => {
    e.preventDefault();
    setSavingProducto(true);
    try {
      const nuevo = agregarProducto({ proveedorId: productosConvenio.id, nombre: nuevoProducto });
      push({ title: 'Producto agregado', description: `${nuevo.nombre} · ${productosConvenio.nombre}` });
      setNuevoProducto('');
      setProductoError('');
      setVersion((v) => v + 1);
    } catch (err) {
      setProductoError(err.message);
    } finally {
      setSavingProducto(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Convenios</h1>
          <p className="page-subtitle">Catálogo maestro de convenios de BEET. Las cooperativas eligen de esta lista para asociarlos a su propio panel.</p>
        </div>
        <div className="page-header-actions">
          <Button icon={<IconPlus color="#fff" />} onClick={() => setFormOpen(true)}>Agregar convenio</Button>
        </div>
      </div>

      <GesNav />

      <div className="table-card">
        {catalogo.length === 0 ? (
          <EmptyState title="Sin convenios en el catálogo" description="Agrega el primer convenio para que las cooperativas puedan seleccionarlo." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {catalogo.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-primary">{p.nombre}</td>
                    <td>
                      <Switch label={p.estado ? 'Activo' : 'Inactivo'} checked={p.estado} onChange={() => handleToggle(p)} />
                    </td>
                    <td className="right">
                      <Button size="sm" variant="secondary" onClick={() => abrirProductos(p)}>Ver productos</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={handleClose}
        title="Agregar convenio:"
        actions={
          <>
            <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={saving}>Agregar</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <Field label="Nombre del convenio" error={error}>
            <Input value={nombre} onChange={(e) => { setNombre(e.target.value); setError(''); }} placeholder="Ej: Museo Nacional" />
          </Field>
        </form>
      </Modal>

      <Modal
        open={!!productosConvenio}
        onClose={cerrarProductos}
        title={productosConvenio ? `Productos · ${productosConvenio.nombre}` : ''}
        actions={<Button variant="secondary" onClick={cerrarProductos}>Cerrar</Button>}
      >
        {productosConvenio && (
          <div>
            {getProductos(productosConvenio.id).length === 0 ? (
              <EmptyState title="Sin productos" description="Agrega el primer producto de este convenio." />
            ) : (
              <div className="table-scroll" style={{ marginBottom: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getProductos(productosConvenio.id).map((prod) => (
                      <tr key={prod.id}>
                        <td className="cell-primary">{prod.nombre}</td>
                        <td>
                          <Switch label={prod.estado ? 'Activo' : 'Inactivo'} checked={prod.estado} onChange={() => handleToggleProducto(prod)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form onSubmit={handleAgregarProducto} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Field label="Nuevo producto" error={productoError}>
                  <Input value={nuevoProducto} onChange={(e) => { setNuevoProducto(e.target.value); setProductoError(''); }} placeholder="Ej: Entrada 2D" />
                </Field>
              </div>
              <Button type="submit" loading={savingProducto}>Agregar</Button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
