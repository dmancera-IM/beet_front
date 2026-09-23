import { useState } from 'react';
import { useSetBreadcrumbs } from '../../components/layout/breadcrumbs';
import { Card } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { formatCOP } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { bolsaDisponible, creditoDisponible, getCooperativa } from './ges/gesData';
import ComprarBonosGes from './ComprarBonosGes';
import B2BForm from './b2b/B2BForm';

// Fusión visual de las dos vistas que antes vivían por separado en el
// sidebar de ADMIN ("GES" y "B2B") — se mantiene el contenido completo de
// ambos formularios de solicitud (ComprarBonosGes y B2BForm) sin quitarles
// nada, debajo del flujo de modalidad de compra.
//
// Bolsa y Crédito son dos operaciones distintas (sección "Aclaración
// importante"), cada una con su propio flujo:
//
//   BOLSA:   un monto que la entidad ya compró y va consumiendo.
//            Muestra Valor de la bolsa / Consumido / Disponible para
//            consumir (`bolsaDisponible()`, nunca restado a mano) y
//            debajo permite comprar un monto adicional libre — sin lista
//            fija de valores predeterminados.
//   CRÉDITO: GES define un cupo máximo autorizado (credito.cupoAutorizado,
//            ver GES → Entidades → detalle) — un LÍMITE, no un saldo ya
//            usado. Muestra Crédito aprobado / Utilizado / Disponible
//            (`creditoDisponible()`) y la cooperativa escribe cuánto
//            crédito quiere solicitar; el frontend valida únicamente
//            monto solicitado <= cupo máximo autorizado, mostrando
//            APROBADO/NO APROBADO. No se inventan intereses, tasas,
//            cuotas ni otras reglas financieras.
//
// Ambas terminan en la MISMA pasarela mock (sección "Pasarela de pago") —
// nunca se crea una diferente para cada modalidad.
export default function BolsaCredito() {
  useSetBreadcrumbs([{ label: 'Bolsa / Crédito' }]);
  const { cooperativaId } = useAuth();
  const cooperativa = getCooperativa(cooperativaId);
  const bolsa = cooperativa?.bolsa ?? { valor: 0, consumido: 0 };
  const credito = cooperativa?.credito ?? { cupoAutorizado: 0, utilizado: 0 };

  const [modalidadSeleccionada, setModalidadSeleccionada] = useState('BOLSA');
  const [montoBolsa, setMontoBolsa] = useState('');
  const [montoCredito, setMontoCredito] = useState('');
  const [enPasarela, setEnPasarela] = useState(false);
  const [pagoConfirmado, setPagoConfirmado] = useState(false);

  const elegirModalidad = (nueva) => {
    setModalidadSeleccionada(nueva);
    setMontoBolsa('');
    setMontoCredito('');
    setEnPasarela(false);
    setPagoConfirmado(false);
  };

  const bolsaDisponibleNum = bolsaDisponible(bolsa);
  const montoBolsaNum = Number(montoBolsa) || 0;
  // Única validación pedida (sección "Validaciones frontend"): monto > 0.
  // No se inventa un máximo porque todavía no existe uno definido.
  const bolsaValida = montoBolsaNum > 0;

  // Flujo de crédito corregido: `credito.cupoAutorizado` es el CUPO MÁXIMO
  // AUTORIZADO por GES (un límite, no un saldo ya usado). La cooperativa
  // escribe cuánto quiere SOLICITAR y la única regla de negocio es
  // monto solicitado <= cupo máximo autorizado. No se inventan intereses,
  // tasas, cuotas ni otras reglas financieras.
  const cupoMaximoAutorizado = credito.cupoAutorizado;
  const creditoDisponibleNum = creditoDisponible(credito);
  const montoCreditoNum = Number(montoCredito) || 0;
  const creditoIngresado = montoCredito !== '' && montoCreditoNum > 0;
  const creditoAprobado = creditoIngresado && montoCreditoNum <= cupoMaximoAutorizado;

  const continuarAlPago = () => setEnPasarela(true);
  const volverAModalidad = () => { setEnPasarela(false); setPagoConfirmado(false); };
  const confirmarPagoMock = () => setPagoConfirmado(true);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Bolsa / Crédito</h1>
          <p className="page-subtitle">Elige cómo tu entidad compra bonos y boletas a GES, y solicita tu compra desde cualquiera de los dos formularios.</p>
        </div>
      </div>

      <Card padding="card-pad-lg" className="section-gap">
        <div className="text-label" style={{ marginBottom: 12 }}>Modalidad de compra</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <ModalidadOpcion
            activo={modalidadSeleccionada === 'BOLSA'}
            titulo="Bolsa"
            descripcion="La cooperativa decide cuánto quiere comprar."
            onClick={() => elegirModalidad('BOLSA')}
          />
          <ModalidadOpcion
            activo={modalidadSeleccionada === 'CREDITO'}
            titulo="Crédito"
            descripcion="Crédito otorgado por GES."
            onClick={() => elegirModalidad('CREDITO')}
          />
        </div>

        {enPasarela ? (
          // Pasarela de pago (mock) — el mismo componente para las dos
          // modalidades, nunca una distinta para cada una.
          <PasarelaPagoMock
            modalidad={modalidadSeleccionada}
            monto={modalidadSeleccionada === 'BOLSA' ? montoBolsaNum : null}
            credito={modalidadSeleccionada === 'CREDITO' ? { cupoMaximoAutorizado, montoSolicitado: montoCreditoNum } : null}
            confirmado={pagoConfirmado}
            onVolver={volverAModalidad}
            onConfirmar={confirmarPagoMock}
          />
        ) : modalidadSeleccionada === 'BOLSA' ? (
          <div style={{ maxWidth: 420 }}>
            <div className="text-label" style={{ marginBottom: 10 }}>Bolsa</div>
            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
              <Row label="Valor de la bolsa" value={formatCOP(bolsa.valor)} />
              <Row label="Consumido" value={formatCOP(bolsa.consumido)} />
              <Row label="Disponible para consumir" value={formatCOP(bolsaDisponibleNum)} />
            </div>

            <div className="text-label" style={{ marginBottom: 10 }}>Comprar bolsa</div>
            <Field label="Monto que deseas comprar">
              <Input
                type="number"
                min="1"
                step="10000"
                placeholder="Ej: 5000000"
                value={montoBolsa}
                onChange={(e) => setMontoBolsa(e.target.value)}
              />
            </Field>
            {bolsa.valor > 0 && (
              <p className="text-caption cell-muted" style={{ marginTop: -8, marginBottom: 16 }}>
                Valor de bolsa comprado como referencia: {formatCOP(bolsa.valor)} — puedes comprar un monto adicional distinto.
              </p>
            )}

            {bolsaValida && (
              <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div className="text-label" style={{ marginBottom: 8 }}>Resumen</div>
                <Row label="Modalidad" value="Bolsa" />
                <Row label="Monto" value={formatCOP(montoBolsaNum)} />
              </div>
            )}

            <Button onClick={continuarAlPago} disabled={!bolsaValida}>Continuar al pago</Button>
          </div>
        ) : (
          <div style={{ maxWidth: 420 }}>
            <div className="text-label" style={{ marginBottom: 10 }}>Crédito</div>
            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
              <Row label="Crédito aprobado" value={formatCOP(credito.cupoAutorizado)} />
              <Row label="Utilizado" value={formatCOP(credito.utilizado)} />
              <Row label="Disponible" value={formatCOP(creditoDisponibleNum)} />
            </div>

            <div className="text-label" style={{ marginBottom: 10 }}>Solicitud de crédito</div>

            <Field label="Monto de crédito a solicitar">
              <Input
                type="number"
                min="1"
                step="10000"
                placeholder="Ej: 8000000"
                value={montoCredito}
                onChange={(e) => setMontoCredito(e.target.value)}
              />
            </Field>
            <p className="text-caption cell-muted" style={{ marginTop: -8, marginBottom: 16 }}>
              Cupo máximo autorizado por GES: {formatCOP(cupoMaximoAutorizado)}
            </p>

            {creditoIngresado && (
              creditoAprobado ? (
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--success)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div className="text-small" style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>✓ Crédito aprobado</div>
                  <Row label="Monto solicitado" value={formatCOP(montoCreditoNum)} />
                  <Row label="Cupo máximo autorizado" value={formatCOP(cupoMaximoAutorizado)} />
                  <Row label="Estado" value="APROBADO" />
                </div>
              ) : (
                <div style={{ background: 'var(--bg-app)', border: '1px solid var(--danger)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div className="text-small" style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>✕ Crédito no aprobado</div>
                  <p className="text-caption cell-muted" style={{ marginBottom: 8 }}>
                    El monto solicitado supera el cupo de crédito autorizado por GES.
                  </p>
                  <Row label="Cupo máximo autorizado" value={formatCOP(cupoMaximoAutorizado)} />
                  <Row label="Monto solicitado" value={formatCOP(montoCreditoNum)} />
                </div>
              )
            )}

            <Button onClick={continuarAlPago} disabled={!creditoAprobado}>Continuar</Button>
          </div>
        )}
      </Card>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card padding="card-pad-lg">
          <ComprarBonosGes />
        </Card>
        <Card padding="card-pad-lg">
          <B2BForm />
        </Card>
      </div>
    </div>
  );
}

// Pasarela mock única, reutilizada por Bolsa y Crédito (sección "Pasarela
// de pago": "no crear una pasarela diferente para Bolsa y otra para
// Crédito") — un solo componente, sin tasas, cuotas ni condiciones
// financieras inventadas (todavía no están definidas).
function PasarelaPagoMock({ modalidad, monto, credito, confirmado, onVolver, onConfirmar }) {
  return (
    <div style={{ maxWidth: 420 }}>
      <div className="text-label" style={{ marginBottom: 10 }}>Pasarela de pago (simulación)</div>
      <Row label="Modalidad" value={modalidad === 'BOLSA' ? 'Bolsa' : 'Crédito'} />
      {modalidad === 'BOLSA' ? (
        <Row label="Monto" value={formatCOP(monto)} />
      ) : (
        <>
          <Row label="Monto solicitado" value={formatCOP(credito.montoSolicitado)} />
          <Row label="Cupo máximo autorizado" value={formatCOP(credito.cupoMaximoAutorizado)} />
        </>
      )}
      <p className="text-caption cell-muted" style={{ margin: '10px 0 16px' }}>
        Todavía no hay una pasarela de pago real conectada — esta pantalla solo representa el paso siguiente del flujo.
      </p>

      {confirmado ? (
        <Alert tone="success" title="Pago procesado (simulación)">
          {modalidad === 'BOLSA'
            ? `Tu bolsa de ${formatCOP(monto)} quedó registrada.`
            : `Tu solicitud de crédito por ${formatCOP(credito.montoSolicitado)} quedó registrada.`}
        </Alert>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" onClick={onVolver}>Volver</Button>
          <Button onClick={onConfirmar}>Pagar ahora</Button>
        </div>
      )}
    </div>
  );
}

function ModalidadOpcion({ activo, titulo, descripcion, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="table-card"
      style={{
        flex: '1 1 220px',
        textAlign: 'left',
        padding: 16,
        cursor: 'pointer',
        border: activo ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
        background: activo ? 'var(--bg-brand-soft)' : 'var(--bg-surface)',
      }}
    >
      <div className="text-small" style={{ fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
      <div className="text-caption cell-muted">{descripcion}</div>
    </button>
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
