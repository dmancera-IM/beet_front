import { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import { useToast } from '../../../context/ToastContext';
import { asignarInventario, getInventarioCentral, getProveedores } from './gesData';

// Simulación visual de "solicitar/asignar inventario" desde GES hacia una
// cooperativa. El mecanismo comercial (bolsa, crédito, pasarela) todavía no
// está definido — esto solo representa la operación con validaciones
// básicas de frontend (cantidad > 0 y <= disponible en GES).
export default function AsignarInventarioModal({ open, onClose, cooperativa, onAssigned }) {
  const { push } = useToast();
  const inventario = getInventarioCentral();
  const proveedores = getProveedores();
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? '');
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const productosDelConvenio = inventario.filter((i) => i.proveedorId === proveedorId);

  useEffect(() => {
    if (open) {
      const prov = proveedores[0]?.id ?? '';
      setProveedorId((prev) => prev || prov);
      const productosPrev = inventario.filter((i) => i.proveedorId === (proveedorId || prov));
      setProductoId(productosPrev[0]?.productoId ?? '');
      setCantidad('');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const productoSeleccionado = inventario.find((i) => i.productoId === productoId);

  const handleProveedorChange = (id) => {
    setProveedorId(id);
    const productos = inventario.filter((i) => i.proveedorId === id);
    setProductoId(productos[0]?.productoId ?? '');
    setError('');
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = Number(cantidad);
    if (!cantidad || n <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (productoSeleccionado && n > productoSeleccionado.disponible) {
      setError(`Solo hay ${productoSeleccionado.disponible.toLocaleString('es-CO')} unidades disponibles en GES.`);
      return;
    }
    setSaving(true);
    try {
      asignarInventario({ cooperativaId: cooperativa.id, productoId, cantidad: n });
      push({
        title: 'Inventario asignado',
        description: `${n.toLocaleString('es-CO')} unidades de ${productoSeleccionado?.proveedor} · ${productoSeleccionado?.producto} → ${cooperativa.nombre}`,
      });
      onAssigned?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={cooperativa ? `${cooperativa.nombre} · Solicitar / asignar inventario` : 'Asignar inventario'}
      actions={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={saving}>Asignar</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Field label="Convenio">
          <Select value={proveedorId} onChange={(e) => handleProveedorChange(e.target.value)}>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </Field>
        <Field label="Producto">
          <Select value={productoId} onChange={(e) => { setProductoId(e.target.value === '' ? '' : Number(e.target.value)); setError(''); }} disabled={productosDelConvenio.length === 0}>
            {productosDelConvenio.length === 0 ? (
              <option value="">Sin productos para este convenio</option>
            ) : (
              productosDelConvenio.map((p) => (
                <option key={p.productoId} value={p.productoId}>{p.producto}</option>
              ))
            )}
          </Select>
        </Field>
        <Field label="Cantidad" error={error}>
          <Input type="number" min="1" value={cantidad} onChange={(e) => { setCantidad(e.target.value); setError(''); }} placeholder="1000" />
        </Field>
        <p className="text-caption" style={{ marginTop: -8 }}>
          Disponible en Storage: <strong className="tabular">{productoSeleccionado ? productoSeleccionado.disponible.toLocaleString('es-CO') : '—'}</strong> unidades
        </p>
      </form>
    </Modal>
  );
}
