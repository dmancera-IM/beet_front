import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/States';
import { formatDate } from '../../../utils/format';

const FORMA_PAGO_TONE = { Cupo: 'blue', Crédito: 'amber' };

// Tabla de transacciones GES↔cooperativa, compartida entre GesTransacciones
// (todas las cooperativas) y la pestaña "Transacciones" de CooperativaDetail
// (una sola). Solo lectura — GES ya no aprueba/rechaza manualmente: solo
// existen dos estados, "Pendiente" (todavía no se puede completar, ej. sin
// inventario suficiente) y "Completada" (el inventario ya fue asignado/
// vendido); `formaPago` es un valor de demostración.
export default function SolicitudesTable({ solicitudes, showCooperativa = true }) {
  const [detalle, setDetalle] = useState(null);

  if (solicitudes.length === 0) {
    return <EmptyState title="No hay transacciones" description="Las transacciones entre GES y las cooperativas aparecerán aquí." />;
  }

  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {showCooperativa && <th>Cooperativa</th>}
              <th>Administrador</th>
              <th>Convenio</th>
              <th className="right">Cantidad</th>
              <th>Fecha</th>
              <th>Forma de pago</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                {showCooperativa && <td className="cell-primary">{s.cooperativaNombre}</td>}
                <td className="text-small">{s.administrador ?? '—'}</td>
                <td className="text-small">{s.proveedorNombre}</td>
                <td className="right tabular">{s.cantidad.toLocaleString('es-CO')}</td>
                <td className="text-small">{formatDate(s.fecha)}</td>
                <td>{s.formaPago ? <Badge tone={FORMA_PAGO_TONE[s.formaPago] ?? 'neutral'}>{s.formaPago}</Badge> : '—'}</td>
                <td><StatusBadge status={s.estado} /></td>
                <td className="right">
                  <Button size="sm" variant="secondary" onClick={() => setDetalle(s)}>Ver</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title="Detalle de la transacción"
        actions={<Button variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><span className="text-label">Cooperativa</span><div>{detalle.cooperativaNombre}</div></div>
            <div><span className="text-label">Administrador</span><div>{detalle.administrador ?? '—'}</div></div>
            <div><span className="text-label">Convenio</span><div>{detalle.proveedorNombre}</div></div>
            <div><span className="text-label">Cantidad solicitada</span><div className="tabular">{detalle.cantidad.toLocaleString('es-CO')} unidades</div></div>
            <div><span className="text-label">Fecha de solicitud</span><div>{formatDate(detalle.fecha)}</div></div>
            <div><span className="text-label">Forma de pago</span><div>{detalle.formaPago ? <Badge tone={FORMA_PAGO_TONE[detalle.formaPago] ?? 'neutral'}>{detalle.formaPago}</Badge> : '—'}</div></div>
            <div><span className="text-label">Estado</span><div><StatusBadge status={detalle.estado} /></div></div>
          </div>
        )}
      </Modal>
    </>
  );
}
