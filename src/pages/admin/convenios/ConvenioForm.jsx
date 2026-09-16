import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Input, Select, Textarea, Switch } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import { LoadingState } from '../../../components/ui/States';
import { RequireWriteAccess } from '../../../components/ui/PermissionGate';
import * as convenioService from '../../../services/convenioService';
import { ApiError } from '../../../services/apiClient';
import { formatCOP } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

// NOTE: unlike an earlier design assumption, the real `convenios` table
// has no `marca`, `categoria`, `tope`, or `tope_periodicidad` columns —
// this form only edits what the real schema actually stores (see
// SCHEMA_NOTES.md): nombre, descripcion, precios, fecha_inicio/fecha_fin,
// estado. Creating a row means activating one convenio from GES's master
// catalog for this cooperativa, so `nombre`/`id_convenio` are only chosen
// on create (via a Select fed by the master catalog) and are read-only on
// edit — see FRONTEND_DB_ALIGNMENT.md.
const emptyForm = {
  id_convenio: '',
  nombre: '',
  descripcion: '',
  precio_normal: '',
  precio_beet: '',
  fecha_inicio: '',
  fecha_fin: '',
  activo: true,
};

export default function ConvenioForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { push } = useToast();
  const base = useAreaBase();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [nombreConvenio, setNombreConvenio] = useState('');
  const [catalogoMaestro, setCatalogoMaestro] = useState([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(!isEdit);

  useSetBreadcrumbs([
    { label: 'Convenios', to: `${base}/convenios` },
    { label: isEdit ? nombreConvenio || 'Editar' : 'Crear convenio' },
  ]);

  useEffect(() => {
    if (isEdit) return;
    convenioService
      .listarCatalogoMaestroConvenios()
      .then((catalogo) => {
        setCatalogoMaestro(catalogo);
        setForm((f) => ({ ...f, id_convenio: f.id_convenio || catalogo[0]?.id || '' }));
      })
      .catch((err) => push({ title: 'No se pudo cargar el catálogo maestro', description: err.message, variant: 'error' }))
      .finally(() => setLoadingCatalogo(false));
  }, [isEdit, push]);

  useEffect(() => {
    if (!isEdit) return;
    convenioService
      .obtenerConvenio(id)
      .then((c) => {
        setForm({
          id_convenio: c.id_convenio,
          nombre: c.nombre,
          descripcion: c.descripcion ?? '',
          precio_normal: String(c.precio_normal),
          precio_beet: String(c.precio_beet),
          fecha_inicio: c.fecha_inicio,
          fecha_fin: c.fecha_fin ?? '',
          activo: c.estado,
        });
        setNombreConvenio(c.nombre);
      })
      .catch((err) => push({ title: 'No se pudo cargar el convenio', description: err.message, variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id, isEdit, push]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSelectConvenio = (e) => {
    const idConvenio = e.target.value;
    const nombre = catalogoMaestro.find((c) => c.id === idConvenio)?.nombre ?? '';
    setForm((f) => ({ ...f, id_convenio: idConvenio, nombre }));
  };

  const ahorro = form.precio_normal && form.precio_beet ? Number(form.precio_normal) - Number(form.precio_beet) : null;
  const ahorroPct = ahorro && form.precio_normal ? Math.round((ahorro / Number(form.precio_normal)) * 100) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!isEdit && !form.id_convenio) nextErrors.id_convenio = 'Selecciona un convenio del catálogo maestro.';
    if (!form.precio_normal) nextErrors.precio_normal = 'Ingresa el precio público.';
    if (!form.precio_beet) nextErrors.precio_beet = 'Ingresa el precio BEET.';
    if (Number(form.precio_beet) > Number(form.precio_normal) && form.precio_normal && form.precio_beet) {
      nextErrors.precio_beet = 'El precio BEET no puede ser mayor al precio público.';
    }
    if (!form.fecha_inicio) nextErrors.fecha_inicio = 'Define la fecha de inicio.';
    if (form.fecha_fin && form.fecha_inicio && form.fecha_fin < form.fecha_inicio) {
      nextErrors.fecha_fin = 'La fecha de fin no puede ser anterior a la de inicio.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = isEdit
      ? {
          descripcion: form.descripcion.trim() || null,
          precio_normal: Number(form.precio_normal),
          precio_beet: Number(form.precio_beet),
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin || null,
          estado: form.activo,
        }
      : {
          id_convenio: form.id_convenio,
          nombre: form.nombre,
          descripcion: form.descripcion.trim() || null,
          precio_normal: Number(form.precio_normal),
          precio_beet: Number(form.precio_beet),
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin || null,
          estado: form.activo,
        };

    setSaving(true);
    try {
      if (isEdit) {
        await convenioService.actualizarConvenio(id, payload);
      } else {
        await convenioService.crearConvenio(payload);
      }
      push({ title: isEdit ? 'Convenio actualizado' : 'Convenio creado', description: `${form.nombre || payload.nombre} se guardó en PostgreSQL.` });
      navigate(`${base}/convenios`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && Array.isArray(err.detail)) {
        push({ title: 'Revisa los datos del formulario', description: err.detail.map((d) => d.msg).join(' · '), variant: 'error' });
      } else {
        push({ title: 'No se pudo guardar el convenio', description: err.message, variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingCatalogo) return <LoadingState title="Cargando convenio…" />;

  return (
    <RequireWriteAccess>
      <div>
        <div className="page-header">
          <div>
            <h1 className="text-h1 page-title">{isEdit ? 'Editar convenio' : 'Crear convenio'}</h1>
            <p className="page-subtitle">Nombre, precios, descripción y vigencia visibles en el catálogo del afiliado.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Card padding="card-pad-lg" className="section-gap">
            <div className="grid grid-2">
              <div>
                {isEdit ? (
                  <Field label="Convenio" hint="El convenio del catálogo maestro no se puede cambiar una vez creado.">
                    <Input value={form.nombre} disabled readOnly />
                  </Field>
                ) : (
                  <Field label="Convenio del catálogo maestro" error={errors.id_convenio}>
                    <Select value={form.id_convenio} onChange={handleSelectConvenio}>
                      {catalogoMaestro.length === 0 && <option value="">No hay convenios disponibles</option>}
                      {catalogoMaestro.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Fecha de inicio" error={errors.fecha_inicio}>
                  <Input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
                </Field>
                <Field label="Fecha de fin" optional error={errors.fecha_fin} hint="Déjalo vacío si el convenio no tiene fecha de vencimiento.">
                  <Input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} />
                </Field>
              </div>
              <div>
                <Field label="Precio público" error={errors.precio_normal}>
                  <Input type="number" min="0" value={form.precio_normal} onChange={set('precio_normal')} placeholder="38000" />
                </Field>
                <Field label="Precio BEET" error={errors.precio_beet} hint={ahorro ? `Ahorro para el afiliado: ${formatCOP(ahorro)} (${ahorroPct}%)` : undefined}>
                  <Input type="number" min="0" value={form.precio_beet} onChange={set('precio_beet')} placeholder="27500" />
                </Field>
                <Field label="Descripción" optional>
                  <Textarea value={form.descripcion} onChange={set('descripcion')} placeholder="Válido de lunes a viernes. No acumulable con otras promociones." />
                </Field>
              </div>
            </div>

            <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border-default)' }}>
              <Switch
                label="Convenio activo en catálogo"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
            </div>
          </Card>

          <Alert tone="info" title="La plantilla de este convenio se administra por separado">
            Desde aquí solo se configuran los datos comerciales. El código, QR y estado de cada unidad se cargan luego desde Inventario.
          </Alert>

          <div className="page-header-actions" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
            <Button variant="secondary" type="button" onClick={() => navigate(`${base}/convenios`)} disabled={saving}>Cancelar</Button>
            <Button type="submit" loading={saving}>{isEdit ? 'Guardar cambios' : 'Crear convenio'}</Button>
          </div>
        </form>
      </div>
    </RequireWriteAccess>
  );
}
