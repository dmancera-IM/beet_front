import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Input, Textarea, Switch } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import { LoadingState } from '../../../components/ui/States';
import { RequireWriteAccess } from '../../../components/ui/PermissionGate';
import * as convenioService from '../../../services/convenioService';
import { formatCOP } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

const emptyForm = {
  precio_normal: '',
  precio_beet: '',
  fecha_inicio: '',
  fecha_fin: '',
  descripcion: '',
  activo: false,
};

// Configuración de UN producto para la cooperativa (sección 10.4). REGLA
// CRÍTICA (sección 11): el precio pertenece a cooperativa + producto, no al
// convenio ni al catálogo maestro de GES — este formulario nunca toca
// `productos_convenio` (el producto en sí, propiedad de GES), solo la
// configuración propia de esta cooperativa para ese producto.
export default function ProductoConfigForm() {
  const { id, productoId } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const base = useAreaBase();

  const [form, setForm] = useState(emptyForm);
  const [productoNombre, setProductoNombre] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useSetBreadcrumbs([
    { label: 'Convenios', to: `${base}/convenios` },
    { label: 'Detalle', to: `${base}/convenios/${id}` },
    { label: productoNombre || 'Producto' },
  ]);

  useEffect(() => {
    convenioService
      .obtenerConfiguracionProducto(productoId)
      .then((p) => {
        setProductoNombre(p.nombre);
        setForm({
          precio_normal: p.precio_normal != null ? String(p.precio_normal) : '',
          precio_beet: p.precio_beet != null ? String(p.precio_beet) : '',
          fecha_inicio: p.fecha_inicio ?? '',
          fecha_fin: p.fecha_fin ?? '',
          descripcion: p.descripcion ?? '',
          activo: p.estado,
        });
      })
      .catch((err) => push({ title: 'No se pudo cargar el producto', description: err.message, variant: 'error' }))
      .finally(() => setLoading(false));
  }, [productoId, push]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const ahorro = form.precio_normal && form.precio_beet ? Number(form.precio_normal) - Number(form.precio_beet) : null;
  const ahorroPct = ahorro && form.precio_normal ? Math.round((ahorro / Number(form.precio_normal)) * 100) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.precio_beet) nextErrors.precio_beet = 'Ingresa el precio para tus afiliados.';
    if (!form.precio_normal) nextErrors.precio_normal = 'Ingresa el precio normal de referencia.';
    if (Number(form.precio_beet) > Number(form.precio_normal) && form.precio_normal && form.precio_beet) {
      nextErrors.precio_beet = 'El precio para afiliados no puede ser mayor al precio normal.';
    }
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
        precio_beet: Number(form.precio_beet),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin || null,
        descripcion: form.descripcion.trim() || null,
        estado: form.activo,
      });
      push({ title: 'Producto configurado', description: `${productoNombre} · ${formatCOP(Number(form.precio_beet))}` });
      navigate(`${base}/convenios/${id}`);
    } catch (err) {
      push({ title: 'No se pudo guardar la configuración', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState title="Cargando producto…" />;

  return (
    <RequireWriteAccess>
      <div>
        <div className="page-header">
          <div>
            <h1 className="text-h1 page-title">{productoNombre}</h1>
            <p className="page-subtitle">Precio, vigencia y descripción con las que tu cooperativa ofrece este producto a sus afiliados.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card padding="card-pad-lg" className="section-gap">
            <div className="grid grid-2">
              <div>
                <Field label="Precio para afiliados" error={errors.precio_beet} hint="El precio al que tu cooperativa vende este producto a sus afiliados.">
                  <Input type="number" min="0" value={form.precio_beet} onChange={set('precio_beet')} placeholder="12500" />
                </Field>
                <Field label="Precio normal" error={errors.precio_normal} hint={ahorro ? `Ahorro para el afiliado: ${formatCOP(ahorro)} (${ahorroPct}%)` : 'Precio de referencia, usado para mostrar el ahorro.'}>
                  <Input type="number" min="0" value={form.precio_normal} onChange={set('precio_normal')} placeholder="18000" />
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
            <Field label="Descripción" optional hint="Visible para el afiliado en el catálogo.">
              <Textarea value={form.descripcion} onChange={set('descripcion')} placeholder="Válido de lunes a viernes." />
            </Field>

            <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border-default)' }}>
              <Switch
                label="Producto activo para tus afiliados"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
            </div>
          </Card>

          <Alert tone="info" title="El precio pertenece a tu cooperativa">
            Este precio y vigencia solo aplican para {productoNombre} dentro de tu cooperativa — otras cooperativas pueden ofrecer el mismo producto a otro precio.
          </Alert>

          <div className="page-header-actions" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="secondary" type="button" onClick={() => navigate(`${base}/convenios/${id}`)} disabled={saving}>Cancelar</Button>
            <Button type="submit" loading={saving}>Guardar cambios</Button>
          </div>
        </form>
      </div>
    </RequireWriteAccess>
  );
}
