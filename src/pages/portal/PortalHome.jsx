import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAffiliateAuth } from '../../context/AffiliateAuthContext';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import BenefitCard from '../../components/portal/BenefitCard';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import * as convenioService from '../../services/convenioService';
import { useMiCupo } from '../../hooks/useMiCupo';
import { useNotificacionesAfiliado } from '../../hooks/useNotificacionesAfiliado';
import { useToast } from '../../context/ToastContext';
import { formatCOP, percent } from '../../utils/format';

export default function PortalHome() {
  const { afiliado } = useAffiliateAuth();
  const { cupo, loading: cupoLoading } = useMiCupo();
  const { push } = useToast();
  const { notificaciones } = useNotificacionesAfiliado();

  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    convenioService
      .obtenerCatalogoAfiliado()
      .then(setCatalogo)
      .catch((err) => setError(err.message || 'No fue posible cargar la información.'))
      .finally(() => setLoading(false));
  }, []);

  // Avisos temporales al entrar al portal (sección 4): se muestran un
  // momento y desaparecen solos — la notificación NUNCA deja de existir,
  // sigue disponible en Notificaciones (misma lista, ver
  // hooks/useNotificacionesAfiliado.js) aunque el toast ya no esté visible.
  // No es la única forma de consultarla, por eso no bloquea nada mientras
  // se muestra (toast, no modal).
  useEffect(() => {
    notificaciones.forEach((n) => {
      push({
        title: n.titulo,
        description: n.detalle ? `${n.detalle} — revísalo en Notificaciones.` : 'Revísalo en Notificaciones.',
        variant: 'warning',
        duration: 6000,
      });
    });
    // Solo al entrar (cuando la lista termina de cargar) — no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificaciones]);

  const destacados = useMemo(() => catalogo.slice(0, 3), [catalogo]);

  return (
    <div>
      <div className="portal-hero">
        <h1 className="portal-hero-title">Hola, {afiliado.nombres} 👋</h1>
        <p className="portal-hero-sub">Consulta tu información, tu cupo de crédito y los beneficios disponibles para ti.</p>
      </div>

      {/* La información personal (nombres, apellidos, documento, etc.) ya
          no se muestra aquí — vive únicamente en Perfil (ver Profile.jsx).
          Inicio solo conserva bloques funcionales (cupo, beneficios). */}
      <div className="grid grid-2 section-gap">
        {cupoLoading ? (
          <Card><LoadingState title="Cargando cupo…" /></Card>
        ) : cupo ? (
          // Antes vivía en su propia vista (/portal/cupo, ver MiCupo.jsx) —
          // se integró aquí para tener un único lugar de consulta del cupo
          // (misma información, mismos datos de useMiCupo, sin inventar
          // nada nuevo): asignado/consumido/disponible + estado + barra de
          // progreso, de forma compacta para no recargar Inicio.
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span className="text-label">Cupo</span>
              <StatusBadge status={cupo.estado} />
            </div>
            <div className="progress-track" style={{ marginBottom: 12 }}>
              <div className="progress-fill green" style={{ width: `${percent(cupo.cupo_total - cupo.cupo_disponible, cupo.cupo_total)}%` }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <InfoRow label="Cupo asignado" value={formatCOP(cupo.cupo_total)} />
              <InfoRow label="Cupo consumido" value={formatCOP(cupo.cupo_total - cupo.cupo_disponible)} />
              <InfoRow label="Cupo disponible" value={formatCOP(cupo.cupo_disponible)} />
            </div>
          </Card>
        ) : (
          <Card>
            <div className="text-label" style={{ marginBottom: 10 }}>Cupo de crédito</div>
            <div className="text-small cell-muted">Tu entidad aún no te ha asignado un cupo de crédito.</div>
          </Card>
        )}
      </div>

      <div className="page-header">
        <div>
          <h2 className="text-h2" style={{ margin: 0 }}>Beneficios destacados</h2>
          <p className="page-subtitle">Precio BEET y ahorro, directamente de tu entidad.</p>
        </div>
        <Link to="/portal/catalogo" style={{ fontSize: 13, fontWeight: 600 }}>Ver todos los beneficios →</Link>
      </div>

      {loading ? (
        <div className="grid grid-3">
          {[0, 1, 2].map((i) => <Card key={i}><LoadingState title="Cargando…" /></Card>)}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={() => window.location.reload()} />
      ) : destacados.length === 0 ? (
        <EmptyState title="No hay convenios disponibles actualmente" description="Muy pronto tu entidad habilitará nuevos beneficios." />
      ) : (
        <div className="grid grid-3">
          {destacados.map((c) => (
            <BenefitCard key={c.id} convenio={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span className="text-small">{label}</span>
      <span style={{ fontWeight: 500 }}>{value ?? '—'}</span>
    </div>
  );
}
