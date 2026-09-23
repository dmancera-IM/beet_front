import { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { Field, Input, Textarea, Switch } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import { LoadingState } from '../../../components/ui/States';
import * as convenioService from '../../../services/convenioService';
import { formatCOP } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';

const emptyForm = {
  precio_normal: '',
  fecha_inicio: '',
  fecha_fin: '',
  descripcion: '',
  activo: false,
};

// Configuración de UN producto para la cooperativa (sección 2 y 8 de
// "Ganancia por convenio y precios por producto"), como popup/modal ancho
// (sección 6) en vez de una ruta propia — el precio pertenece a cooperativa
// + producto, nunca al convenio (ese sigue siendo `productos_convenio`,
// propiedad de GES, que este modal jamás edita). El ADMIN solo modifica el
// precio normal: el precio GES→entidad y la ganancia del convenio se
// muestran como datos heredados/calculados, no como campos editables aquí
// (sección 8).
export default function ProductoConfigModal({ open, productoId, convenioId, convenioNombre, onClose, onSaved }) {
  const { push } = useToast();

  const [form, setForm] = useState(emptyForm);
  const [productoNombre, setProductoNombre] = useState('');
  const [precioGesEntidad, setPrecioGesEntidad] = useState(null);
  const [porcentajeGanancia, setPorcentajeGanancia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open || !productoId) return;
    setLoading(true);
    convenioService
      .obtenerConfiguracionProducto(productoId)
      .then((p) => {
        setProductoNombre(p.nombre);
        setPrecioGesEntidad(p.precio_ges_entidad);
        setPorcentajeGanancia(p.porcentaje_ganancia_entidad);
        setForm({
          precio_normal: p.precio_normal != null ? String(p.precio_normal) : '',
          fecha_inicio: p.fecha_inicio ?? '',
          fecha_fin: p.fecha_fin ?? '',
          descripcion: p.descripcion ?? '',
          activo: p.estado,
        });
        setErrors({});
      })
      .catch((err) => push({ title: 'No se pudo cargar el producto', description: err.message, variant: 'error' }))
      .finally(() => setLoading(false));
  }, [open, productoId, push]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // El sistema calcula el precio para el afiliado — nunca se escribe a
  // mano (sección 3): precio_afiliado = precio_ges_entidad × (1 +
  // porcentaje_ganancia_entidad / 100). El porcentaje SIEMPRE es el
  // heredado del convenio, nunca uno propio del producto.
  const precioAfiliadoCalculado =
    precioGesEntidad != null && porcentajeGanancia != null
      ? Math.round(precioGesEntidad * (1 + porcentajeGanancia / 100))
      : null;

  // Ahorro (sección 4): el precio normal NUNCA participa del cálculo de la
  // ganancia de la entidad — solo sirve de referencia para mostrarle al
  // afiliado cuánto se ahorra frente al precio normal.
  const precioNormalNum = form.precio_normal ? Number(form.precio_normal) : null;
  const ahorro = precioNormalNum != null && precioAfiliadoCalculado != null ? precioNormalNum - precioAfiliadoCalculado : null;
  const ahorroPct = ahorro != null && precioNormalNum ? (ahorro / precioNormalNum) * 100 : null;

  const handleClose = () => {
    if (saving) return;
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.precio_normal) nextErrors.precio_normal = 'Ingresa el precio normal de referencia.';
    if (!form.fecha_inicio) nextErrors.fecha_inicio = 'Define la fecha de inicio.';
    if (form.fecha_fin && form.fecha_inicio && form.fecha_fin < form.fecha_inicio) {
      nextErrors.fecha_fin = 'La fecha de fin no puede ser anterior a la de inicio.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await convenioService.actualizarConfiguracionProducto(productoId, {
        precio_normal: Number(form.precio_normal),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null,
        descripcion: form.descripcion.trim() || null,
        estado: form.activo,
      });
      push({ title: 'Producto configurado', description: `${productoNombre} · ${precioAfiliadoCalculado != null ? formatCOP(precioAfiliadoCalculado) : ''}` });
      onSaved?.();
    } catch (err) {
      push({ title: 'No se pudo guardar la configuración', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="xl"
      title="Configurar producto"
      actions={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} loading={saving}>Guardar</Button>
        </>
      }
    >
      {loading ? (
        <LoadingState title="Cargando producto…" />
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="text-caption cell-muted" style={{ marginBottom: 2 }}>{convenioNombre}</div>
          <div className="text-h2" style={{ marginBottom: 18 }}>{productoNombre}</div>

          <div className="grid grid-3" style={{ marginBottom: 18 }}>
            <div>
              <div className="text-caption cell-muted">Precio GES → entidad</div>
              <div className="text-body" style={{ fontWeight: 600 }}>{precioGesEntidad != null ? formatCOP(precioGesEntidad) : 'Sin configurar por GES'}</div>
            </div>
            <div>
              <div className="text-caption cell-muted">Beneficio</div>
              <div className="text-body" style={{ fontWeight: 600 }}>{porcentajeGanancia != null ? `${porcentajeGanancia}%` : 'Sin configurar'}</div>
              <div className="text-small cell-muted">Heredado de {convenioNombre}</div>
            </div>
            <div>
              <div className="text-caption cell-muted">Precio para afiliados</div>
              <div className="text-body" style={{ fontWeight: 600 }}>{precioAfiliadoCalculado != null ? formatCOP(precioAfiliadoCalculado) : '—'}</div>
            </div>
          </div>

          <div className="grid grid-2">
            <div>
              <Field label="Precio público" error={errors.precio_normal} hint="Precio de referencia (público) — solo se usa para calcular el ahorro que ve el afiliado.">
                <Input type="number" min="0" value={form.precio_normal} onChange={set('precio_normal')} placeholder="7000" />
              </Field>
              <Field label="Ahorro" hint="Se calcula automáticamente: precio normal − precio para afiliados.">
                <Input
                  type="text"
                  disabled
                  value={ahorro != null ? `${formatCOP(ahorro)} · ahorras ${ahorroPct.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%` : '—'}
                />
              </Field>
            </div>
            <div>
              <Field label="Fecha de inicio" error={errors.fecha_inicio}>
                <Input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
              </Field>
              <Field label="Fecha de fin" optional error={errors.fecha_fin} hint="Déjalo vacío si no tiene fecha de vencimiento.">
                <Input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} />
              </Field>
            </div>
          </div>
          <Field label="Descripción">
            <Textarea value={form.descripcion} onChange={set('descripcion')} placeholder="Válido de lunes a viernes." />
          </Field>
        </form>
      )}
    </Modal>
  );
}
