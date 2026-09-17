import { useEffect, useState } from 'react';
import Alert from '../ui/Alert';
import * as ticketsService from '../../services/ticketsService';
import { formatDate } from '../../utils/format';

// "Próximo a vencer": faltan 7 días o menos para la fecha de vencimiento y
// el ticket todavía no venció. No cambiar esta regla sin necesidad.
const DIAS_ALERTA = 7;

function diasHasta(fechaISO) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${fechaISO}T00:00:00`);
  return Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));
}

// Alerta informativa DENTRO del portal (no es push/SMS/correo/notificación
// del navegador) que se muestra al afiliado apenas entra al sistema si
// tiene tickets entregados próximos a vencer. Solo informa la fecha de
// vencimiento del ticket — BEET no controla ni registra la redención
// (cuándo/dónde/quién lo redimió sigue siendo responsabilidad del proveedor).
export default function TicketsPorVencerAlert() {
  const [proximos, setProximos] = useState([]);

  useEffect(() => {
    let cancelado = false;
    ticketsService
      .misTickets()
      .then((tickets) => {
        if (cancelado) return;
        // Solo tickets ya entregados (nunca vencidos) del afiliado
        // autenticado — ticketsService.misTickets() ya está scopeado a él.
        const filtrados = tickets.filter((t) => {
          if (t.estado !== 'ENTREGADA' || !t.fecha_vencimiento) return false;
          const dias = diasHasta(t.fecha_vencimiento);
          return dias >= 0 && dias <= DIAS_ALERTA;
        });
        setProximos(filtrados);
      })
      .catch(() => {
        // Silencioso: esto es informativo, no debe bloquear el ingreso al portal.
      });
    return () => { cancelado = true; };
  }, []);

  if (proximos.length === 0) return null;

  return (
    <div className="section-gap">
    <Alert
      tone="warning"
      title={`Tienes ${proximos.length} ticket${proximos.length > 1 ? 's' : ''} próximo${proximos.length > 1 ? 's' : ''} a vencer`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0 8px' }}>
        {proximos.map((t) => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>{t.convenio_nombre}{t.producto_nombre ? ` — ${t.producto_nombre}` : ''}</span>
            <span className="tabular" style={{ fontWeight: 600 }}>Vence: {formatDate(t.fecha_vencimiento)}</span>
          </div>
        ))}
      </div>
      Revisa tus tickets antes de su fecha de vencimiento.
    </Alert>
    </div>
  );
}
