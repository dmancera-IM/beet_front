import { useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../components/layout/breadcrumbs';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';
import { formatCOP } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import * as adminService from '../../services/adminService';
import ComprarBonosGes from './ComprarBonosGes';
import B2BForm from './b2b/B2BForm';

export default function BolsaCredito() {
  useSetBreadcrumbs([{ label: 'Bolsa / Crédito' }]);
  const { cooperativaId } = useAuth();

  const [bolsa, setBolsa] = useState(null);
  const [credito, setCredito] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = () => {
    if (!cooperativaId) return;
    setLoading(true);
    setError(null);
    Promise.all([adminService.obtenerBolsa(cooperativaId), adminService.obtenerCredito(cooperativaId)])
      .then(([b, c]) => { setBolsa(b); setCredito(c); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(cargar, [cooperativaId]);

  if (loading) return <LoadingState title="Cargando bolsa y crédito desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Bolsa / Crédito</h1>
          <p className="page-subtitle">Estado actual de la bolsa y el crédito de tu entidad, desde PostgreSQL.</p>
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 12 }}>Bolsa</div>
          <Row label="Valor de la bolsa" value={formatCOP(bolsa.valor)} />
          <Row label="Consumido" value={formatCOP(bolsa.consumido)} />
          <Row label="Disponible" value={formatCOP(bolsa.valor - bolsa.consumido)} />
        </Card>
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 12 }}>Crédito</div>
          <Row label="Cupo aprobado por GES" value={formatCOP(credito.cupo_autorizado)} />
          <Row label="Utilizado" value={formatCOP(credito.utilizado)} />
          <Row label="Disponible" value={formatCOP(credito.cupo_autorizado - credito.utilizado)} />
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
