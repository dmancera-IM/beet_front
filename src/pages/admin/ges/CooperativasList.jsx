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
import { creditoDisponible, crearCooperativaGes, crearUsuarioAdminGes, getCooperativas } from './gesData';

const emptyCoopDraft = { nombre: '', bolsa: '', cupoCredito: '' };
const emptyUserDraft = { nombre: '', correo: '', password: '', cooperativaId: '' };

export default function CooperativasList() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Entidades' }]);
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
      // Bolsa y cupo de crédito son dos campos independientes — GES ya no
      // define un único "cupo contratado" (ver definición funcional de
      // Bolsa/Crédito). Ambos son opcionales: una entidad puede crearse
      // sin ninguno de los dos configurado todavía.
      const nueva = crearCooperativaGes({
        nombre: coopDraft.nombre,
        bolsa: coopDraft.bolsa,
        cupoCredito: coopDraft.cupoCredito,
      });
      push({
        title: 'Entidad creada',
        description: `${nueva.nombre}: bolsa ${formatCOP(nueva.bolsa.valor)}, cupo de crédito autorizado ${formatCOP(nueva.credito.cupoAutorizado)}.`,
      });
      cerrarFormCoop();
      setVersion((v) => v + 1);
    } catch (err) {
      push({ title: 'No se pudo crear la entidad', description: err.message, variant: 'error' });
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
    if (!userDraft.cooperativaId) nextErrors.cooperativaId = 'Selecciona la entidad de este usuario.';
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
          <h1 className="text-h1 page-title">Entidades</h1>
          <p className="page-subtitle">Entidades administradas por GES, con su cupo y convenios asociados.</p>
        </div>
        <div className="page-header-actions">
          <Button variant="secondary" icon={<IconPlus color="#1F2937" />} onClick={() => setUserFormOpen(true)}>Crear usuario</Button>
          <Button icon={<IconPlus color="#fff" />} onClick={() => setCoopFormOpen(true)}>Crear entidad</Button>
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
            <Select style={{ width: 160 }} value={filters.estado ?? ''} onChange={(e) => setFilter('estado', e.target.value)}>
              <option value="">Todo estado</option>
              <option value="Activa">Activa</option>
              <option value="Inactiva">Inactiva</option>
            </Select>
          </div>
        </div>

        {pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="No hay entidades registradas" description="Crea la primera entidad desde el botón “Crear entidad”." />
          ) : (
            <EmptyState title="Sin entidades que coincidan" description="Ajusta los filtros o el término de búsqueda." />
          )
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entidad</th>
                  <th>Estado</th>
                  <th className="right">Bolsa comprada</th>
                  <th className="right">Bolsa utilizada</th>
                  <th className="right">Crédito autorizado</th>
                  <th className="right">Crédito utilizado</th>
                  <th className="right">Crédito disponible</th>
                  <th className="right">Convenios</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-primary">{c.nombre}</td>
                    <td><StatusBadge status={c.estado} /></td>
                    <td className="right tabular">{formatCOP(c.bolsa.valor)}</td>
                    <td className="right tabular">{formatCOP(c.bolsa.consumido)}</td>
                    <td className="right tabular">{formatCOP(c.credito.cupoAutorizado)}</td>
                    <td className="right tabular">{formatCOP(c.credito.utilizado)}</td>
                    <td className="right tabular">{formatCOP(creditoDisponible(c.credito))}</td>
                    <td className="right tabular">{c.conveniosActivos}</td>
                    <td className="right"><Link to={`/ges/cooperativas/${c.id}`} style={{ fontSize: 13, fontWeight: 600 }}>Ver</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageRows.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalLabel={`Mostrando ${pageRows.length} de ${total} entidades`} />
        )}
      </div>

      <Modal
        open={coopFormOpen}
        onClose={cerrarFormCoop}
        title="Crear entidad"
        actions={
          <>
            <Button variant="secondary" onClick={cerrarFormCoop} disabled={coopSaving}>Cancelar</Button>
            <Button onClick={crearCooperativa} loading={coopSaving}>Crear entidad</Button>
          </>
        }
      >
        <Field label="Nombre de la entidad" error={coopErrors.nombre}>
          <Input value={coopDraft.nombre} onChange={(e) => setCoopDraft((d) => ({ ...d, nombre: e.target.value }))} placeholder="Entidad ABC" />
        </Field>
        <Field label="Valor de la bolsa" optional hint="Monto de bolsa comprado como referencia — la entidad podrá comprar un monto distinto desde su panel.">
          <Input type="number" min="0" step="10000" value={coopDraft.bolsa} onChange={(e) => setCoopDraft((d) => ({ ...d, bolsa: e.target.value }))} placeholder="5000000" />
        </Field>
        <Field label="Cupo de crédito autorizado" optional hint="Límite máximo de crédito que GES autoriza a la entidad. Puede dejarse en $0 y aumentarse después.">
          <Input type="number" min="0" step="10000" value={coopDraft.cupoCredito} onChange={(e) => setCoopDraft((d) => ({ ...d, cupoCredito: e.target.value }))} placeholder="10000000" />
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
        <Field label="Entidad" error={userErrors.cooperativaId} hint="El usuario quedará como Administrador de esta entidad.">
          <Select value={userDraft.cooperativaId} onChange={(e) => setUserDraft((d) => ({ ...d, cooperativaId: e.target.value }))}>
            <option value="">Selecciona una entidad…</option>
            {cooperativas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
        </Field>
        <p className="text-caption cell-muted">Rol: Administrador de entidad.</p>
      </Modal>
    </div>
  );
}
