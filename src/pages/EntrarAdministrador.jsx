import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo-beet-ticket.svg';
import { Field, Select } from '../components/ui/Field';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { useAuth } from '../context/AuthContext';

// SOLO PARA ESTA COPIA DE DEMOSTRACIÓN SIN BACKEND. Como todavía no existe
// autenticación real, este paso dejar elegir manualmente qué tipo de
// administrador probar — el sistema NUNCA debería mostrar esta elección al
// usuario final; cuando exista el backend real en FastAPI, esta pantalla se
// reemplaza por Login.jsx (que sigue intacto en /login) y será el backend
// quien determine el rol y la cooperativa a partir de las credenciales
// reales, no una selección manual.
const OPCIONES = [
  { value: 'GES', label: 'GES', descripcion: 'Storage central, cooperativas y transacciones globales.', correo: 'ges@beetticket.com', to: '/ges' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', descripcion: 'Vista panorámica de todo BEET: todas las cooperativas y GES.', correo: 'superadmin@beetticket.com', to: '/super-admin/panorama' },
  { value: 'ADMIN', label: 'Administrador', descripcion: 'Panel completo de su propia cooperativa (Cooperativa Bienestar).', correo: 'admin@beetticket.com', to: '/admin' },
  { value: 'LECTOR', label: 'Lector', descripcion: 'Solo lectura de su propia cooperativa (Cooperativa Bienestar).', correo: 'lector@beetticket.com', to: '/lector' },
];

export default function EntrarAdministrador() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [seleccion, setSeleccion] = useState('GES');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const opcion = OPCIONES.find((o) => o.value === seleccion);

  const ingresar = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(opcion.correo, 'demo');
      navigate(opcion.to);
    } catch (err) {
      setError(err.message || 'No se pudo entrar con este usuario demo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <button
          onClick={() => navigate('/')}
          className="text-small"
          style={{ background: 'none', border: 'none', padding: 0, marginBottom: 16, cursor: 'pointer', color: 'var(--brand-primary)', fontWeight: 600, display: 'block' }}
        >
          ← Volver
        </button>
        <img src={logo} alt="BEET Ticket" height={64} style={{ marginBottom: 28 }} />
        <h1 className="text-h2" style={{ margin: '0 0 6px' }}>Administrador</h1>
        <p className="text-small" style={{ margin: '0 0 26px' }}>
          Copia de demostración sin backend: elige qué usuario quieres probar.
        </p>

        {error && (
          <div style={{ marginBottom: 18 }}>
            <Alert tone="error" title="No se pudo entrar">{error}</Alert>
          </div>
        )}

        <form onSubmit={ingresar}>
          <Field label="Usuario demo" hint={opcion.descripcion}>
            <Select value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
              {OPCIONES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>

          <Button type="submit" size="lg" style={{ width: '100%', marginTop: 8 }} loading={loading}>
            Ingresar
          </Button>
        </form>

        <div className="login-note text-caption">
          Este selector es temporal, solo para esta copia de prueba. Más adelante lo reemplaza la autenticación real de
          FastAPI, que determinará el rol y la cooperativa por backend.
        </div>
      </div>
    </div>
  );
}
