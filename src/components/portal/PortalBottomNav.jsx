import { NavLink } from 'react-router-dom';
import { IconDashboard, IconGrid, IconAfiliados, IconRedencion, IconBell } from '../ui/Icons';

// El cupo ya no tiene una vista propia — se consulta directamente en
// Inicio (ver PortalHome.jsx), así que "Cupo" se quitó de la navegación
// sin reemplazarlo por ningún otro ítem.
const ITEMS = [
  { to: '/portal', label: 'Inicio', icon: IconDashboard, end: true },
  { to: '/portal/catalogo', label: 'Beneficios', icon: IconGrid },
  { to: '/portal/tickets', label: 'Tickets', icon: IconRedencion },
  { to: '/portal/notificaciones', label: 'Alertas', icon: IconBell },
  { to: '/portal/perfil', label: 'Perfil', icon: IconAfiliados },
];

export default function PortalBottomNav() {
  return (
    <nav className="portal-bottom-nav">
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `portal-bottom-item ${isActive ? 'active' : ''}`}>
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
