import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../ui/States';

// Protege un área administrativa completa (/ges, /super-admin, /admin,
// /lector) para que solo el/los rol(es) indicados en `allow` puedan
// entrar — ej. GES nunca puede entrar a /super-admin, y viceversa (ver
// secciones 4, 24 y 25 de la definición funcional). Envuelve la misma
// verificación de sesión que RequireAuth; se usa en su lugar (no junto a
// ella) para las áreas que ya requieren un rol específico.
export default function RequireRole({ allow, children }) {
  const { isAuthenticated, isCheckingSession, role } = useAuth();

  if (isCheckingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '15vh' }}>
        <LoadingState title="Verificando sesión…" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!allow.includes(role)) return <Navigate to="/" replace />;

  return children;
}
