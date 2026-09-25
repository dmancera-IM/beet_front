import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Stepper from '../../components/ui/Stepper';
import { Card } from '../../components/ui/Card';
import Button, { IconButton } from '../../components/ui/Button';
import { Radio, Select } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';
import { LoadingState, EmptyState, ErrorState } from '../../components/ui/States';
import * as convenioService from '../../services/convenioService';
import * as transaccionesService from '../../services/transaccionesService';
import { useMiCupo } from '../../hooks/useMiCupo';
import { formatCOP, cuotasLabel } from '../../utils/format';

const CUOTAS_OPCIONES = [1, 3, 6, 12];

// ADAPTADO AL BACKEND REAL (POST /transacciones/comprar): solo acepta
// {id_producto, cantidad, metodo_pago, numero_cuotas} — no hay
// `numero_tarjeta` ni `firma_base64` (no hay pasarela de pago real ni
// concepto de "documento de asunción de deuda" en las 13 tablas de este
// alcance), así que se retiraron el paso de firma y el número de tarjeta:
// para TARJETA/PSE, el backend crea la transacción COMPLETADA de inmediato
// sin validar nada externo — ver limitación documentada en
// beet_backend/app/services/transacciones_service.py.
export default function PurchaseFlow() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cupo, loading: cupoLoading, refrescar: refrescarCupo } = useMiCupo();

  const [convenio, setConvenio] = useState(undefined);
  const [loadError, setLoadError] = useState(null);

  const [step, setStep] = useState('cantidad');
  const [cantidad, setCantidad] = useState(1);
  const [metodoPago, setMetodoPago] = useState('TARJETA');
  const [cuotas, setCuotas] = useState(3);
  const [resultado, setResultado] = useState(null);
  const [compraError, setCompraError] = useState('');

  useEffect(() => {
    convenioService
      .obtenerCatalogoAfiliado()
      .then((data) => setConvenio(data.find((c) => c.id === Number(id)) ?? null))
      .catch((err) => setLoadError(err.message));
  }, [id]);

  // PENDIENTE: el backend real no expone un endpoint para que el propio
  // afiliado consulte SU cupo (solo GET /afiliados/{id}/cupo con audiencia
  // admin) — `cupo` siempre llega null aquí. No se puede mostrar el saldo
  // disponible antes de comprar; el backend sigue validando el saldo real
  // al confirmar, y cualquier insuficiencia se muestra como el error real
  // que devuelva (no un chequeo adivinado en el cliente).
  const cupoDisponible = cupo ? cupo.cupo_disponible : null;
  // No hay endpoint de stock para el afiliado — la validación real de
  // inventario ocurre server-side, de forma atómica, al momento de comprar.
  const maxUnidades = convenio ? 10 : 0;
  const total = convenio ? convenio.precio * cantidad : 0;
  const cupoInsuficiente = metodoPago === 'CUPO' && cupoDisponible != null && total > cupoDisponible;

  const steps = useMemo(() => [
    { key: 'cantidad', label: 'Cantidad' },
    { key: 'pago', label: 'Pago' },
    { key: 'resumen', label: 'Checkout' },
    { key: 'resultado', label: 'Ticket' },
  ], []);

  if (loadError) return <ErrorState description={loadError} onRetry={() => window.location.reload()} />;
  if (convenio === undefined || cupoLoading) return <LoadingState title="Cargando…" />;
  if (!convenio) {
    return <EmptyState title="Beneficio no encontrado" actionLabel="Volver al catálogo" onAction={() => navigate('/portal/catalogo')} />;
  }

  const confirmarCompra = async () => {
    setCompraError('');
    setStep('confirmando');
    try {
      const trx = await transaccionesService.comprar({
        producto_id: convenio.id,
        cantidad,
        metodo_pago: metodoPago,
        numero_cuotas: metodoPago === 'CUPO' ? cuotas : undefined,
      });
      setResultado(trx);
      setStep('resultado');
      if (metodoPago === 'CUPO') refrescarCupo();
    } catch (err) {
      setCompraError(err.message || 'No fue posible completar la compra.');
      setStep('resumen');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <h1 className="text-h2" style={{ margin: '2px 0 18px' }}>{convenio.nombre}</h1>
      </div>

      {step !== 'confirmando' && step !== 'resultado' && <Stepper steps={steps} currentKey={step} />}

      {step === 'cantidad' && (
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 14 }}>¿Cuántas unidades quieres comprar?</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <IconButton label="Menos" onClick={() => setCantidad((c) => Math.max(1, c - 1))} icon={<span style={{ fontSize: 18, lineHeight: 1 }}>−</span>} />
            <span className="text-display tabular" style={{ minWidth: 48, textAlign: 'center' }}>{cantidad}</span>
            <IconButton label="Más" onClick={() => setCantidad((c) => Math.min(maxUnidades, c + 1))} icon={<span style={{ fontSize: 18, lineHeight: 1 }}>+</span>} />
            <span className="text-caption">máximo {maxUnidades} por esta compra</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0', paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
            <span className="text-small">Precio unitario</span>
            <span className="tabular" style={{ fontWeight: 500 }}>{formatCOP(convenio.precio)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <span style={{ fontWeight: 600 }}>Subtotal</span>
            <span className="tabular" style={{ fontWeight: 600, fontSize: 18 }}>{formatCOP(total)}</span>
          </div>
          <Button style={{ width: '100%' }} onClick={() => setStep('pago')}>Continuar</Button>
        </Card>
      )}

      {step === 'pago' && (
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 14 }}>Forma de pago</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <Radio name="pago" label="Tarjeta débito o crédito" checked={metodoPago === 'TARJETA'} onChange={() => setMetodoPago('TARJETA')} />
            <Radio name="pago" label="Cupo de crédito de la entidad" checked={metodoPago === 'CUPO'} onChange={() => setMetodoPago('CUPO')} />
          </div>

          {metodoPago === 'TARJETA' && (
            <Alert tone="info" title="Sin pasarela de pago real en esta integración">
              El backend actual registra la compra como completada de inmediato — no valida datos de tarjeta ni conecta con una pasarela real todavía.
            </Alert>
          )}

          {metodoPago === 'CUPO' && (
            <div style={{ marginBottom: 20 }}>
              <Alert tone="info" title="No podemos mostrar tu saldo de cupo aquí">
                El backend actual no tiene un endpoint para que consultes tu propio cupo — si no te alcanza, el error real
                aparecerá al confirmar la compra.
              </Alert>

              <label className="field-label" style={{ display: 'block', margin: '16px 0 6px' }}>Número de cuotas</label>
              <Select value={cuotas} onChange={(e) => setCuotas(Number(e.target.value))} style={{ marginBottom: 12 }}>
                {CUOTAS_OPCIONES.map((n) => <option key={n} value={n}>{cuotasLabel(n)}</option>)}
              </Select>

              {cupoInsuficiente && (
                <Alert tone="error" title="Saldo de cupo insuficiente">
                  El saldo disponible ({formatCOP(cupoDisponible)}) es menor al valor de la compra ({formatCOP(total)}). Elige otra forma de pago o reduce la cantidad.
                </Alert>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={() => setStep('cantidad')}>Atrás</Button>
            <Button style={{ flex: 1 }} disabled={cupoInsuficiente} onClick={() => setStep('resumen')}>Continuar</Button>
          </div>
        </Card>
      )}

      {step === 'resumen' && (
        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 14 }}>Resumen de tu compra</div>
          {compraError && (
            <div style={{ marginBottom: 16 }}>
              <Alert tone="error" title="No fue posible completar la compra">{compraError}</Alert>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <Row label="Beneficio" value={convenio.nombre} />
            <Row label="Cantidad" value={`${cantidad} unidad${cantidad > 1 ? 'es' : ''}`} />
            <Row label="Precio unitario" value={formatCOP(convenio.precio)} />
            <Row label="Forma de pago" value={metodoPago === 'TARJETA' ? 'Tarjeta débito/crédito' : `Cupo de la entidad · ${cuotasLabel(cuotas)}`} />
            {metodoPago === 'CUPO' && cupoDisponible != null && <Row label="Cupo disponible después de esta compra" value={formatCOP(cupoDisponible - total)} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
              <span style={{ fontWeight: 600 }}>Total a pagar</span>
              <span className="tabular" style={{ fontWeight: 600, fontSize: 20 }}>{formatCOP(total)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={() => setStep('pago')}>Atrás</Button>
            <Button style={{ flex: 1 }} onClick={confirmarCompra}>Confirmar compra</Button>
          </div>
        </Card>
      )}

      {step === 'confirmando' && (
        <LoadingState title="Procesando tu compra" description="No cierres esta ventana. Estamos asignando tu código." />
      )}

      {step === 'resultado' && resultado && (
        <div>
          <Alert tone="success" title="Compra completada">
            Tu {convenio.nombre} quedó registrada y disponible en Mis tickets.
          </Alert>
          <Card padding="card-pad-lg" style={{ marginTop: 18 }}>
            <div className="text-label" style={{ marginBottom: 10 }}>Códigos asignados</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resultado.tickets.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 12px' }}>
                  <span className="text-mono" style={{ flex: 1 }}>{t.codigo}</span>
                </div>
              ))}
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <Button variant="secondary" onClick={() => navigate('/portal/catalogo')}>Seguir explorando</Button>
            <Button style={{ flex: 1 }} onClick={() => navigate('/portal/tickets')}>Ver mis tickets</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span className="text-small">{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
