import { useCallback, useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import { IconPlus } from '../../../components/ui/Icons';
import { RoleBadge, StatusBadge } from '../../../components/ui/Badge';
import Avatar from '../../../components/ui/Avatar';
import { Dropdown } from '../../../components/ui/Nav';
import { ConfirmDialog } from '../../../components/ui/Modal';
import Modal from '../../../components/ui/Modal';
import { Field, Input, Select } from '../../../components/ui/Field';
import { IconBuscar } from '../../../components/ui/Icons';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import { RequireUserManagement } from '../../../components/ui/PermissionGate';
import * as adminService from '../../../services/adminService';
import { ApiError } from '../../../services/apiClient';
import { ROLES_DISPLAY } from '../../../utils/roles';
import { useToast } from '../../../context/ToastContext';
import { useCooperativa } from '../../../context/CooperativaContext';
import { useAuth } from '../../../context/AuthContext';

// GES/SUPER_ADMIN SOLO pueden crear usuarios ADMIN (el backend lo exige —
// ver usuarios_service.crear: "GES/SUPER_ADMIN solo pueden crear usuarios
// ADMIN"), nunca SUPER_ADMIN/GES/LECTOR desde esta pantalla — por eso el
// rol ya no es un selector, siempre crea un ADMIN con su propia entidad.
const emptyDraft = { nombre: '', correo: '', password: '', cooperativa_id: '' };
const emptyCoopDraft = { nombre: '', nit: '' };

export default function UsuariosList() {
  useSetBreadcrumbs([{ label: 'Usuarios' }]);
  const { push } = useToast();
  const { recargarCooperativas } = useCooperativa();
  const { role, roles } = useAuth();
  const esGes = role === roles.GES;

  const [usuarios, setUsuarios] = useState([]);
  const [cooperativas, setCooperativas] = useState([]);
  const [filtroCooperativa, setFiltroCooperativa] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [draftErrors, setDraftErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [coopFormOpen, setCoopFormOpen] = useState(false);
  const [coopDraft, setCoopDraft] = useState(emptyCoopDraft);
  const [coopErrors, setCoopErrors] = useState({});
  const [coopSaving, setCoopSaving] = useState(false);

  const recargarListaCooperativas = useCallback(() => {
    adminService.listarCooperativas().then(setCooperativas).catch(() => {});
  }, []);

  useEffect(() => { recargarListaCooperativas(); }, [recargarListaCooperativas]);

  const crearCooperativa = async () => {
    const nextErrors = {};
    if (!coopDraft.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio.';
    if (!coopDraft.nit.trim()) nextErrors.nit = 'El NIT es obligatorio.';
    setCoopErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setCoopSaving(true);
    try {
      const nueva = await adminService.crearCooperativa({ nombre: coopDraft.nombre.trim(), nit: coopDraft.nit.trim() });
      push({ title: 'Entidad creada', description: nueva.nombre });
      setCoopFormOpen(false);
      setCoopDraft(emptyCoopDraft);
      recargarListaCooperativas(); // refresca el filtro/selector de esta pantalla
      recargarCooperativas(); // refresca el selector persistente del Header de inmediato
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCoopErrors({ nit: 'Ya existe una entidad con ese NIT.' });
      } else {
        push({ title: 'No se pudo crear la entidad', description: err.message, variant: 'error' });
      }
    } finally {
      setCoopSaving(false);
    }
  };

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    adminService
      .listarUsuariosAdmin(filtroCooperativa || undefined, { estado: filtroEstado, q: busqueda.trim() || undefined })
      .then(setUsuarios)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No pudimos cargar los usuarios.'))
      .finally(() => setLoading(false));
  }, [filtroCooperativa, filtroEstado, busqueda]);

  // Debounced: re-fetch 350ms after the user stops typing, not on every
  // keystroke.
  useEffect(() => {
    const id = setTimeout(cargar, 350);
    return () => clearTimeout(id);
  }, [cargar]);

  const crearUsuario = async () => {
    const nextErrors = {};
    if (!draft.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio.';
    if (!draft.correo.trim()) nextErrors.correo = 'El correo es obligatorio.';
    if (draft.password.length < 8) nextErrors.password = 'Mínimo 8 caracteres.';
    if (!draft.cooperativa_id) nextErrors.cooperativa_id = 'Selecciona la entidad de este usuario.';
    setDraftErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await adminService.crearUsuarioAdmin({
        nombre: draft.nombre.trim(),
        correo: draft.correo.trim(),
        password: draft.password,
        rol: 'ADMIN',
        cooperativa_id: Number(draft.cooperativa_id),
      });
      push({ title: 'Usuario creado', description: `${draft.nombre} · ${ROLES_DISPLAY.ADMIN}` });
      setFormOpen(false);
      setDraft(emptyDraft);
      cargar();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDraftErrors({ correo: 'Ya existe un usuario con ese correo.' });
      } else {
        push({ title: 'No se pudo crear el usuario', description: err.message, variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleEstado = async (usuario) => {
    const nuevoEstado = !usuario.estado;
    setOpenMenuId(null);
    try {
      const actualizado = await adminService.actualizarUsuarioAdmin(usuario.id, { estado: nuevoEstado });
      // Optimistic local update AND a real refetch from the backend right
      // after — belt-and-suspenders so the row is never left showing a
      // stale value regardless of how the update response is shaped.
      setUsuarios((prev) => prev.map((u) => (u.id === usuario.id ? actualizado : u)));
      push({ title: nuevoEstado ? 'Acceso reactivado' : 'Acceso desactivado', description: usuario.nombre });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo actualizar el usuario', description: err.message, variant: 'error' });
    }
  };

  const [deleting, setDeleting] = useState(false);

  const eliminarUsuario = async () => {
    const objetivo = deleteTarget;
    setDeleting(true);
    try {
      await adminService.eliminarUsuarioAdmin(objetivo.id);
      setUsuarios((prev) => prev.map((u) => (u.id === objetivo.id ? { ...u, estado: false } : u)));
      push({ title: 'Usuario desactivado', description: `${objetivo.nombre} ya no puede acceder.`, variant: 'success' });
      setDeleteTarget(null);
      setOpenMenuId(null);
      cargar();
    } catch (err) {
      push({ title: 'No se pudo desactivar el usuario', description: err.message, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <RequireUserManagement>
      <div>
        <div className="page-header">
          <div>
            <h1 className="text-h1 page-title">Usuarios</h1>
            <p className="page-subtitle">Usuarios internos con acceso al panel administrativo, bajo los roles Súper administrador, Administrador y Lector.</p>
          </div>
          <div className="page-header-actions">
            {!esGes && (
              <Button variant="secondary" icon={<IconPlus color="#1F2937" />} onClick={() => setCoopFormOpen(true)}>Crear entidad</Button>
            )}
            <Button icon={<IconPlus color="#fff" />} onClick={() => setFormOpen(true)}>Crear usuario</Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 280 }}>
            <Field label="Buscar">
              <label className="input-affix-wrap">
                <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
                <Input placeholder="Nombre, correo o entidad" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </label>
            </Field>
          </div>
          <div style={{ maxWidth: 220 }}>
            <Field label="Filtrar por entidad">
              <Select value={filtroCooperativa} onChange={(e) => setFiltroCooperativa(e.target.value)}>
                <option value="">Todas las entidades</option>
                {cooperativas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ maxWidth: 180 }}>
            <Field label="Estado">
              <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="table-card">
          {loading ? (
            <LoadingState title="Cargando usuarios desde PostgreSQL…" />
          ) : error ? (
            <ErrorState description={error} onRetry={cargar} />
          ) : usuarios.length === 0 ? (
            <EmptyState title="No hay usuarios registrados" description="Esto no debería pasar mientras estés autenticado — refresca la página." />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Entidad</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={u.nombre} size="sm" />
                          <div>
                            <div style={{ fontWeight: 500 }}>{u.nombre}</div>
                            <div className="cell-muted">{u.correo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="cell-muted">{u.cooperativa_nombre ?? 'Todas (súper administrador)'}</td>
                      <td><RoleBadge role={ROLES_DISPLAY[u.rol]} /></td>
                      <td><StatusBadge status={u.estado} /></td>
                      <td className="right" style={{ position: 'relative' }}>
                        <Button size="sm" variant="secondary" onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}>Gestionar</Button>
                        <Dropdown
                          open={openMenuId === u.id}
                          onClose={() => setOpenMenuId(null)}
                          style={{ top: 40, right: 0 }}
                          items={[
                            { label: u.estado ? 'Desactivar acceso' : 'Reactivar acceso', onClick: () => toggleEstado(u) },
                            { divider: true },
                            { label: 'Desactivar usuario', danger: true, onClick: () => setDeleteTarget(u) },
                          ]}
                        />
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
          onClose={() => !saving && setFormOpen(false)}
          title="Crear administrador de entidad"
          actions={
            <>
              <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={crearUsuario} loading={saving}>Crear usuario</Button>
            </>
          }
        >
          <Field label="Nombre completo" error={draftErrors.nombre}>
            <Input value={draft.nombre} onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))} />
          </Field>
          <Field label="Correo electrónico" error={draftErrors.correo}>
            <Input type="email" value={draft.correo} onChange={(e) => setDraft((d) => ({ ...d, correo: e.target.value }))} />
          </Field>
          <Field label="Contraseña temporal" error={draftErrors.password} hint="Mínimo 8 caracteres. Compártela por un canal seguro.">
            <Input type="password" value={draft.password} onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))} />
          </Field>
          <p className="text-caption cell-muted" style={{ marginTop: -4 }}>
            Rol: <strong>Administrador</strong> — {esGes ? 'GES' : 'Súper administrador'} solo puede crear administradores de entidad. Para crear un usuario Lector, el propio administrador de la entidad lo hace desde su panel.
          </p>
          <Field label="Entidad" error={draftErrors.cooperativa_id} hint="A qué entidad pertenece este administrador. Solo podrá ver y gestionar los datos de esta entidad.">
            <Select value={draft.cooperativa_id} onChange={(e) => setDraft((d) => ({ ...d, cooperativa_id: e.target.value }))}>
              <option value="">Selecciona una entidad…</option>
              {cooperativas.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </Field>
        </Modal>

        <Modal
          open={coopFormOpen}
          onClose={() => !coopSaving && setCoopFormOpen(false)}
          title="Crear entidad"
          actions={
            <>
              <Button variant="secondary" onClick={() => setCoopFormOpen(false)} disabled={coopSaving}>Cancelar</Button>
              <Button onClick={crearCooperativa} loading={coopSaving}>Crear entidad</Button>
            </>
          }
        >
          <Field label="Nombre" error={coopErrors.nombre}>
            <Input value={coopDraft.nombre} onChange={(e) => setCoopDraft((d) => ({ ...d, nombre: e.target.value }))} placeholder="Entidad Norte" />
          </Field>
          <Field label="NIT" error={coopErrors.nit} hint="Debe ser único — identifica legalmente a la entidad.">
            <Input value={coopDraft.nit} onChange={(e) => setCoopDraft((d) => ({ ...d, nit: e.target.value }))} placeholder="900123456-7" />
          </Field>
        </Modal>

        <ConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title={deleteTarget ? `¿Desactivar a ${deleteTarget.nombre}?` : ''}
          description="El usuario ya no podrá ingresar al panel. Se conserva el historial asociado; la eliminación definitiva a 30 días debe hacerla un proceso programado del backend."
          confirmLabel="Desactivar usuario"
          onConfirm={eliminarUsuario}
          loading={deleting}
        />
      </div>
    </RequireUserManagement>
  );
}
