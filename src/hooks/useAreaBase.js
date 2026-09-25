import { useAuth } from '../context/AuthContext';

// Prefijo de ruta del área actual, según el rol autenticado — misma lógica
// que components/layout/Sidebar.jsx. Las páginas del panel de cooperativa
// (Convenios, Inventario, Afiliados, Cupos, Transacciones, Reportes,
// Documentos, Configuración) se montan bajo TRES prefijos distintos
// (/admin, /lector, /super-admin — ver App.jsx) reutilizando el mismo
// componente, así que no pueden usar rutas absolutas fijas como
// "/convenios/5": necesitan preguntar en qué área están montadas.
export function useAreaBase() {
  const { role, roles } = useAuth();
  if (role === roles.SUPER_ADMIN) return '/super-admin';
  if (role === roles.LECTOR) return '/lector';
  if (role === roles.GES) return '/ges';
  return '/admin';
}
