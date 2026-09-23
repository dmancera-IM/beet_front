import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Input } from '../../../components/ui/Field';
import { IconBuscar } from '../../../components/ui/Icons';
import { EmptyState } from '../../../components/ui/States';
import { useTableState } from '../../../hooks/useTableState';
import GesNav from './GesNav';
import SolicitudesTable from './SolicitudesTable';
import { getSolicitudesB2B } from './gesData';

// GES → B2B (sección 6): solicitudes de compra rápida/prioritaria hechas
// por las entidades desde ADMIN → B2B. Reutiliza la misma tabla de
// transacciones de siempre (GesTransacciones), solo que filtrada a
// prioridad Alta — no es un flujo de aprobación nuevo, sigue siendo de
// solo lectura con los mismos dos estados (Pendiente/Completada).
export default function GesB2B() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'B2B' }]);

  const solicitudes = getSolicitudesB2B();

  // Mismo concepto de búsqueda que GES → Transacciones: solo administrador
  // de cooperativa o cooperativa, nunca afiliados (esta tabla tampoco los
  // tiene).
  const { search, setSearch, pageRows, total } = useTableState({
    data: solicitudes,
    searchFields: ['cooperativaNombre', 'administrador'],
    pageSize: 50,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">B2B</h1>
          <p className="page-subtitle">Solicitudes de compra rápida y prioritaria hechas por las entidades.</p>
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
          </div>
        </div>

        {pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="Sin solicitudes B2B todavía" description="Las compras rápidas/prioritarias que hagan las entidades aparecerán aquí." />
          ) : (
            <EmptyState title="Sin solicitudes que coincidan" description="Ajusta el término de búsqueda." />
          )
        ) : (
          <SolicitudesTable solicitudes={pageRows} />
        )}
      </div>
    </div>
  );
}
