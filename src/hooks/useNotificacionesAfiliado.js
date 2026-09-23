import { useEffect, useState } from 'react';
import * as ticketsService from '../services/ticketsService';

// "Próximo a vencer": faltan 7 días o menos para la fecha de vencimiento y
// el ticket todavía no venció. Misma regla que ya usaba
// components/portal/TicketsPorVencerAlert.jsx (ahora reemplazada por la
// sección Notificaciones + el aviso temporal al entrar) — no se duplica el
// criterio, solo se reubica aquí para que ambos puntos de entrada
// (toast al ingresar y la vista Notificaciones) lean exactamente lo mismo.
const DIAS_ALERTA = 7;

function diasHasta(fechaISO) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${fechaISO}T00:00:00`);
  return Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));
}

// Único origen de notificaciones del mock actual: tickets entregados
// próximos a vencer (sección 8 — "no inventar nuevas categorías todavía").
// Cada notificación ya sabe a qué ticket corresponde (`ticketId`), para
// poder redirigir directo a él desde la vista Notificaciones (sección 5).
function ticketsAvNotificaciones(tickets) {
  return tickets
    .filter((t) => t.estado === 'ENTREGADA' && t.fecha_vencimiento)
    .filter((t) => {
      const dias = diasHasta(t.fecha_vencimiento);
      return dias >= 0 && dias <= DIAS_ALERTA;
    })
    .map((t) => ({
      id: `ticket-vencimiento-${t.id}`,
      tipo: 'ticket_por_vencer',
      ticketId: t.id,
      icono: '🎟️',
      titulo: t.convenio_nombre ? `Tu bono ${t.convenio_nombre} está próximo a vencer.` : 'Un bono tuyo está próximo a vencer.',
      detalle: t.producto_nombre ?? null,
      fechaVencimiento: t.fecha_vencimiento,
    }));
}

// Hook compartido por el toast temporal al entrar al portal (PortalHome) y
// por la vista Notificaciones (Notificaciones.jsx) — una sola llamada a
// ticketsService.misTickets(), un solo criterio de "próximo a vencer".
export function useNotificacionesAfiliado() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    ticketsService
      .misTickets()
      .then((tickets) => {
        if (cancelado) return;
        setNotificaciones(ticketsAvNotificaciones(tickets));
      })
      .catch(() => {
        // Silencioso: esto es informativo, no debe bloquear el portal.
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => { cancelado = true; };
  }, []);

  return { notificaciones, loading };
}
