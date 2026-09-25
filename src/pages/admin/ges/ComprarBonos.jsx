import { Link } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import GesNav from './GesNav';

// ADAPTADO AL BACKEND REAL: el backend nunca acepta cargar Storage por
// "cantidad" — solo por lista de códigos reales (`POST /storage/bulk`,
// ver services/storageService.js), porque "no generar códigos
// automáticamente" es una regla explícita del backend. Esta pantalla
// duplicaba esa misma acción con una forma que ya no puede honrarse
// (cantidad en vez de códigos), así que redirige a la carga real en Storage
// en vez de simular un resultado que la base de datos nunca podría producir.
export default function ComprarBonos() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Carga de bonos y boletas' }]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Carga de bonos y boletas</h1>
          <p className="page-subtitle">Cargar código por cantidad ya no está disponible.</p>
        </div>
      </div>

      <GesNav />

      <Card padding="card-pad-lg">
        <Alert tone="info" title="Usa Storage para cargar códigos reales">
          El backend real nunca genera códigos automáticamente a partir de una cantidad — cada código de Storage tiene que
          existir tal cual viene de la fuente. Carga los códigos reales desde la pantalla Storage.
        </Alert>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Link to="/ges/storage"><Button>Ir a Storage</Button></Link>
        </div>
      </Card>
    </div>
  );
}
