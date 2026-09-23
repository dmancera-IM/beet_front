import { useSetBreadcrumbs } from '../../components/layout/breadcrumbs';
import { Card } from '../../components/ui/Card';
import { formatCOP } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { bolsaDisponible, creditoDisponible, getCooperativa } from './ges/gesData';
import ComprarBonosGes from './ComprarBonosGes';
import B2BForm from './b2b/B2BForm';

// Fusión visual de las dos vistas que antes vivían por separado en el
// sidebar de ADMIN ("GES" y "B2B") — se mantiene el contenido completo de
// ambos formularios de compra (ComprarBonosGes y B2BForm) debajo de esta
// sección, que es puramente informativa.
//
// Bolsa y Crédito son dos conceptos independientes — NUNCA se muestran
// mezclados en un único bloque (ronda "Organización visual"):
//   BOLSA:   un monto que la entidad ya compró y va consumiendo
//            (`bolsaDisponible()`, nunca restado a mano).
//   CRÉDITO: un LÍMITE que GES autoriza (credito.cupoAutorizado, ver
//            GES → Entidades → detalle), del cual la entidad ya usó una
//            parte (`creditoDisponible()`).
// Esta sección solo muestra el estado de cada uno en dos Card
// independientes — la compra real (elegir convenio/producto/cantidad y
// con cuál de los dos pagar) se hace más abajo, en "Comprar bonos y
// boletas a GES" y en "B2B", que son los únicos formularios que de verdad
// mueven estos saldos.
export default function BolsaCredito() {
  useSetBreadcrumbs([{ label: 'Bolsa / Crédito' }]);
  const { cooperativaId } = useAuth();
  const cooperativa = getCooperativa(cooperativaId);
  const bolsa = cooperativa?.bolsa ?? { valor: 0, consumido: 0 };
  const credito = cooperativa?.credito ?? { cupoAutorizado: 0, utilizado: 0 };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Bolsa / Crédito</h1>
          <p className="page-subtitle">Estado actual de la bolsa y el crédito de tu entidad. Compra bonos y boletas desde los formularios de abajo.</p>
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 12 }}>Bolsa</div>
          <Row label="Valor de la bolsa" value={formatCOP(bolsa.valor)} />
          <Row label="Consumido" value={formatCOP(bolsa.consumido)} />
          <Row label="Disponible" value={formatCOP(bolsaDisponible(bolsa))} />
        </Card>
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 12 }}>Crédito</div>
          <Row label="Cupo aprobado" value={formatCOP(credito.cupoAutorizado)} />
          <Row label="Utilizado" value={formatCOP(credito.utilizado)} />
          <Row label="Disponible" value={formatCOP(creditoDisponible(credito))} />
        </Card>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card padding="card-pad-lg">
          <ComprarBonosGes />
        </Card>
        <Card padding="card-pad-lg">
          <B2BForm />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
      <span className="text-small">{label}</span>
      <span className="tabular" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
