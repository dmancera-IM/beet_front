import { Routes, Route } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import RequireRole from './components/layout/RequireRole';
import { ROLES_DISPLAY } from './utils/roles';
import Login from './pages/Login';
import Landing from './pages/Landing';
import EntrarAdministrador from './pages/EntrarAdministrador';
import EntrarAfiliado from './pages/EntrarAfiliado';
import Dashboard from './pages/Dashboard';
import SuperAdminDashboard from './pages/admin/superadmin/SuperAdminDashboard';
import GesDashboard from './pages/admin/ges/GesDashboard';
import CooperativasList from './pages/admin/ges/CooperativasList';
import CooperativaDetail from './pages/admin/ges/CooperativaDetail';
import ConveniosCatalogo from './pages/admin/ges/ConveniosCatalogo';
import Storage from './pages/admin/ges/Storage';
import ComprarBonos from './pages/admin/ges/ComprarBonos';
import GesTransacciones from './pages/admin/ges/GesTransacciones';
import GesB2B from './pages/admin/ges/GesB2B';
import GesConfiguracion from './pages/admin/ges/Configuracion';
import ComprarBonosGes from './pages/admin/ComprarBonosGes';
import B2BForm from './pages/admin/b2b/B2BForm';
import BolsaCredito from './pages/admin/BolsaCredito';
import ConveniosList from './pages/admin/convenios/ConveniosList';
import ConvenioForm from './pages/admin/convenios/ConvenioForm';
import ConvenioDetail from './pages/admin/convenios/ConvenioDetail';
import InventarioGeneral from './pages/admin/inventario/InventarioGeneral';
import InventarioConvenio from './pages/admin/inventario/InventarioConvenio';
import AfiliadosList from './pages/admin/afiliados/AfiliadosList';
import AfiliadoDetail from './pages/admin/afiliados/AfiliadoDetail';
import CuposList from './pages/admin/cupos/CuposList';
import TransaccionesList from './pages/admin/transacciones/TransaccionesList';
import TransaccionDetail from './pages/admin/transacciones/TransaccionDetail';
import Reportes from './pages/admin/reportes/Reportes';
// ===== Páginas exclusivas de ADMIN (ver definición funcional de ADMIN) =====
// Forks dedicados para no tocar en absoluto lo que Lector/Súper admin ya
// usan arriba (mismos componentes de siempre, sin cambios).
import ConveniosListAdmin from './pages/admin/convenios/ConveniosListAdmin';
import ConvenioDetailAdmin from './pages/admin/convenios/ConvenioDetailAdmin';
import AfiliadosListAdmin from './pages/admin/afiliados/AfiliadosListAdmin';
import AfiliadoDetailAdmin from './pages/admin/afiliados/AfiliadoDetailAdmin';
import TransaccionesListAdmin from './pages/admin/transacciones/TransaccionesListAdmin';
import UsuariosList from './pages/admin/usuarios/UsuariosList';
import Configuracion from './pages/admin/configuracion/Configuracion';
import DocumentosLegales from './pages/admin/documentos/DocumentosLegales';
import NotFound from './pages/NotFound';
import RequireAffiliateAuth from './components/layout/RequireAffiliateAuth';
import PortalLayout from './components/portal/PortalLayout';
import PortalLogin from './pages/portal/PortalLogin';
import PortalHome from './pages/portal/PortalHome';
import Catalogo from './pages/portal/Catalogo';
import BenefitDetail from './pages/portal/BenefitDetail';
import Profile from './pages/portal/Profile';  //perfil afiliado
import PortalRegister from './pages/portal/PortalRegister';
import PurchaseFlow from './pages/portal/PurchaseFlow';
import MyTickets from './pages/portal/MyTickets';
import TicketDetail from './pages/portal/TicketDetail';
import Notificaciones from './pages/portal/Notificaciones';
import EditProfile from './pages/portal/EditProfile';
import PortalNotFound from './pages/portal/PortalNotFound'; //pafina de error portalafiliadd

// NOT routed yet — the debt-assumption document (generated during a cupo
// purchase, see backend/app/services/transaction_service.py) has no
// affiliate-facing download endpoint mounted this pass (only the ticket
// PDF does, via /api/tickets/me/{id}/descarga). Their page files still
// exist in pages/portal/ as scaffolding for a future pass — see
// frontend/README.md.
// import MyDocuments from './pages/portal/MyDocuments';
// import DocumentDetail from './pages/portal/DocumentDetail';

// Páginas del panel de una cooperativa, compartidas literalmente entre las
// tres áreas que las usan (/admin, /lector, /super-admin) — mismo
// componente, montado bajo tres prefijos distintos; lo único que cambia
// entre ellas es el rol permitido (RequireRole) y qué ítems ve cada uno en
// el Sidebar (ver components/layout/Sidebar.jsx). Cada rol solo puede ver
// los datos de SU cooperativa (o, para Súper admin, de la que elija en el
// selector del header) — eso ya lo garantiza CooperativaContext/apiClient,
// sin relación con estas rutas.
const paginasCooperativa = (
  <>
    <Route index element={<Dashboard />} />
    <Route path="convenios" element={<ConveniosList />} />
    <Route path="convenios/nuevo" element={<ConvenioForm />} />
    <Route path="convenios/:id" element={<ConvenioDetail />} />
    <Route path="convenios/:id/editar" element={<ConvenioForm />} />
    <Route path="inventario" element={<InventarioGeneral />} />
    <Route path="inventario/:convenioId" element={<InventarioConvenio />} />
    <Route path="afiliados" element={<AfiliadosList />} />
    <Route path="afiliados/:id" element={<AfiliadoDetail />} />
    <Route path="cupos" element={<CuposList />} />
    <Route path="transacciones" element={<TransaccionesList />} />
    <Route path="transacciones/:id" element={<TransaccionDetail />} />
    <Route path="reportes" element={<Reportes />} />
    <Route path="documentos-legales" element={<DocumentosLegales />} />
  </>
);

export default function App() {
  return (
    <Routes>
      {/* ===== Entrada única + login real (Login/PortalLogin siguen intactos) ===== */}
      <Route path="/" element={<Landing />} />
      <Route path="/entrar/administrador" element={<EntrarAdministrador />} />
      <Route path="/entrar/afiliado" element={<EntrarAfiliado />} />
      <Route path="/login" element={<Login />} />

      {/* ===== GES — independiente, sin cooperativa_id (secciones 4-10) ===== */}
      <Route
        path="/ges"
        element={
          <RequireRole allow={[ROLES_DISPLAY.GES, ROLES_DISPLAY.SUPER_ADMIN]}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<GesDashboard />} />
        <Route path="cooperativas" element={<CooperativasList />} />
        <Route path="cooperativas/:id" element={<CooperativaDetail />} />
        <Route path="convenios" element={<ConveniosCatalogo />} />
        <Route path="storage" element={<Storage />} />
        <Route path="compras" element={<ComprarBonos />} />
        <Route path="transacciones" element={<GesTransacciones />} />
        <Route path="b2b" element={<GesB2B />} />
        <Route path="configuracion" element={<GesConfiguracion />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ===== Súper admin — vista panorámica de todas las cooperativas + GES ===== */}
      <Route
        path="/super-admin"
        element={
          <RequireRole allow={[ROLES_DISPLAY.SUPER_ADMIN]}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route path="panorama" element={<SuperAdminDashboard />} />
        {paginasCooperativa}
        <Route path="usuarios" element={<UsuariosList />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ===== Administrador de cooperativa — solo SU cooperativa =====
          Rutas propias (no `paginasCooperativa`): sin Inventario ni Cupos
          como secciones independientes — ver Sidebar.jsx y la definición
          funcional de ADMIN. Lector y Súper admin siguen usando
          `paginasCooperativa` sin ningún cambio, más abajo. */}
      <Route
        path="/admin"
        element={
          <RequireRole allow={[ROLES_DISPLAY.ADMIN]}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="convenios" element={<ConveniosListAdmin />} />
        <Route path="convenios/:id" element={<ConvenioDetailAdmin />} />
        <Route path="afiliados" element={<AfiliadosListAdmin />} />
        <Route path="afiliados/:id" element={<AfiliadoDetailAdmin />} />
        <Route path="b2b" element={<B2BForm />} />
        <Route path="transacciones" element={<TransaccionesListAdmin />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="documentos-legales" element={<DocumentosLegales />} />
        <Route path="configuracion" element={<Configuracion />} />
        {/* Solo el formulario de solicitud — nunca el panel completo de GES. */}
        <Route path="ges" element={<ComprarBonosGes />} />
        {/* "GES" y "B2B" se fusionaron visualmente en "Bolsa / Crédito"
            (ver Sidebar.jsx) — las rutas originales se mantienen montadas
            para no romper accesos directos existentes. */}
        <Route path="bolsa-credito" element={<BolsaCredito />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ===== Lector — solo lectura de su cooperativa, sin GES ni Configuración ===== */}
      <Route
        path="/lector"
        element={
          <RequireRole allow={[ROLES_DISPLAY.LECTOR]}>
            <AdminLayout />
          </RequireRole>
        }
      >
        {paginasCooperativa}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ===== Affiliate portal — fully separate experience, no admin nav ===== */}
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal/registro" element={<PortalRegister />} />
      <Route
        path="/portal"
        element={
          <RequireAffiliateAuth>
            <PortalLayout />
          </RequireAffiliateAuth>
        }
      >
        <Route index element={<PortalHome />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="catalogo/:id" element={<BenefitDetail />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="perfil/editar" element={<EditProfile />} />
        <Route path="comprar/:id" element={<PurchaseFlow />} />
        <Route path="tickets" element={<MyTickets />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="notificaciones" element={<Notificaciones />} />
        <Route path="*" element={<PortalNotFound />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
