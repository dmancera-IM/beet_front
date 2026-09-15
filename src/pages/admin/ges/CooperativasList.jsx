import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { Field, Input, Select } from '../../../components/ui/Field';
import { IconBuscar, IconPlus } from '../../../components/ui/Icons';
import { Pagination } from '../../../components/ui/Nav';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/States';
import { useTableState } from '../../../hooks/useTableState';
import { formatCOP } from '../../../utils/format';
import { useToast } from '../../../context/ToastContext';
import GesNav from './GesNav';
import { crearCooperativaGes, crearUsuarioAdminGes, getCooperativas } from './gesData';

const emptyCoopDraft = { nombre: '', cupo: '' };
const emptyUserDraft = { nombre: '', correo: '', password: '', cooperativaId: '' };

export default function CooperativasList() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Cooperativas' }]);
  const { push } = useToast();

  const [, setVersion] = useState(0);
  const cooperativas = getCooperativas();

  const { search, setSearch, filters, setFilter, pageRows, page, setPage, totalPages, total } = useTableState({
    data: cooperativas,
    searchFields: ['nombre'],
    pageSize: 10,
  });

  const [coopFormOpen, setCoopFormOpen] = useState(false);
  const [coopDraft, setCoopDraft] = useState(emptyCoopDraft);
  const [coopErrors, setCoopErrors] = useState({});
  const [coopSaving, setCoopSaving] = useState(false);

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [userDraft, setUserDraft] = useState(emptyUserDraft);
  const [userErrors, setUserErrors] = useState({});
  const [userSaving, setUserSaving] = useState(false);

  const cerrarFormCoop = () => {
    if (coopSaving) return;
    setCoopFormOpen(false);
    setCoopDraft(emptyCoopDraft);
    setCoopErrors({});
  };

  const crearCooperativa = () => {
    const nextErrors = {};
    if (!coopDraft.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio.';
    setCoopErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setCoopSaving(true);
    try {
      const nueva = crearCooperativaGes({ nombre: coopDraft.nombre, cupo: coopDraft.cupo });
      push({ title: 'Cooperativa creada', description: nueva.nombre });
      cerrarFormCoop();
      setVersion((v) => v + 1);
    } catch (err) {
      push({ title: 'No se pudo crear la cooperativa', description: err.message, variant: 'error' });
    } finally {
      setCoopSaving(false);
    }
  };

  const cerrarFormUsuario = () => {
    if (userSaving) return;
    setUserFormOpen(false);
    setUserDraft(emptyUserDraft);
    setUserErrors({});
  };

  const crearUsuario = () => {
    const nextErrors = {};
    if (!userDraft.nombre.trim()) nextErrors.nombre = 'El nombre es obligatorio.';
    if (!userDraft.correo.trim()) nextErrors.correo = 'El correo es obligatorio.';
    if (userDraft.password.length < 8) nextErrors.password = 'Mínimo 8 caracteres.';
    if (!userDraft.cooperativaId) nextErrors.cooperativaId = 'Selecciona la cooperativa de este usuario.';
    setUserErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setUserSaving(true);
    try {
      const usuario = crearUsuarioAdminGes({
        nombre: userDraft.nombre,
        correo: userDraft.correo,
        cooperativaId: Number(userDraft.cooperativaId),
      });
      push({ title: 'Usuario creado', description: `${usuario.nombre} · Administrador de ${usuario.cooperativaNombre}` });
      cerrarFormUsuario();
    } catch (err) {
      push({ title: 'No se pudo crear el usuario', description: err.message, variant: 'error' });
    } finally {
      setUserSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Cooperativas</h1>
          <p className="page-subtitle">Cooperativas administradas por GES, con su cupo y convenios asociados.</p>
        </div>
        <div className="page-header-actions">
          <Button variant="secondary" icon={<IconPlus color="#1F2937" />} onClick={() => setUserFormOpen(true)}>Crear usuario</Button>
          <Button icon={<IconPlus color="#fff" />} onClick={() => setCoopFormOpen(true)}>Crear cooperativa</Button>
        </div>
      </div>

      <GesNav />

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar cooperativa..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Select style={{ width: 160 }} value={filters.estado ?? ''} onChange={(e) => setFilter('estado', e.target.value)}>
              <option value="">Todo estado</option>
              <option value="Activa">Activa</option>
              <option value="Inactiva">Inactiva</option>
            </Select>
          </div>
        </div>

        {pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="No hay cooperativas registradas" description="Crea la primera cooperativa desde el botón “Crear cooperativa”." />
          ) : (
            <EmptyState title="Sin cooperativas que coincidan" description="Ajusta los filtros o el término de búsqueda." />
          )
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cooperativa</th>
                  <th>Estado</th>
                  <th className="right">Cupo disponible</th>
                  <th className="right">Cupo gastado</th>
                  <th className="right">Convenios</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-primary">{c.nombre}</td>
                    <td><StatusBadge status={c.estado} /></td>
                    <td className="right tabular">{formatCOP(c.cupoDisponible)}</td>
                    <td className="right tabular">{formatCOP(c.cupoGastado)}</td>
                    <td className="right tabular">{c.conveniosActivos}</td>
                    <td className="right"><Link to={`/ges/cooperativas/${c.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageRows.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalLabel={`Mostrando ${pageRows.length} de ${total} cooperativas`} />
        )}
      </div>

      <Modal
        open={coopFormOpen}
        onClose={cerrarFormCoop}
        title="Crear cooperativa"
        actions={
          <>
            <Button variant="secondary" onClick={cerrarFormCoop} disabled={coopSaving}>Cancelar</Button>
            <Button onClick={crearCooperativa} loading={coopSaving}>Crear cooperativa</Button>
          </>
        }
      >
        <Field label="Nombre de cooperativa" error={coopErrors.nombre}>
          <Input value={coopDraft.nombre} onChange={(e) => setCoopDraft((d) => ({ ...d, nombre: e.target.value }))} placeholder="Cooperativa ABC" />
        </Field>
        <Field label="Cupo contratado" optional hint="La cooperativa decide cuánto cupo comprar. Puede crearse sin cupo todavía.">
          <Input type="number" min="0" value={coopDraft.cupo} onChange={(e) => setCoopDraft((d) => ({ ...d, cupo: e.target.value }))} placeholder="20000000" />
        </Field>
      </Modal>

      <Modal
        open={userFormOpen}
        onClose={cerrarFormUsuario}
        title="Crear usuario administrador"
        actions={
          <>
            <Button variant="secondary" onClick={cerrarFormUsuario} disabled={userSaving}>Cancelar</Button>
            <Button onClick={crearUsuario} loading={userSaving}>Crear usuario</Button>
          </>
        }
      >
        <Field label="Nombre completo" error={userErrors.nombre}>
          <Input value={userDraft.nombre} onChange={(e) => setUserDraft((d) => ({ ...d, nombre: e.target.value }))} />
        </Field>
        <Field label="Correo electrónico" error={userErrors.correo}>
          <Input type="email" value={userDraft.correo} onChange={(e) => setUserDraft((d) => ({ ...d, correo: e.target.value }))} />
        </Field>
        <Field label="Contraseña temporal" error={userErrors.password} hint="Mínimo 8 caracteres. Compártela por un canal seguro.">
          <Input type="password" value={userDraft.password} onChange={(e) => setUserDraft((d) => ({ ...d, password: e.target.value }))} />
        </Field>
        <Field label="Cooperativa" error={userErrors.cooperativaId} hint="El usuario quedará como Administrador de esta cooperativa.">
          <Select value={userDraft.cooperativaId} onChange={(e) => setUserDraft((d) => ({ ...d, cooperativaId: e.target.value }))}>
            <option value="">Selecciona una cooperativa…</option>
            {cooperativas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
        </Field>
        <p className="text-caption cell-muted">Rol: Administrador de cooperativa.</p>
      </Modal>
    </div>
  );
}
