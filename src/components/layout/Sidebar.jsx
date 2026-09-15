import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../../assets/logo-beet-ticket.svg';
import {
  IconDashboard, IconConvenios, IconInventario, IconAfiliados, IconCupos,
  IconVentas, IconReportes, IconAfiliados as IconUsers, IconConfiguracion,
  IconDocumentos, IconGes, IconPlus,
} from '../ui/Icons';
import { useAuth } from '../../context/AuthContext';
import * as dashboardService from '../../services/dashboardService';

// Cada rol vive en su propia área con su propio prefijo de ruta — ver
// App.jsx. El menú se arma según el rol autenticado, no hay una sola lista
// fija como antes: GES nunca ve Afiliados/Cupos/Configuración, Lector
// nunca ve GES/Configuración, y el Administrador de cooperativa solo ve un
// enlace "GES" que abre el formulario de solicitud (no el panel completo).
function basePathFor(role, roles) {
  if (role === roles.GES) return '/ges';
  if (role === roles.SUPER_ADMIN) return '/super-admin';
  if (role === roles.LECTOR) return '/lector';
  return '/admin';
}

function buildNav(role, roles) {
  const base = basePathFor(role, roles);

  if (role === roles.GES) {
    return [
      { to: base, label: 'Dashboard', icon: IconDashboard, end: true },
      { to: `${base}/cooperativas`, label: 'Cooperativas', icon: IconAfiliados },
      { to: `${base}/storage`, label: 'Storage', icon: IconInventario },
      { to: `${base}/convenios`, label: 'Convenios', icon: IconConvenios },
      { to: `${base}/compras`, label: 'Comprar bonos y boletas', icon: IconPlus },
      { to: `${base}/transacciones`, label: 'Transacciones', icon: IconVentas },
    ];
  }

  // ADMIN / LECTOR / SUPER_ADMIN comparten el mismo panel de cooperativa —
  // solo cambia el prefijo de ruta y qué items extra ven.
  const nav = [
    { to: base, label: 'Dashboard', icon: IconDashboard, end: true },
    { to: `${base}/convenios`, label: 'Convenios', icon: IconConvenios },
    { to: `${base}/inventario`, label: 'Inventario', icon: IconInventario, badgeKey: 'inventario' },
    { to: `${base}/afiliados`, label: 'Afiliados', icon: IconAfiliados },
    { to: `${base}/cupos`, label: 'Cupos de crédito', icon: IconCupos },
    { to: `${base}/transacciones`, label: 'Transacciones', icon: IconVentas },
    { to: `${base}/reportes`, label: 'Reportes', icon: IconReportes },
  ];
  if (role === roles.SUPER_ADMIN) {
    // Vista panorámica de todo BEET — va primero porque es la vista
    // principal de Súper admin (sección 6); el "Dashboard" de abajo sigue
    // siendo el de la cooperativa seleccionada en el header, sin cambios.
    nav.unshift({ to: `${base}/panorama`, label: 'Dashboard Super Admin', icon: IconDashboard });
    nav.push({ to: `${base}/usuarios`, label: 'Usuarios', icon: IconUsers });
  }
  nav.push({ to: `${base}/documentos-legales`, label: 'Documentos legales', icon: IconDocumentos });
  if (role !== roles.LECTOR) {
    nav.push({ to: `${base}/configuracion`, label: 'Configuración', icon: IconConfiguracion });
  }
  if (role === roles.ADMIN) {
    // Solo el formulario de solicitud — NUNCA el panel completo de GES.
    nav.push({ to: `${base}/ges`, label: 'GES', icon: IconGes });
  }
  if (role === roles.SUPER_ADMIN) {
    // Súper admin SÍ puede entrar al panel completo de GES (sección 25).
    nav.push({ to: '/ges', label: 'GES', icon: IconGes });
  }
  return nav;
}

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { permissions, role, roles } = useAuth();
  const [proximasAVencer, setProximasAVencer] = useState(0);
  const nav = buildNav(role, roles);

  useEffect(() => {
    // No badge shown until this resolves — 0 is a real "unknown yet" state,
    // never a fabricated placeholder count. No aplica para GES (no tiene
    // ítem de Inventario), pero la llamada es inofensiva de todas formas.
    dashboardService.obtenerDashboardStats().then((s) => setProximasAVencer(s.unidades_proximas_a_vencer)).catch(() => {});
  }, [role]);

  const footerLabel = role === roles.GES ? 'Panel GES' : role === roles.SUPER_ADMIN ? 'Súper administrador' : role === roles.LECTOR ? 'Panel de consulta' : 'Panel administrativo';

  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" onClick={onCloseMobile} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="BEET Ticket" height={40} />
        </div>
        <nav className="sidebar-nav">
          {nav.filter((item) => !item.requires || permissions[item.requires]).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onCloseMobile}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <item.icon size={18} color={undefined} />
              <span>{item.label}</span>
              {item.badgeKey === 'inventario' && proximasAVencer > 0 && (
                <span className="sidebar-badge">{proximasAVencer}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer text-caption">v1.0 · {footerLabel}</div>
      </aside>
    </>
  );
}
