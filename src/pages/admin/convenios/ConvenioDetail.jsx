import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import PermissionGate from '../../../components/ui/PermissionGate';
import SeleccionarPlantillaModal from './SeleccionarPlantillaModal';
import CrearPlantillaHtmlModal from './CrearPlantillaHtmlModal';
import * as convenioService from '../../../services/convenioService';
import * as inventarioService from '../../../services/inventarioService';
import { formatCOP, formatDate } from '../../../utils/format';
import { useAreaBase } from '../../../hooks/useAreaBase';

const ESTADOS_INVENTARIO = [
  { key: 'disponible', label: 'Disponible', tone: 'green' },
  { key: 'entregada', label: 'Entregada', tone: 'blue' },
  { key: 'vencida', label: 'Vencida', tone: 'neutral' },
];

export default function ConvenioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useAreaBase();

  const [convenio, setConvenio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inv, setInv] = useState(null);
  const [productos, setProductos] = useState([]);
  const [seleccionarOpen, setSeleccionarOpen] = useState(false);
  const [crearHtmlOpen, setCrearHtmlOpen] = useState(false);

  useSetBreadcrumbs([
    { label: 'Convenios', to: `${base}/convenios` },
    { label: convenio?.nombre ?? 'Detalle' },
  ]);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    convenioService
      .obtenerConvenio(id)
      .then((c) => {
        setConvenio(c);
        return convenioService.listarProductosDeConvenio(c.id_convenio);
      })
      .then((prods) => {
        setProductos(prods);
        // Suma el inventario DISPONIBLE/ENTREGADA/etc. de todos los
        // productos de este convenio (un convenio puede tener varios,
        // sección 7) en un solo resumen agregado para esta vista.
        return Promise.all(prods.map((p) => inventarioService.resumenInventario(p.id).catch(() => null)));
      })
      .then((resumenes) => {
        if (resumenes.length === 0) { setInv(null); return; }
        setInv(
          resumenes.reduce(
            (acc, r) => ({
              disponible: acc.disponible + (r?.disponible ?? 0),
              entregada: acc.entregada + (r?.entregada ?? 0),
              vencida: acc.vencida + (r?.vencida ?? 0),
              total: acc.total + (r?.total ?? 0),
            }),
            { disponible: 0, entregada: 0, vencida: 0, total: 0 }
          )
        );
      })
      .catch((err) => setError(err.status === 404 ? null : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <LoadingState title="Cargando convenio desde PostgreSQL…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;
  if (!convenio) {
    return <EmptyState title="Convenio no encontrado" description="Puede haber sido eliminado del catálogo." actionLabel="Volver a convenios" onAction={() => navigate(`${base}/convenios`)} />;
  }

  const ahorro = convenio.precio_normal - convenio.precio_beet;
  const ahorroPct = Math.round((ahorro / convenio.precio_normal) * 100);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{convenio.nombre}</h1>
          <p className="page-subtitle">{convenio.descripcion ?? 'Sin descripción'}{convenio.plantilla_en_uso ? ` · Plantilla: ${convenio.plantilla_en_uso}` : ''}</p>
        </div>
        <div className="page-header-actions">
          <StatusBadge status={convenio.estado} />
          <PermissionGate>
            <Button variant="secondary" onClick={() => navigate(`${base}/convenios/${convenio.id}/editar`)}>Editar</Button>
          </PermissionGate>
          <Button variant="soft" onClick={() => navigate(`${base}/inventario/${convenio.id}`)}>Ver inventario</Button>
        </div>
      </div>

      <div className="grid detail-grid-2col" style={{ '--col-ratio': '1.1fr 1fr', gap: 16 }}>
        <Card padding="card-pad-lg">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
            <span className="text-display tabular">{formatCOP(convenio.precio_beet)}</span>
            <span className="text-small" style={{ textDecoration: 'line-through' }}>{formatCOP(convenio.precio_normal)}</span>
            <Badge tone="green" dot>Ahorras {ahorroPct}%</Badge>
          </div>
          <p className="text-body" style={{ color: 'var(--text-muted)', marginTop: 16 }}>{convenio.descripcion || 'Sin descripción registrada.'}</p>
          <div className="grid grid-3" style={{ marginTop: 20 }}>
            <div>
              <div className="text-label">Vigencia</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(convenio.fecha_inicio)}{convenio.fecha_fin ? ` – ${formatDate(convenio.fecha_fin)}` : ' – sin fin'}</div>
            </div>
          </div>
        </Card>

        <Card padding="card-pad-lg">
          <div className="text-label" style={{ marginBottom: 14 }}>Inventario por estado</div>
          {inv ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ESTADOS_INVENTARIO.map((e) => (
                <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge tone={e.tone} dot={e.tone !== 'red'}>{e.label}</Badge>
                  <span className="tabular" style={{ fontWeight: 600 }}>{inv[e.key]}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border-default)' }}>
                <span className="text-small">Total cargado</span>
                <span className="tabular" style={{ fontWeight: 600 }}>{inv.total}</span>
              </div>
            </div>
          ) : (
            <div className="text-small cell-muted">No hay inventario cargado todavía para este convenio.</div>
          )}
        </Card>
      </div>

      <Card padding="card-pad-lg" style={{ marginTop: 16 }}>
        <div className="text-label" style={{ marginBottom: 14 }}>Productos de este convenio</div>
        {productos.length === 0 ? (
          <div className="text-small cell-muted">GES todavía no registró productos para este convenio en el catálogo maestro.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {productos.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-default)' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                  <div className="cell-muted text-small">{p.descripcion ?? '—'}</div>
                </div>
                <StatusBadge status={p.estado} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="card-pad-lg" style={{ marginTop: 16 }}>
        <div className="text-label" style={{ marginBottom: 14 }}>Transacciones recientes</div>
        <EmptyState
          title="Consulta el listado general"
          description="No existe un endpoint de transacciones por convenio — usa la sección Transacciones y filtra manualmente por este convenio."
        />
      </Card>

      <SeleccionarPlantillaModal
        open={seleccionarOpen}
        onClose={() => setSeleccionarOpen(false)}
        convenioId={convenio.id}
        onCambio={cargar}
      />
      <CrearPlantillaHtmlModal
        open={crearHtmlOpen}
        onClose={() => setCrearHtmlOpen(false)}
        convenioId={convenio.id}
        onCreada={cargar}
      />
    </div>
  );
}
