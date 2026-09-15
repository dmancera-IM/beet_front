import { NavLink } from 'react-router-dom';

// Sub-navegación de la sección GES. Reutiliza exactamente las mismas clases
// .tabs/.tab del resto del panel (ver Nav.jsx > Tabs), solo que con NavLink
// en vez de botones con estado, porque cada sección de GES es su propia
// ruta (para que se pueda enlazar directamente, ej. /ges/transacciones).
// Deliberadamente NO incluye Afiliados, Configuración ni Cupos de crédito
// — GES no administra directamente ninguno de esos, esas son cosas de cada
// cooperativa (ver pages/admin/cooperativa/).
const ITEMS = [
  { to: '/ges', label: 'Dashboard', end: true },
  { to: '/ges/cooperativas', label: 'Cooperativas' },
  { to: '/ges/storage', label: 'Storage' },
  { to: '/ges/convenios', label: 'Convenios' },
  { to: '/ges/compras', label: 'Comprar bonos y boletas' },
  { to: '/ges/transacciones', label: 'Transacciones' },
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
