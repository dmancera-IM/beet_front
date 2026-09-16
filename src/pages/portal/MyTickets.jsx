import { useEffect, useMemo, useState } from 'react';
import { Tabs } from '../../components/ui/Nav';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { IconRedencion } from '../../components/ui/Icons';
import TicketCard from '../../components/portal/TicketCard';
import * as ticketsService from '../../services/ticketsService';
import * as convenioService from '../../services/convenioService';

// Estados de unidades_inventario que puede ver el afiliado (sección 12 de
// FRONTEND_DB_ALIGNMENT.md): DISPONIBLE nunca aplica aquí (eso es
// inventario aún no entregado). BEET no controla la redención del bono —
// no existe un estado "utilizado/redimida" (sección 13).
const TABS = [
  { key: 'ENTREGADA', label: 'Activos' },
  { key: 'VENCIDA', label: 'Vencidos' },
];

export default function MyTickets() {
  const [tab, setTab] = useState('ENTREGADA');
  const [tickets, setTickets] = useState([]);
  const [conveniosPorId, setConveniosPorId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = () => {
    setLoading(true);
    setError(null);
    Promise.all([ticketsService.misTickets(), convenioService.obtenerCatalogoAfiliado()])
      .then(([t, c]) => {
        setTickets(t);
        // The catalog only lists active/valid convenios — a ticket for one
        // no longer active/valid simply shows "—" instead of a fabricated name.
        setConveniosPorId(Object.fromEntries(c.map((x) => [x.id, x])));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, tickets.filter((tk) => tk.estado === t.key).length])), [tickets]);
  const filtrados = tickets.filter((t) => t.estado === tab);

  if (loading) return <LoadingState title="Cargando tus tickets…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Mis tickets</h1>
          <p className="page-subtitle">Consulta y descarga el código de cada beneficio que has adquirido.</p>
        </div>
      </div>

      <Tabs items={TABS.map((t) => ({ ...t, count: counts[t.key] }))} active={tab} onChange={setTab} />

      <div style={{ marginTop: 20 }}>
        {filtrados.length === 0 ? (
          <EmptyState
            icon={<IconRedencion color="var(--text-muted)" />}
            title="No tienes tickets en este estado"
            description="Cuando compres un beneficio, aparecerá aquí."
          />
        ) : (
          <div className="grid grid-3">
            {filtrados.map((t) => (
              <TicketCard key={t.id} ticket={t} convenio={conveniosPorId[t.id_producto]} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
