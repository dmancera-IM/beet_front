import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/States';
import { formatDateTime, formatCOP } from '../../../utils/format';

const FORMA_PAGO_TONE = { BOLSA: 'green', CREDITO: 'amber' };

// Tabla real de `solicitudes_compra` (beet_backend/app/routers/solicitudes.py)
// — compartida entre GesTransacciones (todas), GesB2B (prioridad ALTA) y la
// pestaña "Transacciones" de CooperativaDetail (una sola entidad).
// `cooperativasById`/`productosById`: mapas id -> {nombre, ...} para no
// repetir el join en cada pantalla (el backend real no anida esos nombres
// en la fila de la solicitud). `onCompletar`: reintenta la asignación de
// storage para una solicitud PENDIENTE (solo GES/SUPER_ADMIN).
export default function SolicitudesTable({ solicitudes, cooperativasById = {}, productosById = {}, showCooperativa = true, onCompletar }) {
  const [detalle, setDetalle] = useState(null);
  const [completando, setCompletando] = useState(null);

  if (solicitudes.length === 0) {
    return <EmptyState title="No hay solicitudes" description="Las solicitudes de compra entre GES y las entidades aparecerán aquí." />;
  }

  const nombreCooperativa = (id) => cooperativasById[id]?.nombre ?? `Entidad #${id}`;
  const producto = (id) => productosById[id];
  const valorSolicitud = (s) => {
    const p = producto(s.id_producto);
    return p?.precio_venta_entidad != null ? s.cantidad * p.precio_venta_entidad : null;
  };

  const handleCompletar = async (s) => {
    setCompletando(s.id);
    try {
      await onCompletar(s.id);
    } finally {
      setCompletando(null);
    }
  };

  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {showCooperativa && <th>Entidad</th>}
              <th>Producto</th>
              <th className="right">Cantidad</th>
              <th>Fecha</th>
              <th>Forma de pago</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id}>
                {showCooperativa && <td className="cell-primary">{nombreCooperativa(s.id_cooperativa)}</td>}
                <td className="text-small">{producto(s.id_producto)?.nombre ?? `Producto #${s.id_producto}`}</td>
                <td className="right tabular">{s.cantidad.toLocaleString('es-CO')}</td>
                <td className="text-small">{formatDateTime(s.fecha_solicitud)}</td>
                <td><Badge tone={FORMA_PAGO_TONE[s.forma_pago] ?? 'neutral'}>{s.forma_pago}</Badge></td>
                <td>{s.prioridad === 'ALTA' ? <Badge tone="red">Alta</Badge> : <Badge tone="neutral">Normal</Badge>}</td>
                <td><StatusBadge status={s.estado} /></td>
                <td className="right" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {s.estado !== 'COMPLETADA' && onCompletar && (
                    <Button size="sm" onClick={() => handleCompletar(s)} loading={completando === s.id}>Completar</Button>
                  )}
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
        title="Detalle de la solicitud"
        actions={<Button variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (() => {
          const valor = valorSolicitud(detalle);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="cell-primary" style={{ fontSize: 15 }}>{nombreCooperativa(detalle.id_cooperativa)}</div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div><span className="text-label">Producto</span><div>{producto(detalle.id_producto)?.nombre ?? `#${detalle.id_producto}`}</div></div>
                <div><span className="text-label">Fecha de solicitud</span><div>{formatDateTime(detalle.fecha_solicitud)}</div></div>
                <div><span className="text-label">Forma de pago</span><div><Badge tone={FORMA_PAGO_TONE[detalle.forma_pago] ?? 'neutral'}>{detalle.forma_pago}</Badge></div></div>
                <div><span className="text-label">Estado</span><div><StatusBadge status={detalle.estado} /></div></div>
                <div><span className="text-label">Cantidad</span><div className="tabular">{detalle.cantidad.toLocaleString('es-CO')} unidades</div></div>
                <div><span className="text-label">Dinero</span><div className="tabular">{valor != null ? formatCOP(valor) : '—'}</div></div>
                {detalle.fecha_completada && (
                  <div><span className="text-label">Completada el</span><div>{formatDateTime(detalle.fecha_completada)}</div></div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
