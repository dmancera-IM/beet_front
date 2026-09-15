import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo-beet-ticket.svg';
import { Card } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { useAffiliateAuth } from '../context/AffiliateAuthContext';

// SOLO PARA ESTA COPIA DE DEMOSTRACIÓN SIN BACKEND — representa la
// condición de estado de cuenta de la sección 3: un afiliado con cuenta
// activa entra directo al portal; uno sin activar va al formulario
// existente de activación (PortalRegister.jsx, sin tocar). En el backend
// real esto lo resuelve el propio login del afiliado, no una elección
// manual como esta.
export default function EntrarAfiliado() {
  const navigate = useNavigate();
  const { login } = useAffiliateAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const entrarActivo = async () => {
    setError('');
    setLoading(true);
    try {
      await login('juan.perez@correo.com', 'demo');
      navigate('/portal');
    } catch (err) {
      setError(err.message || 'No se pudo entrar con el afiliado demo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 460 }}>
        <button
          onClick={() => navigate('/')}
          className="text-small"
          style={{ background: 'none', border: 'none', padding: 0, marginBottom: 16, cursor: 'pointer', color: 'var(--brand-primary)', fontWeight: 600, display: 'block' }}
        >
          ← Volver
        </button>
        <img src={logo} alt="BEET Ticket" height={64} style={{ marginBottom: 28 }} />
        <h1 className="text-h2" style={{ margin: '0 0 6px' }}>Afiliado</h1>
        <p className="text-small" style={{ margin: '0 0 26px' }}>
          Copia de demostración sin backend: elige el estado de cuenta que quieres probar.
        </p>

        {error && (
          <div style={{ marginBottom: 18 }}>
            <Alert tone="error" title="No se pudo entrar">{error}</Alert>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card padding="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Cuenta activa</span>
            <p className="text-small" style={{ margin: 0 }}>Entra directo al portal del afiliado: catálogo, compras, cupo y tickets.</p>
            <Button loading={loading} onClick={entrarActivo}>Entrar al portal</Button>
          </Card>
          <Card padding="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Cuenta no activa</span>
            <p className="text-small" style={{ margin: 0 }}>Todavía no activó su cuenta — va al formulario existente de activación.</p>
            <Button variant="secondary" onClick={() => navigate('/portal/registro')}>Ir a activar cuenta</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
