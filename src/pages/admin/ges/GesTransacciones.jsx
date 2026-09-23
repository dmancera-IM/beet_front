import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Input, Select } from '../../../components/ui/Field';
import { IconBuscar } from '../../../components/ui/Icons';
import { EmptyState } from '../../../components/ui/States';
import { useTableState } from '../../../hooks/useTableState';
import GesNav from './GesNav';
import SolicitudesTable from './SolicitudesTable';
import { getSolicitudes } from './gesData';

// Operaciones GES↔cooperativa: quién (administrador/cooperativa) pidió qué
// convenio, cuánto, cuándo, con qué forma de pago y en qué estado. Solo
// lectura ("Ver") — únicamente dos estados: "Pendiente" (todavía no se
// puede completar, ej. sin inventario suficiente) y "Completada" (el
// inventario ya fue asignado/vendido). Sin aprobación manual.
export default function GesTransacciones() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Transacciones' }]);

  const solicitudes = getSolicitudes();

  // Buscar únicamente entre administradores de cooperativas y cooperativas
  // (nunca afiliados ni otros tipos de usuario — esta tabla tampoco los
  // tiene, son solicitudes GES↔cooperativa).
  const { search, setSearch, filters, setFilter, pageRows, total } = useTableState({
    data: solicitudes,
    searchFields: ['cooperativaNombre', 'administrador'],
    pageSize: 50,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Transacciones</h1>
          <p className="page-subtitle">Operaciones entre GES y las entidades: quién solicitó, qué convenio, cuánto y en qué estado.</p>
        </div>
      </div>

      <GesNav />

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar administrador o cooperativa..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <Select style={{ width: 160 }} value={filters.estado ?? ''} onChange={(e) => setFilter('estado', e.target.value)}>
              <option value="">Todo estado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Completada">Completada</option>
            </Select>
          </div>
        </div>

        {pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="Sin transacciones registradas" description="Las operaciones entre GES y las entidades aparecerán aquí." />
          ) : (
            <EmptyState title="Sin transacciones que coincidan" description="Ajusta los filtros o el término de búsqueda." />
          )
        ) : (
          <SolicitudesTable solicitudes={pageRows} />
        )}
      </div>
    </div>
  );
}
