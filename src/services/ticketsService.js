import { apiClient } from "./apiClient";

export function misTickets() {
  return apiClient.get("/tickets/me", { tokenAudience: "afiliado" });
}

export async function descargarMiTicket(ticketId) {
  const ticket = await apiClient.get(`/tickets/${ticketId}/descargar`, { tokenAudience: "afiliado" });
  return new Blob([JSON.stringify(ticket, null, 2)], { type: "application/json" });
}
