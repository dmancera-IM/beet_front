import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import Avatar from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import * as transaccionesService from '../../../services/transaccionesService';
import * as afiliadosService from '../../../services/afiliadosService';
import * as convenioService from '../../../services/convenioService';
import { formatCOP, formatDateTime, cuotasLabel } from '../../../utils/format';
import { useAreaBase } from '../../../hooks/useAreaBase';

// ADAPTADO AL BACKEND REAL: `transacciones` no tiene un `codigos[]` embebido
// (esos códigos ahora viven en `tickets`, sin un endpoint admin para
// consultar los tickets de un afiliado ajeno) ni una fila de documento de
// asunción de deuda (no existe esa tabla). Ambas secciones quedan
// documentadas como pendientes en vez de mostrarse con datos inventados.
export default function TransaccionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useAreaBase();

  const [trx, setTrx] = useState(null);
  const [afiliado, setAfiliado] = useState(null);
  const [producto, setProducto] = useState(null);
  const [convenio, setConvenio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useSetBreadcrumbs([
    { label: 'Transacciones', to: `${base}/transacciones` },
    { label: id },
  ]);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    transaccionesService
      .obtenerTransaccion(id)
      .then((t) => {
        setTrx(t);
        afiliadosService.obtenerAfiliado(t.afiliado_id).then(setAfiliado).catch(() => setAfiliado(null));
        convenioService.listarProductos({}).then((productos) => {
          const p = productos.find((pr) => pr.id === t.id_producto) ?? null;
          setProducto(p);
          if (p) convenioService.obtenerConvenio(p.id_convenio).then(setConvenio).catch(() => setConvenio(null));
        });
      })
      .catch((err) => setError(err.status === 404 ? null : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <LoadingState title="Cargando transacción desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;
  if (!trx) {
    return <EmptyState title="Transacción no encontrada" actionLabel="Volver a transacciones" onAction={() => navigate(`${base}/transacciones`)} />;
  }

  const nombreAfiliado = afiliado ? `${afiliado.nombres} ${afiliado.apellidos}` : '—';
  const nombreConvenioProducto = convenio && producto ? `${convenio.nombre} · ${producto.nombre}` : 'Convenio';

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="text-label text-mono">TRX-{trx.id}</span>
          <h1 className="text-h1 page-title">{nombreConvenioProducto}</h1>
          <p className="page-subtitle">{formatDateTime(trx.created_at)}</p>
        </div>
        <div className="page-header-actions">
          <StatusBadge status={trx.estado} />
        </div>
      </div>

      <div className="grid detail-grid-2col" style={{ '--col-ratio': '1.2fr 1fr', gap: 16 }}>
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 14 }}>Detalle de la compra</div>
          <div className="grid grid-3">
            <Detail label="Convenio" value={convenio && producto ? nombreConvenioProducto : undefined} />
            <Detail label="Unidades" value={trx.cantidad} />
            <Detail label="Subtotal" value={formatCOP(trx.subtotal)} />
            <Detail label="Total" value={formatCOP(trx.total)} />
            <Detail label="Forma de pago" value={trx.metodo_pago === 'CUPO' ? 'Cupo de la entidad' : trx.metodo_pago} />
            {trx.metodo_pago === 'CUPO' && <Detail label="Cuotas" value={trx.numero_cuotas} />}
            {trx.referencia_pago && <Detail label="Referencia de pago" value={trx.referencia_pago} />}
            <Detail label="Fecha y hora" value={formatDateTime(trx.created_at)} />
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-default)' }}>
            <div className="text-label" style={{ marginBottom: 10 }}>Unidades asignadas (tickets)</div>
            <p className="text-small cell-muted" style={{ marginTop: 0 }}>
              El backend actual no expone un endpoint para que un administrador consulte los tickets de un afiliado ajeno —
              solo el propio afiliado puede verlos desde su portal (GET /tickets/me).
            </p>
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card padding="card-pad-lg">
            <div className="text-label" style={{ marginBottom: 12 }}>Afiliado</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={nombreAfiliado} />
              <div>
                <div style={{ fontWeight: 600 }}>{nombreAfiliado}</div>
                <div className="cell-muted text-mono">{afiliado?.documento}</div>
              </div>
            </div>
            {afiliado && (
              <Button size="sm" variant="ghost" style={{ marginTop: 12 }} onClick={() => navigate(`${base}/afiliados/${afiliado.id}`)}>Ver perfil completo</Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-label">{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }} className="tabular">{value ?? '—'}</div>
    </div>
  );
}
