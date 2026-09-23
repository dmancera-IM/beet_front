import { useMemo, useState } from 'react';
import { useSetBreadcrumbs } from '../../components/layout/breadcrumbs';
import { Card } from '../../components/ui/Card';
import { Field, Input, Select } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCOP } from '../../utils/format';
import {
  PROVEEDORES,
  bolsaDisponible,
  creditoDisponible,
  crearSolicitudDesdeCooperativa,
  getCooperativa,
  getProducto,
  getProductos,
  registrarConsumoBolsa,
  registrarConsumoCupo,
} from './ges/gesData';

const FORMA_PAGO_LABEL = { BOLSA: 'Bolsa', CREDITO: 'Crédito' };

// Vista GES DENTRO del panel del administrador de cooperativa — NO es el
// panel completo de GES (eso vive en /ges, solo para GES y Súper admin).
//
// Flujo (ronda "Forma de pago por producto"): la forma de pago (Bolsa o
// Crédito) se elige DENTRO del formulario de compra, junto con convenio/
// producto/cantidad — nunca después, en el carrito. Una vez agregado un
// producto al carrito, su forma de pago queda fija: el carrito es
// puramente informativo (qué se compra, cuánto, a qué precio, con qué se
// financia y el total) y no tiene forma de agregar productos ni de
// cambiar su financiación — solo "Confirmar compra".
//
// El mismo producto con la MISMA forma de pago acumula cantidad en una
// sola línea; el mismo producto con OTRA forma de pago queda en una línea
// aparte, porque representan consumos de saldos distintos (Bolsa/Crédito
// nunca se mezclan, ver gesData.js).
//
// El carrito vive solo en memoria de este componente. Al confirmar, cada
// línea se registra con `crearSolicitudDesdeCooperativa` (misma función
// que ya usa B2BForm) y el total de las líneas en Bolsa se descuenta de
// `bolsa.consumido`, el de las líneas en Crédito de `credito.utilizado`
// (`registrarConsumoBolsa`/`registrarConsumoCupo`) — cada saldo se mueve
// de forma independiente según lo que realmente se financió con cada uno.
//
// Solo se muestran convenios ACTIVOS del catálogo maestro de GES y
// productos activos con precio ya configurado por GES
// (`precioVentaEntidad`, el precio que GES le cobra a la entidad — nunca
// el precio al afiliado).
export default function ComprarBonosGes() {
  useSetBreadcrumbs([{ label: 'GES' }]);
  const { currentUser, cooperativaId, nombreEntidad } = useAuth();
  const { push } = useToast();

  const [version, setVersion] = useState(0);
  const cooperativa = useMemo(() => getCooperativa(cooperativaId), [cooperativaId, version]);
  const bolsa = cooperativa?.bolsa ?? { valor: 0, consumido: 0 };
  const credito = cooperativa?.credito ?? { cupoAutorizado: 0, utilizado: 0 };
  const bolsaDisponibleNum = bolsaDisponible(bolsa);
  const creditoDisponibleNum = creditoDisponible(credito);

  const conveniosActivos = useMemo(() => PROVEEDORES.filter((p) => p.estado), []);
  const productosDeConvenio = (proveedorId) => getProductos(proveedorId).filter((p) => p.estado && p.precioVentaEntidad != null);

  const [proveedorId, setProveedorId] = useState(conveniosActivos[0]?.id ?? '');
  const [productoId, setProductoId] = useState(productosDeConvenio(conveniosActivos[0]?.id ?? '')[0]?.id ?? '');
  const [cantidad, setCantidad] = useState('');
  const [formaPago, setFormaPago] = useState('');
  const [errorSeleccion, setErrorSeleccion] = useState('');

  const [carrito, setCarrito] = useState([]); // { convenioId, productoId, cantidad, precioUnitario, formaPago }
  const [confirmando, setConfirmando] = useState(false);
  const [compraConfirmada, setCompraConfirmada] = useState(null);

  const productosDelConvenio = productosDeConvenio(proveedorId);

  const handleProveedorChange = (id) => {
    setProveedorId(id);
    setProductoId(productosDeConvenio(id)[0]?.id ?? '');
    setErrorSeleccion('');
  };

  const totalEnCarritoPorFormaPago = (fp) =>
    carrito.filter((item) => item.formaPago === fp).reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);

  const puedeAgregar = proveedorId && productoId && Number(cantidad) > 0 && formaPago !== '';

  const agregarAlCarrito = () => {
    const n = Number(cantidad);
    if (!proveedorId) { setErrorSeleccion('Selecciona un convenio.'); return; }
    if (!productoId) { setErrorSeleccion('Selecciona un producto.'); return; }
    if (!cantidad || n <= 0) { setErrorSeleccion('La cantidad debe ser mayor a 0.'); return; }
    if (formaPago === '') { setErrorSeleccion('Selecciona una forma de pago.'); return; }

    const producto = productosDelConvenio.find((p) => p.id === Number(productoId));
    if (!producto) { setErrorSeleccion('Selecciona un producto válido.'); return; }

    const subtotal = producto.precioVentaEntidad * n;
    const yaEnCarrito = totalEnCarritoPorFormaPago(formaPago);
    const disponible = formaPago === 'BOLSA' ? bolsaDisponibleNum : creditoDisponibleNum;
    if (yaEnCarrito + subtotal > disponible) {
      setErrorSeleccion(formaPago === 'BOLSA' ? 'Saldo insuficiente en la Bolsa.' : 'Crédito insuficiente para realizar esta compra.');
      return;
    }

    setCarrito((prev) => {
      // Mismo producto y MISMA forma de pago ya en el carrito → acumular
      // cantidad. Mismo producto con OTRA forma de pago → línea aparte.
      const idx = prev.findIndex((item) => item.productoId === producto.id && item.formaPago === formaPago);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + n };
        return copia;
      }
      return [...prev, { convenioId: proveedorId, productoId: producto.id, cantidad: n, precioUnitario: producto.precioVentaEntidad, formaPago }];
    });
    push({ title: 'Producto agregado al carrito', description: `${n.toLocaleString('es-CO')} × ${producto.nombre} · ${FORMA_PAGO_LABEL[formaPago]}` });

    // El formulario queda disponible para agregar otro producto — se
    // limpian cantidad y forma de pago, nunca convenio/producto (así el
    // administrador puede seguir agregando del mismo convenio si quiere).
    setCantidad('');
    setFormaPago('');
    setErrorSeleccion('');
    setCompraConfirmada(null);
  };

  const carritoPorConvenio = useMemo(() => {
    const grupos = new Map();
    for (const item of carrito) {
      const producto = getProducto(item.productoId);
      const convenio = PROVEEDORES.find((p) => p.id === item.convenioId);
      if (!grupos.has(item.convenioId)) {
        grupos.set(item.convenioId, { convenioNombre: convenio?.nombre ?? String(item.convenioId), items: [] });
      }
      grupos.get(item.convenioId).items.push({
        ...item,
        productoNombre: producto?.nombre ?? String(item.productoId),
        subtotal: item.precioUnitario * item.cantidad,
      });
    }
    return [...grupos.values()];
  }, [carrito]);

  const total = carrito.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  const totalBolsa = totalEnCarritoPorFormaPago('BOLSA');
  const totalCredito = totalEnCarritoPorFormaPago('CREDITO');
  const cantidadLineas = carrito.length;

  // Antes de confirmar se vuelve a validar cada saldo por separado —
  // nunca se mezclan (sección 17/19): lo financiado con Bolsa contra
  // bolsa.disponible, lo financiado con Crédito contra credito.disponible.
  const bolsaAlcanza = totalBolsa <= bolsaDisponibleNum;
  const creditoAlcanza = totalCredito <= creditoDisponibleNum;
  const puedeConfirmar = cantidadLineas > 0 && bolsaAlcanza && creditoAlcanza;

  const confirmarCompra = () => {
    if (!puedeConfirmar) return;
    setConfirmando(true);
    try {
      carrito.forEach((item) => {
        crearSolicitudDesdeCooperativa({
          cooperativaId,
          productoId: item.productoId,
          cantidad: item.cantidad,
          administrador: currentUser?.nombre,
          formaPago: FORMA_PAGO_LABEL[item.formaPago],
        });
      });
      if (totalBolsa > 0) registrarConsumoBolsa(cooperativaId, totalBolsa);
      if (totalCredito > 0) registrarConsumoCupo(cooperativaId, totalCredito);

      setCompraConfirmada({ total, totalBolsa, totalCredito, lineas: cantidadLineas });
      push({ title: 'Compra confirmada', description: `${formatCOP(total)} en ${cantidadLineas} ${cantidadLineas === 1 ? 'línea' : 'líneas'}.` });
      setCarrito([]);
      setErrorSeleccion('');
      setVersion((v) => v + 1);
    } catch (err) {
      push({ title: 'No se pudo confirmar la compra', description: err.message, variant: 'error' });
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Comprar bonos / boletas a GES</h1>
          <p className="page-subtitle">Selecciona convenio, producto, cantidad y forma de pago, y agrégalo al carrito.</p>
        </div>
        {cantidadLineas > 0 && <Badge tone="blue">🛒 Carrito ({cantidadLineas})</Badge>}
      </div>

      {compraConfirmada && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="success" title="Compra confirmada">
            {formatCOP(compraConfirmada.total)} en {compraConfirmada.lineas} {compraConfirmada.lineas === 1 ? 'línea' : 'líneas'}
            {compraConfirmada.totalBolsa > 0 ? ` · Bolsa: ${formatCOP(compraConfirmada.totalBolsa)}` : ''}
            {compraConfirmada.totalCredito > 0 ? ` · Crédito: ${formatCOP(compraConfirmada.totalCredito)}` : ''}.
          </Alert>
        </div>
      )}

      <Card padding="card-pad-lg" className="section-gap" style={{ maxWidth: 480 }}>
        <div className="text-label" style={{ marginBottom: 10 }}>Comprar bonos y boletas</div>
        <Field label="Convenio">
          <Select value={proveedorId} onChange={(e) => handleProveedorChange(e.target.value)}>
            {conveniosActivos.length === 0 ? (
              <option value="">Sin convenios activos</option>
            ) : (
              conveniosActivos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))
            )}
          </Select>
        </Field>
        <Field label="Producto">
          <Select value={productoId} onChange={(e) => { setProductoId(e.target.value); setErrorSeleccion(''); }} disabled={productosDelConvenio.length === 0}>
            {productosDelConvenio.length === 0 ? (
              <option value="">Sin productos disponibles para este convenio</option>
            ) : (
              productosDelConvenio.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} · {formatCOP(p.precioVentaEntidad)}</option>
              ))
            )}
          </Select>
        </Field>
        <Field label="Cantidad">
          <Input type="number" min="1" value={cantidad} onChange={(e) => { setCantidad(e.target.value); setErrorSeleccion(''); }} placeholder="100" />
        </Field>
        <Field label="Forma de pago" error={errorSeleccion} hint={`Bolsa disponible: ${formatCOP(bolsaDisponibleNum)} · Crédito disponible: ${formatCOP(creditoDisponibleNum)}`}>
          <Select value={formaPago} onChange={(e) => { setFormaPago(e.target.value); setErrorSeleccion(''); }}>
            <option value="">Selecciona una forma de pago…</option>
            <option value="BOLSA">Bolsa</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </Field>
        <Button onClick={agregarAlCarrito} disabled={!puedeAgregar}>Agregar al carrito</Button>
      </Card>

      <Card padding="card-pad-lg">
        <div className="text-label" style={{ marginBottom: 14 }}>Carrito</div>
        {carritoPorConvenio.length === 0 ? (
          <p className="text-small cell-muted">Tu carrito está vacío.</p>
        ) : (
          carritoPorConvenio.map((grupo, i) => (
            <div key={grupo.convenioNombre} style={{ marginBottom: i < carritoPorConvenio.length - 1 ? 18 : 0 }}>
              <div className="text-small" style={{ fontWeight: 700, marginBottom: 8 }}>{grupo.convenioNombre}</div>
              {grupo.items.map((item) => (
                <div
                  key={`${item.productoId}-${item.formaPago}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border-default)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="text-small" style={{ fontWeight: 600 }}>{item.productoNombre} × {item.cantidad}</div>
                    <div className="text-caption cell-muted">Precio unitario: {formatCOP(item.precioUnitario)}</div>
                  </div>
                  <Badge tone={item.formaPago === 'BOLSA' ? 'green' : 'blue'}>{FORMA_PAGO_LABEL[item.formaPago]}</Badge>
                  <div className="tabular" style={{ fontWeight: 600, minWidth: 100, textAlign: 'right' }}>{formatCOP(item.subtotal)}</div>
                </div>
              ))}
            </div>
          ))
        )}

        {cantidadLineas > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-default)' }}>
            {totalBolsa > 0 && <Row label="Financiado con Bolsa" value={formatCOP(totalBolsa)} />}
            {totalCredito > 0 && <Row label="Financiado con Crédito" value={formatCOP(totalCredito)} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span className="text-label" style={{ marginBottom: 0 }}>TOTAL</span>
              <span className="tabular" style={{ fontWeight: 700, fontSize: 18 }}>{formatCOP(total)}</span>
            </div>
          </div>
        )}

        {!bolsaAlcanza && totalBolsa > 0 && (
          <div style={{ marginTop: 16 }}><Alert tone="error">Saldo insuficiente en la Bolsa.</Alert></div>
        )}
        {!creditoAlcanza && totalCredito > 0 && (
          <div style={{ marginTop: 16 }}><Alert tone="error">Crédito insuficiente para realizar esta compra.</Alert></div>
        )}

        <div style={{ marginTop: 16 }}>
          <Button onClick={confirmarCompra} disabled={!puedeConfirmar} loading={confirmando}>Confirmar compra</Button>
        </div>
      </Card>

      <p className="text-caption cell-muted" style={{ marginTop: 20 }}>
        El proceso comercial (pasarela de pago real, intereses, cuotas) todavía no está definido — esta compra es solo una
        simulación visual del flujo cooperativa → GES.
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
