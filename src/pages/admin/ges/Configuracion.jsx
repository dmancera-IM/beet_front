import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import Alert from '../../../components/ui/Alert';
import GesNav from './GesNav';

// PENDIENTE: esta pantalla (imagen + plantilla PDF por convenio) era 100%
// mock incluso antes de esta integración — no existe `plantillas_pdf` en
// las 13 tablas del backend actual, y la carga de imagen nunca se
// persistía en ningún lado (solo un data-URL en memoria). La URL de imagen
// del convenio (`convenios.imagen_url`, columna real) ya se edita desde
// Convenios → Editar convenio; la plantilla PDF queda documentada como
// pendiente.
export default function Configuracion() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Configuración' }]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Configuración</h1>
          <p className="page-subtitle">Identidad visual y plantilla PDF por convenio.</p>
        </div>
      </div>

      <GesNav />

      <Alert tone="info" title="Plantilla PDF no disponible en esta integración">
        No existe una tabla de plantillas en el backend actual. La imagen de un convenio (<code>imagen_url</code>) ya se
        edita desde <strong>Convenios → Editar convenio</strong>, con datos reales de PostgreSQL.
      </Alert>
    </div>
  );
}
