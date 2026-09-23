import { useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Input, Select } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import * as convenioService from '../../../services/convenioService';
import { formatCOP } from '../../../utils/format';
import {
  PROVEEDORES,
  bolsaDisponible,
  creditoDisponible,
  crearSolicitudDesdeCooperativa,
  getCooperativa,
  registrarConsumoBolsa,
  registrarConsumoCupo,
} from '../ges/gesData';

const FORMA_PAGO_LABEL = { BOLSA: 'Bolsa', CREDITO: 'Crédito' };

// Número de soporte todavía no está definido en la configuración actual —
// placeholder claramente identificado para reemplazarlo por el real más
// adelante (sección 8 de la ronda de ajustes: "no inventar un número
// definitivo, usar una constante/mock claramente identificada").
const WHATSAPP_SOPORTE_MOCK = '573000000000'; // TODO: reemplazar por el número real de soporte de BEET

// Formulario de compra rápida/prioritaria de una entidad a GES (sección 7).
// Visualmente similar al formulario de Configuración (misma Card + Field),
// reutilizando los mismos componentes. Valida el cupo/saldo que la entidad
// tiene contratado con GES (el mismo que ya se ve en Cooperativas/
// CooperativaDetail y en el panorama de Súper admin) antes de dejar
// continuar con la operación.
export default function B2BForm() {
  useSetBreadcrumbs([{ label: 'B2B' }]);
  const { currentUser, cooperativaId, nombreEntidad } = useAuth();
  const { push } = useToast();

  const [proveedorId, setProveedorId] = useState(PROVEEDORES[0]?.id ?? '');
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cargandoProducto, setCargandoProducto] = useState(false);
  const [cantidad, setCantidad] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ultimaSolicitud, setUltimaSolicitud] = useState(null);

  const cooperativa = getCooperativa(cooperativaId);
  const bolsaDisponibleNum = bolsaDisponible(cooperativa?.bolsa);
  const creditoDisponibleNum = creditoDisponible(cooperativa?.credito);
  const cupoDisponible = formaPago === 'BOLSA' ? bolsaDisponibleNum : creditoDisponibleNum;

  useEffect(() => {
    if (!proveedorId) return;
    convenioService
      .listarProductosCooperativa(proveedorId)
      .then((prods) => {
        const configurados = prods.filter((p) => p.configurado && p.estado);
        setProductos(configurados);
        setProductoId(String(configurados[0]?.id_producto ?? ''));
      })
      .catch(() => setProductos([]));
  }, [proveedorId]);

  useEffect(() => {
    if (!productoId) { setProductoSeleccionado(null); return; }
    setCargandoProducto(true);
    convenioService
      .obtenerConfiguracionProducto(productoId)
      .then(setProductoSeleccionado)
      .catch(() => setProductoSeleccionado(null))
      .finally(() => setCargandoProducto(false));
  }, [productoId]);

  const valorCompra = productoSeleccionado?.precio_beet && cantidad ? productoSeleccionado.precio_beet * Number(cantidad) : 0;
  const hayDatosSuficientes = productoSeleccionado && Number(cantidad) > 0 && formaPago !== '';
  const cupoAlcanza = hayDatosSuficientes && valorCompra <= cupoDisponible;
  const cupoInsuficiente = hayDatosSuficientes && valorCompra > cupoDisponible;

  const mensajeWhatsapp = encodeURIComponent(
    `Hola, soy administrador de ${nombreEntidad}. Necesito ayuda con una compra B2B de ${cantidad || '—'} unidades de ${productoSeleccionado?.nombre ?? 'un producto'} (valor ${formatCOP(valorCompra)}). Mi ${formaPago === 'BOLSA' ? 'saldo de bolsa' : 'crédito'} disponible actual es ${formatCOP(cupoDisponible)}.`
  );

  const confirmarCompra = () => {
    setEnviando(true);
    try {
      const solicitud = crearSolicitudDesdeCooperativa({
        cooperativaId,
        productoId,
        cantidad: Number(cantidad),
        administrador: currentUser.nombre,
        formaPago: FORMA_PAGO_LABEL[formaPago],
        prioridad: 'Alta',
      });
      if (formaPago === 'BOLSA') registrarConsumoBolsa(cooperativaId, valorCompra);
      else registrarConsumoCupo(cooperativaId, valorCompra);
      setUltimaSolicitud(solicitud);
      setCantidad('');
      setFormaPago('');
      push({ title: 'Compra B2B procesada', description: `${solicitud.cantidad.toLocaleString('es-CO')} unidades · ${formatCOP(valorCompra)}` });
    } catch (err) {
      push({ title: 'No se pudo procesar la compra', description: err.message, variant: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">B2B — Compra rápida y prioritaria</h1>
          <p className="page-subtitle">Solicita a GES una compra prioritaria de bonos/boletas para {nombreEntidad}.</p>
        </div>
      </div>

      <Card padding="card-pad-lg" style={{ maxWidth: 520 }}>
        <div style={{ maxWidth: 560 }}>
          <Field label="Convenio">
            <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              {PROVEEDORES.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Select>
          </Field>
          <Field label="Producto" hint={productos.length === 0 ? 'Este convenio no tiene productos configurados con precio todavía.' : undefined}>
            <Select value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={productos.length === 0}>
              {productos.length === 0 ? (
                <option value="">Sin productos disponibles</option>
              ) : (
                productos.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>
                ))
              )}
            </Select>
          </Field>
          <Field label="Cantidad">
            <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="10" />
          </Field>
          <Field label="Forma de pago" hint={`Bolsa disponible: ${formatCOP(bolsaDisponibleNum)} · Crédito disponible: ${formatCOP(creditoDisponibleNum)}`}>
            <Select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
              <option value="">Selecciona una forma de pago…</option>
              <option value="BOLSA">Bolsa</option>
              <option value="CREDITO">Crédito</option>
            </Select>
          </Field>

          {hayDatosSuficientes && !cargandoProducto && (
            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <Row label={formaPago === 'BOLSA' ? 'Bolsa disponible' : 'Crédito disponible'} value={formatCOP(cupoDisponible)} />
              <Row label="Cantidad" value={`${Number(cantidad).toLocaleString('es-CO')} boletas`} />
              <Row label="Valor de la compra" value={formatCOP(valorCompra)} />
            </div>
          )}

          {cupoAlcanza && (
            <Alert tone="success" title="Compra disponible para procesamiento rápido">
              Tu {formaPago === 'BOLSA' ? 'bolsa alcanza' : 'crédito alcanza'} para esta compra. Puedes continuar de inmediato.
            </Alert>
          )}
          {cupoInsuficiente && (
            <Alert tone="error" title={formaPago === 'BOLSA' ? 'Saldo insuficiente en la Bolsa' : 'Crédito insuficiente para esta compra'}>
              Tu {formaPago === 'BOLSA' ? 'saldo de bolsa' : 'crédito'} disponible ({formatCOP(cupoDisponible)}) no alcanza para el valor de esta compra ({formatCOP(valorCompra)}).
            </Alert>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {cupoInsuficiente ? (
              <Button
                variant="secondary"
                onClick={() => window.open(`https://wa.me/${WHATSAPP_SOPORTE_MOCK}?text=${mensajeWhatsapp}`, '_blank', 'noopener,noreferrer')}
              >
                Resolver por WhatsApp
              </Button>
            ) : (
              <Button onClick={confirmarCompra} loading={enviando} disabled={!cupoAlcanza}>Continuar con la compra</Button>
            )}
          </div>
        </div>
      </Card>

      {ultimaSolicitud && (
        <Alert tone="success" title="Solicitud B2B registrada">
          {ultimaSolicitud.estado === 'Completada'
            ? 'GES ya asignó el inventario a tu entidad.'
            : 'Tu solicitud quedó en estado Pendiente — GES la completará en cuanto tenga inventario disponible.'}
        </Alert>
      )}

      <p className="text-caption cell-muted" style={{ marginTop: 20 }}>
        El proceso comercial (crédito, bolsa, pasarela de pago) todavía no está definido — esta compra es solo una simulación visual del flujo B2B entidad → GES.
      </p>
    </div>
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
