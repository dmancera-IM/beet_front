import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo-beet-ticket.svg';
import Button from '../../components/ui/Button';
import { Field, Input, Checkbox } from '../../components/ui/Field';
import Alert from '../../components/ui/Alert';
import { useAffiliateAuth } from '../../context/AffiliateAuthContext';
import { useToast } from '../../context/ToastContext';

// Activación SOLO por documento (regla de negocio actual): el correo puede
// cambiar, el documento es el dato estable — ver
// beet_backend/app/services/auth_service.py:activar_cuenta_afiliado. El
// backend rechaza con un error claro si el documento no existe o si la
// cuenta ya fue activada antes (no permite "reactivar"/sobreescribir).
//
// `acepta_terminos` has no backend column to receive it — there is no
// legal-acceptance-tracking column on `afiliados` in the real schema — so
// it is enforced here purely as a client-side gate on the submit button
// and is never sent to the API.
export default function PortalRegister() {
  const { registro } = useAffiliateAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [documento, setDocumento] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const nextErrors = {};
    if (!documento.trim()) nextErrors.documento = 'El número de documento es obligatorio.';
    if (password.length < 8) nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (password !== confirm) nextErrors.confirm = 'Las contraseñas no coinciden.';
    if (!aceptaTerminos) nextErrors.terminos = 'Debes aceptar los términos y condiciones para continuar.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await registro(documento.trim(), password, confirm);
      push({ title: 'Cuenta activada', description: 'Ya puedes iniciar sesión con tu nueva contraseña.' });
      navigate('/portal/login');
    } catch (err) {
      // El backend responde con un error claro: documento no encontrado,
      // cuenta ya activada, o documento repetido en más de una entidad.
      setError(err.message || 'No fue posible activar la cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button
          onClick={() => navigate('/portal/login')}
          className="text-small"
          style={{ background: 'none', border: 'none', padding: 0, marginBottom: 16, cursor: 'pointer', color: 'var(--brand-primary)', fontWeight: 600, display: 'block' }}
        >
          ← Volver
        </button>
        <img src={logo} alt="BEET Ticket" height={52} style={{ marginBottom: 28 }} />
        <h1 className="text-h2" style={{ margin: '0 0 6px' }}>Activa tu cuenta</h1>
        <p className="text-small" style={{ margin: '0 0 26px' }}>Tu entidad ya te registró con tu número de documento — solo falta que definas tu contraseña.</p>

        {error && (
          <div style={{ marginBottom: 18 }}>
            <Alert tone="error" title="No se pudo activar la cuenta">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Field label="Número de documento" error={errors.documento}>
            <Input type="text" inputMode="numeric" placeholder="Ej. 52114908" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </Field>
          <Field label="Contraseña" error={errors.password}>
            <Input type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirmar contraseña" error={errors.confirm}>
            <Input type="password" placeholder="Repite tu contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div style={{ margin: '4px 0 20px' }}>
            <Checkbox label="Acepto los términos y condiciones" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} />
            {errors.terminos && <div className="field-error" style={{ marginTop: 8 }}>{errors.terminos}</div>}
          </div>
          <Button type="submit" size="lg" style={{ width: '100%' }} loading={submitting}>
            Activar cuenta
          </Button>
        </form>

        <div className="login-note text-caption">
          ¿Ya tienes cuenta? <Link to="/portal/login" style={{ fontWeight: 600 }}>Inicia sesión</Link>.
        </div>
      </div>
    </div>
  );
}
