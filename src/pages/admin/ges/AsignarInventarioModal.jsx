import { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Field';
import { useToast } from '../../../context/ToastContext';
import { asignarInventario, getInventarioCentral } from './gesData';

// Simulación visual de "solicitar/asignar inventario" desde GES hacia una
// cooperativa. El mecanismo comercial (bolsa, crédito, pasarela) todavía no
// está definido — esto solo representa la operación con validaciones
// básicas de frontend (cantidad > 0 y <= disponible en GES).
export default function AsignarInventarioModal({ open, onClose, cooperativa, onAssigned }) {
  const { push } = useToast();
  const inventario = getInventarioCentral();
  const [proveedorId, setProveedorId] = useState(inventario[0]?.proveedorId ?? '');
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProveedorId((prev) => prev || inventario[0]?.proveedorId || '');
      setCantidad('');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const proveedorSeleccionado = inventario.find((i) => i.proveedorId === proveedorId);

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
    if (proveedorSeleccionado && n > proveedorSeleccionado.disponible) {
      setError(`Solo hay ${proveedorSeleccionado.disponible.toLocaleString('es-CO')} unidades disponibles en GES.`);
      return;
    }
    setSaving(true);
    try {
      asignarInventario({ cooperativaId: cooperativa.id, proveedorId, cantidad: n });
      push({
        title: 'Inventario asignado',
        description: `${n.toLocaleString('es-CO')} unidades de ${proveedorSeleccionado?.proveedor} → ${cooperativa.nombre}`,
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
          <Select value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setError(''); }}>
            {inventario.map((i) => (
              <option key={i.proveedorId} value={i.proveedorId}>{i.proveedor}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cantidad" error={error}>
          <Input type="number" min="1" value={cantidad} onChange={(e) => { setCantidad(e.target.value); setError(''); }} placeholder="1000" />
        </Field>
        <p className="text-caption" style={{ marginTop: -8 }}>
          Disponible en Storage: <strong className="tabular">{proveedorSeleccionado ? proveedorSeleccionado.disponible.toLocaleString('es-CO') : '—'}</strong> unidades
        </p>
      </form>
    </Modal>
  );
}
