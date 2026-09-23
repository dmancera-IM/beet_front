import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { EmptyState } from '../../../components/ui/States';
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
        {solicitudes.length === 0 ? (
          <EmptyState title="Sin solicitudes B2B todavía" description="Las compras rápidas/prioritarias que hagan las entidades aparecerán aquí." />
        ) : (
          <SolicitudesTable solicitudes={solicitudes} />
        )}
      </div>
    </div>
  );
}
