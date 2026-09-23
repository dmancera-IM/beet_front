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
// fija como antes: GES nunca ve Afiliados/Cupos (esos son de cada
// cooperativa) pero sí tiene su propia Configuración (imagen + plantilla
// PDF por convenio, distinta de la de ADMIN); Lector nunca ve
// GES/Configuración, y el Administrador de cooperativa solo ve un
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
      { to: `${base}/cooperativas`, label: 'Entidades', icon: IconAfiliados },
      { to: `${base}/storage`, label: 'Storage', icon: IconInventario },
      { to: `${base}/convenios`, label: 'Convenios', icon: IconConvenios },
      { to: `${base}/compras`, label: 'Carga de bonos y boletas', icon: IconPlus },
      { to: `${base}/transacciones`, label: 'Transacciones', icon: IconVentas },
      // Solicitudes de compra rápida/prioritaria de entidades (sección 6).
      { to: `${base}/b2b`, label: 'B2B', icon: IconGes },
      // Imagen + plantilla PDF por convenio (ver Configuracion.jsx de GES)
      // — distinta de la Configuración de ADMIN, cada rol tiene la suya.
      { to: `${base}/configuracion`, label: 'Configuración', icon: IconConfiguracion },
    ];
  }

  if (role === roles.ADMIN) {
    // Sidebar de ADMIN (definición funcional de ADMIN): orden fijo, sin
    // Inventario ni Cupos de crédito como secciones propias — el inventario
    // se ve dentro de Convenios y la gestión de cupo dentro de Afiliados.
    // Solo afecta a ADMIN: Lector y Súper admin conservan su menú de
    // siempre más abajo, sin ningún cambio.
    return [
      { to: base, label: 'Dashboard', icon: IconDashboard, end: true },
      { to: `${base}/afiliados`, label: 'Afiliados', icon: IconAfiliados },
      { to: `${base}/convenios`, label: 'Convenios', icon: IconConvenios },
      // "GES" (compra normal) y "B2B" (compra rápida/prioritaria) se
      // fusionaron visualmente en una sola vista — ver pages/admin/BolsaCredito.jsx.
      { to: `${base}/bolsa-credito`, label: 'Bolsa / Crédito', icon: IconGes },
      { to: `${base}/transacciones`, label: 'Transacciones', icon: IconVentas },
      { to: `${base}/reportes`, label: 'Reportes', icon: IconReportes },
      { to: `${base}/documentos-legales`, label: 'Documentos legales', icon: IconDocumentos },
      { to: `${base}/configuracion`, label: 'Configuración', icon: IconConfiguracion },
    ];
  }

  // LECTOR / SUPER_ADMIN comparten el mismo panel de cooperativa — sin
  // ningún cambio respecto a antes (solo se modificó el menú de ADMIN).
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
    // "Dashboard Super Admin" (/super-admin/panorama) ya NO es un ítem
    // independiente del sidebar — se accede desde el selector de
    // cooperativa del header (ver Header.jsx). La ruta sigue existiendo
    // tal cual, solo cambió cómo se navega a ella.
    nav.push({ to: `${base}/usuarios`, label: 'Usuarios', icon: IconUsers });
  }
  nav.push({ to: `${base}/documentos-legales`, label: 'Documentos legales', icon: IconDocumentos });
  if (role !== roles.LECTOR) {
    nav.push({ to: `${base}/configuracion`, label: 'Configuración', icon: IconConfiguracion });
  }
  // ADMIN ya retornó su propio menú arriba — de aquí en adelante solo aplica a Súper admin.
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
