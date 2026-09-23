import { Link } from 'react-router-dom';
import { StatusBadge, Badge } from '../ui/Badge';
import { formatDate } from '../../utils/format';

// `ticket` is the real TicketOut from GET /api/tickets/me (snake_case,
// canonical inventory states — see backend/app/models/enums.py). Unlike an
// earlier design assumption, `unidades_inventario` has no
// `fecha_vencimiento` column in the real schema, so there is no per-ticket
// expiration to show or warn about here.
//
// El QR/código de barras NUNCA se muestra en esta vista web — solo
// aparece en el PDF generado (ver services/apiClient.js, handler de
// `/api/tickets/me/*/descarga`). Aquí solo se ve el código como texto
// (información normal del ticket), junto con el resto de sus datos.
export default function TicketCard({ ticket, convenio, linkToDetail = true }) {
  const content = (
    <div className="ticket-card">
      <div className="ticket-card-notch ticket-card-notch-left" />
      <div className="ticket-card-notch ticket-card-notch-right" />
      <div className="ticket-card-header">
        <div>
          {convenio?.convenio_nombre && <div className="text-caption">{convenio.convenio_nombre}</div>}
          <div style={{ fontSize: 15, fontWeight: 600 }}>{convenio?.nombre ?? '—'}</div>
        </div>
        <StatusBadge status={ticket.estado} />
      </div>

      <div className="ticket-card-divider" />

      <div className="ticket-card-body">
        <div>
          <div className="text-caption cell-muted">Código</div>
          <span className="text-mono ticket-code-text">{ticket.codigo}</span>
        </div>
        {ticket.fecha_vencimiento && (
          <div>
            <div className="text-caption cell-muted">Vence</div>
            <span className="text-small">{formatDate(ticket.fecha_vencimiento)}</span>
          </div>
        )}
        <p className="text-caption cell-muted" style={{ margin: 0 }}>
          El código QR y de barras solo aparecen en el PDF — usa “Generar PDF” para presentarlo o redimirlo.
        </p>
      </div>

      {linkToDetail && (
        <div className="ticket-card-footer">
          <Badge tone="outline">Ver detalle</Badge>
        </div>
      )}
    </div>
  );

  if (!linkToDetail) return content;
  return <Link to={`/portal/tickets/${ticket.id}`} className="ticket-card-link">{content}</Link>;
}
