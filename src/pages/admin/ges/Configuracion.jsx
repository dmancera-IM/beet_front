import { useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Input, Select, Switch } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import { LoadingState } from '../../../components/ui/States';
import * as convenioService from '../../../services/convenioService';
import * as plantillasService from '../../../services/plantillasService';
import { useToast } from '../../../context/ToastContext';
import GesNav from './GesNav';

const emptyForm = { nombre: '', archivo_url: '', estado: true };

// Conectado a la tabla real plantillas_pdf (una sola fila por convenio,
// GET/PATCH /convenios/{id}/plantilla-pdf). No hay generador de PDF real
// en este alcance — archivo_url es un link ya alojado en otro lado
// (mismo patrón que convenios.imagen_url), no un motor de plantillas.
export default function Configuracion() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Configuración' }]);
  const { push } = useToast();

  const [convenios, setConvenios] = useState([]);
  const [convenioId, setConvenioId] = useState('');
  const [loadingConvenios, setLoadingConvenios] = useState(true);
  const [loadingPlantilla, setLoadingPlantilla] = useState(false);
  const [existe, setExiste] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    convenioService.listarConvenios().then(setConvenios).finally(() => setLoadingConvenios(false));
  }, []);

  useEffect(() => {
    if (!convenioId) return;
    setLoadingPlantilla(true);
    plantillasService
      .obtenerPlantillaConvenio(convenioId)
      .then((plantilla) => {
        if (plantilla) {
          setExiste(true);
          setForm({ nombre: plantilla.nombre, archivo_url: plantilla.archivo_url ?? '', estado: plantilla.estado === 'ACTIVA' });
        } else {
          setExiste(false);
          setForm(emptyForm);
        }
        setErrors({});
      })
      .catch((err) => push({ title: 'No se pudo cargar la plantilla', description: err.message, variant: 'error' }))
      .finally(() => setLoadingPlantilla(false));
  }, [convenioId, push]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const guardar = async () => {
    const nextErrors = {};
    if (!form.nombre.trim()) nextErrors.nombre = 'El nombre de la plantilla es obligatorio.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await plantillasService.configurarPlantillaConvenio(convenioId, {
        nombre: form.nombre.trim(),
        archivo_url: form.archivo_url.trim() || null,
        estado: form.estado ? 'ACTIVA' : 'INACTIVA',
      });
      setExiste(true);
      push({ title: existe ? 'Plantilla actualizada' : 'Plantilla creada', description: form.nombre });
    } catch (err) {
      push({ title: 'No se pudo guardar la plantilla', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Configuración</h1>
          <p className="page-subtitle">Plantilla PDF por convenio — la misma plantilla aplica a todos los productos del convenio.</p>
        </div>
      </div>

      <GesNav />

      <Card padding="card-pad-lg">
        {loadingConvenios ? (
          <LoadingState title="Cargando convenios…" />
        ) : (
          <>
            <div style={{ maxWidth: 420, marginBottom: 20 }}>
              <Field label="Convenio">
                <Select value={convenioId} onChange={(e) => setConvenioId(e.target.value)}>
                  <option value="">Selecciona un convenio…</option>
                  {convenios.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {!convenioId ? (
              <Alert tone="info" title="Selecciona un convenio">Elige un convenio para ver o configurar su plantilla PDF.</Alert>
            ) : loadingPlantilla ? (
              <LoadingState title="Cargando plantilla…" />
            ) : (
              <div style={{ maxWidth: 520 }}>
                {!existe && (
                  <Alert tone="info" title="Este convenio todavía no tiene plantilla">Completa los datos y guarda para crearla.</Alert>
                )}
                <Field label="Nombre de la plantilla" error={errors.nombre}>
                  <Input value={form.nombre} onChange={set('nombre')} placeholder="Plantilla Cine Colombia" />
                </Field>
                <Field label="URL del archivo" optional hint="Enlace al PDF/diseño ya alojado (no hay generador de PDF en este alcance).">
                  <Input value={form.archivo_url} onChange={set('archivo_url')} placeholder="https://…" />
                </Field>
                {existe && (
                  <div style={{ marginTop: 8, paddingTop: 20, borderTop: '1px solid var(--border-default)' }}>
                    <Switch label="Plantilla activa" checked={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))} />
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <Button onClick={guardar} loading={saving}>{existe ? 'Guardar cambios' : 'Crear plantilla'}</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
