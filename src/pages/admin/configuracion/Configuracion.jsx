import { useCallback, useEffect, useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Input, Select } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import FileUploader from '../../../components/ui/FileUploader';
import { ErrorState, LoadingState } from '../../../components/ui/States';
import * as adminService from '../../../services/adminService';
import { getLogo, setLogo, clearLogo, fileToDataUrl } from '../../../services/logoStore';
import { getCuentaPago, setCuentaPago } from '../../../services/paymentAccountStore';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

const PROVEEDORES_PAGO = ['Wompi', 'PayU', 'Mercado Pago'];

// NOTE: unlike an earlier design assumption, the real `cooperativas` table
// only has `nombre`, `nit`, and `estado` — the payment-method toggles and
// the debt-assumption legal text (`tarjeta_habilitada`, `cupo_habilitado`,
// `texto_asuncion_deuda`, `correo_contacto`, `logo_url`) have no backing
// column and are not part of this integration pass (see SCHEMA_NOTES.md).
export default function Configuracion() {
  useSetBreadcrumbs([{ label: 'Configuración' }]);
  const { permissions, cooperativaId } = useAuth();
  const { push } = useToast();

  const [coop, setCoop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logo, setLogoState] = useState(() => getLogo(cooperativaId));
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [cuentaPago, setCuentaPagoState] = useState(null);
  const [editandoPago, setEditandoPago] = useState(false);
  const [formPago, setFormPago] = useState({ proveedor: PROVEEDORES_PAGO[0], ultimosDigitos: '' });
  const [errorPago, setErrorPago] = useState('');

  const readOnly = !permissions.write;

  const cargar = useCallback(() => {
    if (!cooperativaId) return;
    setLoading(true);
    setError(null);
    adminService
      .obtenerCooperativa(cooperativaId)
      .then(setCoop)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [cooperativaId]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!cooperativaId) return;
    getCuentaPago(cooperativaId).then(setCuentaPagoState).catch(() => setCuentaPagoState(null));
  }, [cooperativaId]);

  const guardar = async () => {
    setSaving(true);
    try {
      const actualizado = await adminService.actualizarCooperativa(cooperativaId, { nombre: coop.nombre });
      setCoop(actualizado);
      push({ title: 'Configuración guardada', description: 'Datos de la entidad actualizados.' });
    } catch (err) {
      push({ title: 'No se pudo guardar', description: err.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      push({ title: 'Archivo no válido', description: 'Selecciona una imagen (PNG, JPG o SVG).', variant: 'error' });
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogo(cooperativaId, dataUrl);
      setLogoState(dataUrl);
      push({ title: 'Logo actualizado', description: 'Tus afiliados ya verán este logo junto al de BEET.' });
    } catch {
      push({ title: 'No se pudo cargar el logo', description: 'Intenta con otra imagen.', variant: 'error' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const quitarLogo = () => {
    clearLogo(cooperativaId);
    setLogoState(null);
    push({ title: 'Logo eliminado', description: 'Tus afiliados solo verán el logo de BEET.' });
  };

  const abrirFormularioPago = () => {
    setFormPago({
      proveedor: cuentaPago?.proveedor ?? PROVEEDORES_PAGO[0],
      ultimosDigitos: cuentaPago?.ultimos_digitos ?? cuentaPago?.ultimosDigitos ?? '',
    });
    setErrorPago('');
    setEditandoPago(true);
  };

  const guardarCuentaPago = async () => {
    const digitos = formPago.ultimosDigitos.trim();
    if (!/^\d{4}$/.test(digitos)) {
      setErrorPago('Ingresa exactamente 4 dígitos (dato ficticio, no la tarjeta real).');
      return;
    }
    try {
      const cuenta = await setCuentaPago(cooperativaId, { proveedor: formPago.proveedor, ultimosDigitos: digitos });
      setCuentaPagoState(cuenta);
      setEditandoPago(false);
      push({ title: 'Cuenta de pago guardada', description: 'Tus afiliados podrán pagar con tarjeta usando esta cuenta.' });
    } catch (err) {
      push({ title: 'No se pudo guardar la cuenta', description: err.message, variant: 'error' });
    }
  };

  if (loading) return <LoadingState title="Cargando configuración desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Configuración</h1>
          <p className="page-subtitle">Datos de la entidad registrados en PostgreSQL.</p>
        </div>
      </div>

      <Card padding="card-pad-lg" className="section-gap">
        <div style={{ maxWidth: 560 }}>
          <Field label="Nombre de la entidad">
            <Input value={coop.nombre} disabled={readOnly} onChange={(e) => setCoop((v) => ({ ...v, nombre: e.target.value }))} />
          </Field>
          <Field label="NIT" hint="El NIT se configura una sola vez y no se puede editar desde aquí.">
            <Input value={coop.nit} disabled />
          </Field>
          {!readOnly && (
            <Button loading={saving} onClick={guardar}>Guardar cambios</Button>
          )}
        </div>
      </Card>

      {cooperativaId && (
      <Card padding="card-pad-lg">
        <div className="text-label" style={{ marginBottom: 4 }}>Personalización</div>
        <p className="text-caption cell-muted" style={{ marginTop: 0, marginBottom: 16 }}>
          El logo de tu entidad aparece junto al logo de BEET en el portal de tus afiliados. Si no cargas uno, tus afiliados solo verán el logo de BEET.
        </p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="text-caption" style={{ marginBottom: 8 }}>Logo actual</div>
            <div style={{ width: 120, height: 60, border: '1px solid var(--border-default)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', overflow: 'hidden' }}>
              {logo ? (
                <img src={logo} alt="Logo de la entidad" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span className="text-caption cell-muted">Sin logo</span>
              )}
            </div>
          </div>
          {!readOnly && (
            <div style={{ flex: 1, minWidth: 240 }}>
              <FileUploader hint="PNG, JPG o SVG · máx. 2 MB" accept="image/*" onFile={handleLogoFile} />
              {uploadingLogo && <div className="text-caption" style={{ marginTop: 8 }}>Cargando…</div>}
              {logo && (
                <Button variant="ghost" size="sm" onClick={quitarLogo} style={{ marginTop: 8 }}>Quitar logo</Button>
              )}
            </div>
          )}
        </div>
      </Card>
      )}

      {cooperativaId && (
      <Card padding="card-pad-lg" className="section-gap">
        <div className="text-label" style={{ marginBottom: 4 }}>Cuenta de pago</div>
        <p className="text-caption cell-muted" style={{ marginTop: 0, marginBottom: 16 }}>
          Cuenta que usarán los afiliados de tu entidad cuando paguen con tarjeta. Es la cuenta de la entidad, no la de cada afiliado.
        </p>

        {!editandoPago && (
          <>
            {cuentaPago ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className="text-caption" style={{ marginBottom: 4 }}>Proveedor</div>
                  <div className="text-body">{cuentaPago.proveedor}</div>
                </div>
                <div>
                  <div className="text-caption" style={{ marginBottom: 4 }}>Cuenta asociada</div>
                  <div className="text-body" style={{ letterSpacing: 2 }}>•••• •••• •••• {cuentaPago.ultimos_digitos ?? cuentaPago.ultimosDigitos}</div>
                </div>
                <div>
                  <div className="text-caption" style={{ marginBottom: 4 }}>Estado</div>
                  <Badge tone="green" dot>Configurada</Badge>
                </div>
                {!readOnly && (
                  <Button variant="secondary" size="sm" onClick={abrirFormularioPago}>Editar configuración</Button>
                )}
              </div>
            ) : (
              <div>
                <p className="text-body cell-muted" style={{ marginTop: 0 }}>No has configurado una cuenta de pago.</p>
                {!readOnly && <Button size="sm" onClick={abrirFormularioPago}>Configurar cuenta</Button>}
              </div>
            )}
          </>
        )}

        {editandoPago && (
          <div style={{ maxWidth: 420 }}>
            <Field label="Proveedor">
              <Select
                value={formPago.proveedor}
                onChange={(e) => setFormPago((v) => ({ ...v, proveedor: e.target.value }))}
              >
                {PROVEEDORES_PAGO.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field
              label="Últimos 4 dígitos de la cuenta"
              hint="Dato ficticio/enmascarado para pruebas — nunca ingreses un número de tarjeta real."
              error={errorPago}
            >
              <Input
                maxLength={4}
                inputMode="numeric"
                placeholder="4582"
                value={formPago.ultimosDigitos}
                onChange={(e) => setFormPago((v) => ({ ...v, ultimosDigitos: e.target.value.replace(/\D/g, '') }))}
              />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={guardarCuentaPago}>Guardar</Button>
              <Button variant="ghost" onClick={() => setEditandoPago(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Card>
      )}
    </div>
  );
}
