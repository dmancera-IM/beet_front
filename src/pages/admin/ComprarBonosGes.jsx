import { useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../components/layout/breadcrumbs';
import { Card } from '../../components/ui/Card';
import { Field, Input, Select } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import * as adminService from '../../services/adminService';
import * as convenioService from '../../services/convenioService';
import * as solicitudesService from '../../services/solicitudesService';
import { formatCOP } from '../../utils/format';

// ADAPTADO AL BACKEND REAL: `POST /solicitudes-compra` recibe UN producto +
// cantidad + forma de pago por solicitud (no un carrito con varias líneas
// de una vez) — el backend valida el saldo (bolsa o crédito) ANTES de crear
// la fila y, si alcanza el storage disponible, la deja COMPLETADA de
// inmediato; si no, queda PENDIENTE (dinero ya descontado, falta
// inventario — GES la completa después desde /ges/transacciones).
export function SolicitudCompraForm({ prioridad = 'NORMAL', titulo, subtitulo }) {
  const { cooperativaId } = useAuth();
  const { push } = useToast();

  const [bolsa, setBolsa] = useState(null);
  const [credito, setCredito] = useState(null);
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cooperativaId) return;
    Promise.all([
      adminService.obtenerBolsa(cooperativaId),
      adminService.obtenerCredito(cooperativaId),
      convenioService.listarProductos({ soloActivos: true, tokenAudience: 'admin' }),
    ]).then(([b, c, prods]) => {
      setBolsa(b);
      setCredito(c);
      setProductos(prods.filter((p) => p.precio_venta_entidad != null));
    });
  }, [cooperativaId]);

  const producto = productos.find((p) => p.id === Number(productoId));
  const bolsaDisponible = bolsa ? bolsa.valor - bolsa.consumido : 0;
  const creditoDisponible = credito ? credito.cupo_autorizado - credito.utilizado : 0;
  const cupoDisponible = formaPago === 'BOLSA' ? bolsaDisponible : creditoDisponible;
  const valorCompra = producto && cantidad ? producto.precio_venta_entidad * Number(cantidad) : 0;
  const hayDatos = producto && Number(cantidad) > 0 && formaPago !== '';
  const cupoAlcanza = hayDatos && valorCompra <= cupoDisponible;

  const confirmar = async () => {
    setError('');
    setEnviando(true);
    try {
      const solicitud = await solicitudesService.crearSolicitud({
        idProducto: producto.id,
        cantidad: Number(cantidad),
        formaPago,
        prioridad,
      });
      setResultado(solicitud);
      setCantidad('');
      setFormaPago('');
      push({
        title: solicitud.estado === 'COMPLETADA' ? 'Solicitud completada' : 'Solicitud registrada (pendiente)',
        description: `${solicitud.cantidad.toLocaleString('es-CO')} unidades · ${formatCOP(valorCompra)}`,
      });
      const [b, c] = await Promise.all([adminService.obtenerBolsa(cooperativaId), adminService.obtenerCredito(cooperativaId)]);
      setBolsa(b);
      setCredito(c);
    } catch (err) {
      setError(err.message);
      push({ title: 'No se pudo registrar la solicitud', description: err.message, variant: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{titulo}</h1>
          <p className="page-subtitle">{subtitulo}</p>
        </div>
      </div>

      <Card padding="card-pad-lg" style={{ maxWidth: 520 }}>
        <Field label="Producto" hint={productos.length === 0 ? 'No hay productos activos con precio configurado.' : undefined}>
          <Select value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={productos.length === 0}>
            <option value="">Selecciona un producto…</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} · {formatCOP(p.precio_venta_entidad)}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cantidad">
          <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="10" />
        </Field>
        <Field label="Forma de pago" hint={`Bolsa disponible: ${formatCOP(bolsaDisponible)} · Crédito disponible: ${formatCOP(creditoDisponible)}`}>
          <Select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
            <option value="">Selecciona una forma de pago…</option>
            <option value="BOLSA">Bolsa</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </Field>

        {hayDatos && (
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <Row label="Cantidad" value={`${Number(cantidad).toLocaleString('es-CO')} unidades`} />
            <Row label="Valor de la solicitud" value={formatCOP(valorCompra)} />
          </div>
        )}

        {hayDatos && !cupoAlcanza && (
          <Alert tone="error" title="Saldo insuficiente">
            Tu {formaPago === 'BOLSA' ? 'bolsa disponible' : 'crédito disponible'} ({formatCOP(cupoDisponible)}) no alcanza para {formatCOP(valorCompra)}.
          </Alert>
        )}
        {error && <Alert tone="error" title="No se pudo registrar la solicitud">{error}</Alert>}
        {resultado && (
          <Alert tone="success" title={resultado.estado === 'COMPLETADA' ? 'Solicitud completada' : 'Solicitud pendiente'}>
            {resultado.estado === 'COMPLETADA'
              ? 'El inventario ya se asignó a tu entidad.'
              : 'Tu dinero ya se descontó, pero GES todavía no tiene suficiente storage — la completará en cuanto lo tenga.'}
          </Alert>
        )}

        <div style={{ marginTop: 16 }}>
          <Button onClick={confirmar} disabled={!hayDatos || !cupoAlcanza} loading={enviando}>Enviar solicitud</Button>
        </div>
      </Card>
    </div>
  );
}

export default function ComprarBonosGes() {
  useSetBreadcrumbs([{ label: 'GES' }]);
  return (
    <SolicitudCompraForm
      prioridad="NORMAL"
      titulo="Comprar bonos / boletas a GES"
      subtitulo="Selecciona producto, cantidad y forma de pago para enviar una solicitud de compra real a GES."
    />
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
      <span className="text-small">{label}</span>
      <span className="tabular" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
