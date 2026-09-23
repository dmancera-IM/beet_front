import { useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Input } from '../../../components/ui/Field';
import { IconBuscar } from '../../../components/ui/Icons';
import { EmptyState } from '../../../components/ui/States';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useTableState } from '../../../hooks/useTableState';
import { useAuth } from '../../../context/AuthContext';
import { formatCOP, formatDate } from '../../../utils/format';
import { getSolicitudesPorCooperativa } from '../ges/gesData';
import { precioGesEntidadDe } from '../../../services/mockDb';

// Transacciones para ADMIN (sección 6): el historial de bonos/boletas que
// la cooperativa adquirió desde GES (ver ADMIN → GES). No se muestran
// estados de transacción — ni columna, ni badges, ni filtros: es
// simplemente el historial de lo adquirido, sin importar si GES ya lo
// completó o sigue pendiente de asignar internamente.
export default function TransaccionesListAdmin() {
  useSetBreadcrumbs([{ label: 'Transacciones' }]);
  const { cooperativaId } = useAuth();
  const [detalle, setDetalle] = useState(null);

  const solicitudes = getSolicitudesPorCooperativa(cooperativaId);

  const { search, setSearch, pageRows, total } = useTableState({
    data: solicitudes,
    searchFields: ['proveedorNombre', 'productoNombre', 'administrador'],
    pageSize: 20,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Transacciones</h1>
          <p className="page-subtitle">Historial de bonos y boletas que tu entidad ha adquirido desde GES.</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 280 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar por convenio, producto o administrador" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>

        {pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="Sin transacciones registradas" description="Los bonos y boletas que adquieras desde GES aparecerán aquí." />
          ) : (
            <EmptyState title="Sin transacciones que coincidan" description="Ajusta el término de búsqueda." />
          )
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th>Producto</th>
                  <th className="right">Cantidad</th>
                  <th>Fecha</th>
                  <th>Solicitado por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => (
                  <tr key={s.id}>
                    <td className="cell-primary">{s.proveedorNombre}</td>
                    <td className="text-small">{s.productoNombre}</td>
                    <td className="right tabular">{s.cantidad.toLocaleString('es-CO')}</td>
                    <td className="text-small">{formatDate(s.fecha)}</td>
                    <td className="text-small">{s.administrador ?? '—'}</td>
                    <td className="right">
                      <Button size="sm" variant="secondary" onClick={() => setDetalle(s)}>Ver</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title="Detalle de la transacción"
        actions={<Button variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (() => {
          const precio = precioGesEntidadDe(detalle.productoId);
          const dineroGastado = precio != null ? precio * detalle.cantidad : null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><span className="text-label">Convenio</span><div>{detalle.proveedorNombre}</div></div>
              <div><span className="text-label">Producto</span><div>{detalle.productoNombre}</div></div>
              <div><span className="text-label">Cantidad</span><div className="tabular">{detalle.cantidad.toLocaleString('es-CO')} unidades</div></div>
              <div><span className="text-label">Dinero gastado</span><div className="tabular">{dineroGastado != null ? formatCOP(dineroGastado) : '—'}</div></div>
              <div><span className="text-label">Fecha</span><div>{formatDate(detalle.fecha)}</div></div>
              <div><span className="text-label">Solicitado por</span><div>{detalle.administrador ?? '—'}</div></div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
