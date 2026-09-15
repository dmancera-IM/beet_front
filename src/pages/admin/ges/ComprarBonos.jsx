import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/States';
import { IconInventario } from '../../../components/ui/Icons';
import GesNav from './GesNav';

// Lugar donde GES comprará bonos/boletas a los PROVEEDORES para abastecer
// el Storage (proveedor → GES → Storage). El proceso exacto de compra
// (pasarela, facturación, condiciones comerciales) todavía no está
// definido — esta pantalla solo deja la estructura visual preparada, sin
// inventar ninguna regla.
export default function ComprarBonos() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Comprar bonos y boletas' }]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Comprar bonos y boletas</h1>
          <p className="page-subtitle">Abastecimiento del Storage de GES directamente con los proveedores.</p>
        </div>
      </div>

      <GesNav />

      <Card padding="card-pad-lg">
        <EmptyState
          icon={<IconInventario color="var(--text-muted)" />}
          title="Compra de bonos y boletas"
          description="Esta sección estará disponible cuando se defina el proceso de compra y abastecimiento del Storage."
        />
      </Card>
    </div>
  );
}
