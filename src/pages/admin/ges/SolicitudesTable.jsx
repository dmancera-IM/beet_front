import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/States';
import { formatDate, formatCOP } from '../../../utils/format';
import { getProducto } from './gesData';

const FORMA_PAGO_TONE = { Cupo: 'blue', Crédito: 'amber' };

// Tabla de transacciones GES↔entidad, compartida entre GesTransacciones
// (todas las entidades) y la pestaña "Transacciones" de CooperativaDetail
// (una sola). Solo lectura — GES ya no aprueba/rechaza manualmente: solo
// existen dos estados, "Pendiente" (todavía no se puede completar, ej. sin
// inventario suficiente) y "Completada" (el inventario ya fue asignado/
// vendido); `formaPago` es un valor de demostración.
export default function SolicitudesTable({ solicitudes, showCooperativa = true }) {
  const [detalle, setDetalle] = useState(null);

  if (solicitudes.length === 0) {
    return <EmptyState title="No hay transacciones" description="Las transacciones entre GES y las entidades aparecerán aquí." />;
  }

  // Dinero gastado en ESTA transacción puntual: cantidad × precio al que
  // GES le vende ese producto a la entidad (precio GES→entidad, no el
  // precio que la entidad le cobra a sus afiliados, que es un dato
  // distinto). Ya no se muestra el bloque agregado "Detalle del dinero"
  // (comprado/consumido/restante acumulado del producto) — solo el valor
  // de esta compra puntual.
  const valorTransaccion = (s) => {
    const precio = getProducto(s.productoId)?.precioVentaEntidad ?? null;
    return precio != null ? s.cantidad * precio : null;
  };

  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {showCooperativa && <th>Entidad</th>}
              <th>Convenio</th>
              <th>Producto</th>
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
                {showCooperativa && (
                  <td>
                    <div className="cell-primary">{s.cooperativaNombre}</div>
                    <div className="cell-muted text-small">Administrador: {s.administrador ?? '—'}</div>
                  </td>
                )}
                <td className="text-small">{s.proveedorNombre}</td>
                <td className="text-small">{s.productoNombre}</td>
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
        {detalle && (() => {
          const valor = valorTransaccion(detalle);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div className="cell-primary" style={{ fontSize: 15 }}>{detalle.cooperativaNombre}</div>
                <div className="cell-muted text-small">Administrador: {detalle.administrador ?? '—'}</div>
              </div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <div><span className="text-label">Convenio</span><div>{detalle.proveedorNombre}</div></div>
                <div><span className="text-label">Producto</span><div>{detalle.productoNombre}</div></div>
                <div><span className="text-label">Fecha de solicitud</span><div>{formatDate(detalle.fecha)}</div></div>
                <div><span className="text-label">Forma de pago</span><div>{detalle.formaPago ? <Badge tone={FORMA_PAGO_TONE[detalle.formaPago] ?? 'neutral'}>{detalle.formaPago}</Badge> : '—'}</div></div>
                <div><span className="text-label">Estado</span><div><StatusBadge status={detalle.estado} /></div></div>
                <div><span className="text-label">Cantidad de esta transacción</span><div className="tabular">{detalle.cantidad.toLocaleString('es-CO')} unidades</div></div>
                <div><span className="text-label">Dinero gastado</span><div className="tabular">{valor != null ? formatCOP(valor) : '—'}</div></div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
}
