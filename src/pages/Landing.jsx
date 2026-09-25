import { Navigate, useNavigate } from 'react-router-dom';
import logo from '../assets/logo-beet-ticket.svg';
import Button from '../components/ui/Button';
import { LoadingState } from '../components/ui/States';
import { useAuth } from '../context/AuthContext';
import { useAffiliateAuth } from '../context/AffiliateAuthContext';

function areaDeRol(role, roles) {
  if (role === roles.GES) return '/ges';
  if (role === roles.SUPER_ADMIN) return '/super-admin/panorama';
  if (role === roles.LECTOR) return '/lector';
  return '/admin';
}

// Único punto de entrada de BEET — solo dos caminos, Administrador y
// Afiliado (sección 2 de la definición funcional). Cuál de los 4 tipos de
// administrador (GES/Súper admin/Admin/Lector), o si el afiliado ya activó
// su cuenta, se resuelve en el siguiente paso — ver EntrarAdministrador.jsx
// y EntrarAfiliado.jsx. Si ya hay una sesión activa (de cualquier tipo),
// entra directo a su área en vez de mostrar el selector de nuevo.
export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated: adminAutenticado, isCheckingSession: verificandoAdmin, role, roles } = useAuth();
  const { isAuthenticated: afiliadoAutenticado, isCheckingSession: verificandoAfiliado } = useAffiliateAuth();

  if (verificandoAdmin || verificandoAfiliado) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '15vh' }}>
        <LoadingState title="Verificando sesión…" />
      </div>
    );
  }
  if (adminAutenticado) return <Navigate to={areaDeRol(role, roles)} replace />;
  if (afiliadoAutenticado) return <Navigate to="/portal" replace />;

  return (
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="BEET Ticket" height={72} style={{ marginBottom: 38, alignItems: 'center' }} />
        <h1 className="text-h2" style={{ margin: '0 0 6px' }}>Bienvenido a BEET Ticket</h1>
        <p className="text-small" style={{ margin: '0 0 26px' }}>
          Elige cómo quieres ingresar a la plataforma.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button size="lg" style={{ width: '100%' }} onClick={() => navigate('/login')}>
            Administrador
          </Button>
          <Button size="lg" variant="secondary" style={{ width: '100%' }} onClick={() => navigate('/portal/login')}>
            Afiliado
          </Button>
        </div>
      </div>
    </div>
  );
}
