import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { Field, Input } from '../../../components/ui/Field';
import { IconBuscar, IconPlus } from '../../../components/ui/Icons';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { StatusBadge } from '../../../components/ui/Badge';
import { formatCOP } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import * as adminService from '../../../services/adminService';
import { ApiError } from '../../../services/apiClient';
import GesNav from './GesNav';

// Reemplaza por completo el mock de gesData.js: cooperativas, bolsa y
// crédito reales desde PostgreSQL (beet_backend/app/routers/cooperativas.py
// + financiero.py). "Crear usuario administrador" para una entidad ahora
// vive en /ges/usuarios (misma pantalla que usa SUPER_ADMIN) en vez de
// duplicarse aquí con lógica propia.
const emptyDraft = { nombre: '', nit: '' };

export default function CooperativasList() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Entidades' }]);
  const { push } = useToast();

  const [cooperativas, setCooperativas] = useState([]);
  const [saldos, setSaldos] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    adminService
      .listarCooperativas()
      .then(async (rows) => {
        setCooperativas(rows);
        const pares = await Promise.all(
          rows.map((c) =>
            Promise.all([adminService.obtenerBolsa(c.id).catch(() => null), adminService.obtenerCredito(c.id).catch(() => null)]).then(
              ([bolsa, credito]) => [c.id, { bolsa, credito }]
            )
          )
        );
        setSaldos(Object.fromEntries(pares));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar las entidades.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    const nextErrors = {};
    if (!draft.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio.';
    if (!draft.nit.trim()) nextErrors.nit = 'El NIT es obligatorio.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const nueva = await adminService.crearCooperativa({ nombre: draft.nombre.trim(), nit: draft.nit.trim() });
      push({ title: 'Entidad creada', description: `${nueva.nombre} — ahora crea su Administrador desde “Usuarios”.` });
      setFormOpen(false);
      setDraft(emptyDraft);
      cargar();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ nit: 'Ya existe una entidad con ese NIT.' });
      } else {
        push({ title: 'No se pudo crear la entidad', description: err.message, variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const filtradas = cooperativas.filter((c) => c.nombre.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Entidades</h1>
          <p className="page-subtitle">Cooperativas registradas en PostgreSQL, con su bolsa y crédito.</p>
        </div>
        <div className="page-header-actions">
          <Button icon={<IconPlus color="#fff" />} onClick={() => setFormOpen(true)}>Crear entidad</Button>
        </div>
      </div>

      <GesNav />

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar entidad..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingState title="Cargando entidades desde PostgreSQL…" />
        ) : error ? (
          <ErrorState description={error} onRetry={cargar} />
        ) : filtradas.length === 0 ? (
          <EmptyState title="No hay entidades registradas" description="Crea la primera entidad desde el botón “Crear entidad”." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entidad</th>
                  <th>Estado</th>
                  <th className="right">Bolsa (valor / consumido)</th>
                  <th className="right">Crédito (autorizado / utilizado)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const s = saldos[c.id];
                  return (
                    <tr key={c.id}>
                      <td className="cell-primary">{c.nombre}</td>
                      <td><StatusBadge status={c.estado} /></td>
                      <td className="right tabular">{s?.bolsa ? `${formatCOP(s.bolsa.valor)} / ${formatCOP(s.bolsa.consumido)}` : '—'}</td>
                      <td className="right tabular">{s?.credito ? `${formatCOP(s.credito.cupo_autorizado)} / ${formatCOP(s.credito.utilizado)}` : '—'}</td>
                      <td className="right"><Link to={`/ges/cooperativas/${c.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title="Crear entidad"
        actions={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={crear} loading={saving}>Crear entidad</Button>
          </>
        }
      >
        <Field label="Nombre de la entidad" error={errors.nombre}>
          <Input value={draft.nombre} onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))} placeholder="Entidad ABC" />
        </Field>
        <Field label="NIT" error={errors.nit} hint="Debe ser único.">
          <Input value={draft.nit} onChange={(e) => setDraft((d) => ({ ...d, nit: e.target.value }))} placeholder="900123456-7" />
        </Field>
      </Modal>
    </div>
  );
}
