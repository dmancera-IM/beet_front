import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { EmptyState, LoadingState } from '../../components/ui/States';
import { IconBell } from '../../components/ui/Icons';
import { formatDate } from '../../utils/format';
import { useNotificacionesAfiliado } from '../../hooks/useNotificacionesAfiliado';

// Todas las notificaciones del afiliado en un solo lugar (sección 3):
// mismas alertas que antes aparecían solo como un mensaje fijo en Inicio
// (ver hooks/useNotificacionesAfiliado.js), ahora consultables en
// cualquier momento aunque el aviso temporal ya haya desaparecido.
export default function Notificaciones() {
  const navigate = useNavigate();
  const { notificaciones, loading } = useNotificacionesAfiliado();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Notificaciones</h1>
          <p className="page-subtitle">Alertas sobre tus tickets y beneficios.</p>
        </div>
      </div>

      {loading ? (
        <LoadingState title="Cargando tus notificaciones…" />
      ) : notificaciones.length === 0 ? (
        <EmptyState
          icon={<IconBell color="var(--text-muted)" />}
          title="No tienes notificaciones"
          description="Cuando tengas tickets próximos a vencer, los verás aquí."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notificaciones.map((n) => (
            <Card
              key={n.id}
              padding="card-pad"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/portal/tickets/${n.ticketId}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/portal/tickets/${n.ticketId}`); }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">{n.icono}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.titulo}</div>
                <div className="text-caption cell-muted">
                  {n.detalle ? `${n.detalle} · ` : ''}Vence: {formatDate(n.fechaVencimiento)}
                </div>
                <div className="text-small" style={{ color: 'var(--brand-primary)', fontWeight: 600, marginTop: 4 }}>
                  Ver ticket →
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
