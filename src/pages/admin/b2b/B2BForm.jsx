import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { SolicitudCompraForm } from '../ComprarBonosGes';

// ADAPTADO AL BACKEND REAL: "B2B" es exactamente la misma solicitud de
// compra que ComprarBonosGes, con `prioridad = 'ALTA'` (el único campo del
// esquema real que corresponde a "compra rápida/prioritaria") — reutiliza
// el mismo formulario conectado a POST /solicitudes-compra en vez de
// duplicar la lógica contra gesData.js.
export default function B2BForm() {
  useSetBreadcrumbs([{ label: 'B2B' }]);
  return (
    <SolicitudCompraForm
      prioridad="ALTA"
      titulo="B2B — Compra rápida y prioritaria"
      subtitulo="Misma solicitud de compra que GES, marcada con prioridad alta."
    />
  );
}
