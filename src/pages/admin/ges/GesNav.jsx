import { NavLink } from 'react-router-dom';

// Sub-navegación de la sección GES. Reutiliza exactamente las mismas clases
// .tabs/.tab del resto del panel (ver Nav.jsx > Tabs), solo que con NavLink
// en vez de botones con estado, porque cada sección de GES es su propia
// ruta (para que se pueda enlazar directamente, ej. /ges/transacciones).
// Deliberadamente NO incluye Afiliados ni Cupos de crédito — GES no
// administra directamente ninguno de esos, esas son cosas de cada
// cooperativa (ver pages/admin/cooperativa/). "Configuración" aquí SÍ es
// de GES (imagen + plantilla PDF por convenio, ver Configuracion.jsx) —
// no debe confundirse con la Configuración de ADMIN (datos de su propia
// entidad), son pantallas completamente distintas.
const ITEMS = [
  { to: '/ges', label: 'Dashboard', end: true },
  { to: '/ges/cooperativas', label: 'Entidades' },
  { to: '/ges/usuarios', label: 'Usuarios' },
  { to: '/ges/storage', label: 'Storage' },
  { to: '/ges/convenios', label: 'Convenios' },
  { to: '/ges/compras', label: 'Carga de bonos y boletas' },
  { to: '/ges/transacciones', label: 'Transacciones' },
  { to: '/ges/b2b', label: 'B2B' },
  { to: '/ges/configuracion', label: 'Configuración' },
];

export default function GesNav() {
  return (
    <div className="tabs section-gap" role="tablist">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
