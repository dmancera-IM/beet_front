import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Input, Switch } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import { LoadingState } from '../../../components/ui/States';
import * as convenioService from '../../../services/convenioService';
import { ApiError } from '../../../services/apiClient';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

// ADAPTADO AL BACKEND REAL: `convenios` solo tiene id/nombre/estado/
// imagen_url/fecha_creacion — no hay precio_normal/precio_beet/vigencia
// (esos vivían en `cooperativa_convenios`, que no existe en las 13 tablas
// de este alcance). Crear/editar un convenio es una acción de GES/
// SUPER_ADMIN (el backend lo exige vía RequireRole en las rutas /ges).
const emptyForm = { nombre: '', imagen_url: '', estado: true };

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

  useSetBreadcrumbs([
    { label: 'Convenios', to: `${base}/convenios` },
    { label: isEdit ? form.nombre || 'Editar' : 'Crear convenio' },
  ]);

  useEffect(() => {
    if (!isEdit) return;
    convenioService
      .obtenerConvenio(id)
      .then((c) => setForm({ nombre: c.nombre, imagen_url: c.imagen_url ?? '', estado: c.estado }))
      .catch((err) => push({ title: 'No se pudo cargar el convenio', description: err.message, variant: 'error' }))
      .finally(() => setLoading(false));
  }, [id, isEdit, push]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      if (isEdit) {
        await convenioService.actualizarConvenio(id, { nombre: form.nombre.trim(), imagen_url: form.imagen_url.trim() || null, estado: form.estado });
      } else {
        await convenioService.crearConvenio({ nombre: form.nombre.trim(), imagen_url: form.imagen_url.trim() || null });
      }
      push({ title: isEdit ? 'Convenio actualizado' : 'Convenio creado', description: `${form.nombre} se guardó en PostgreSQL.` });
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

  if (loading) return <LoadingState title="Cargando convenio…" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{isEdit ? 'Editar convenio' : 'Crear convenio'}</h1>
          <p className="page-subtitle">Catálogo global de convenios administrado por GES.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card padding="card-pad-lg" className="section-gap">
          <div style={{ maxWidth: 520 }}>
            <Field label="Nombre del convenio" error={errors.nombre}>
              <Input value={form.nombre} onChange={set('nombre')} placeholder="Cine Colombia" />
            </Field>
            <Field label="URL de imagen" optional hint="Enlace a una imagen del convenio (opcional).">
              <Input value={form.imagen_url} onChange={set('imagen_url')} placeholder="https://…" />
            </Field>
            {isEdit && (
              <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border-default)' }}>
                <Switch label="Convenio activo" checked={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))} />
              </div>
            )}
          </div>
        </Card>

        <div className="page-header-actions" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
          <Button variant="secondary" type="button" onClick={() => navigate(`${base}/convenios`)} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving}>{isEdit ? 'Guardar cambios' : 'Crear convenio'}</Button>
        </div>
      </form>
    </div>
  );
}
