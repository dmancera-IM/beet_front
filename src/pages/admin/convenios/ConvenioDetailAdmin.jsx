import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import PermissionGate from '../../../components/ui/PermissionGate';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import * as convenioService from '../../../services/convenioService';
import * as inventarioService from '../../../services/inventarioService';
import ProductoConfigModal from './ProductoConfigModal';
import { useToast } from '../../../context/ToastContext';
import { formatCOP } from '../../../utils/format';
import { useAreaBase } from '../../../hooks/useAreaBase';

export default function ConvenioDetailAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useAreaBase();
  const { push } = useToast();

  const [convenio, setConvenio] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingEstado, setSavingEstado] = useState(false);
  const [productoModal, setProductoModal] = useState(null);

  useSetBreadcrumbs([
    { label: 'Convenios', to: `${base}/convenios` },
    { label: convenio?.nombre ?? 'Detalle' },
  ]);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      convenioService.listarConveniosCooperativa(),
      convenioService.listarProductosCooperativa(id),
    ])
      .then(async ([convenios, productosBase]) => {
        const actual = convenios.find((c) => String(c.id_convenio) === String(id)) ?? null;
        setConvenio(actual);
        const productosConInventario = await Promise.all(
          productosBase.map((p) =>
            inventarioService
              .resumenInventario(p.id_producto)
              .then((r) => ({ ...p, disponible: r.disponible ?? 0 }))
              .catch(() => ({ ...p, disponible: 0 }))
          )
        );
        setProductos(productosConInventario);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const inventarioTotal = productos.reduce((s, p) => s + (p.disponible ?? 0), 0);

  const toggleEstado = async () => {
    if (!convenio) return;
    const nuevoEstado = !convenio.estado;
    if (nuevoEstado && !convenio.puede_activarse) {
      push({ title: 'Faltan datos para activar', description: 'Configura el porcentaje y al menos un producto activo con precio público.', variant: 'error' });
      return;
    }
    setSavingEstado(true);
    try {
      await convenioService.cambiarEstadoConvenioCooperativa(convenio.id_convenio, nuevoEstado);
      push({ title: nuevoEstado ? 'Convenio activado' : 'Convenio desactivado', description: convenio.nombre });
      cargar();
    } catch (err) {
      push({ title: 'No se pudo actualizar el convenio', description: err.message, variant: 'error' });
    } finally {
      setSavingEstado(false);
    }
  };

  if (loading) return <LoadingState title="Cargando convenio…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;
  if (!convenio) return <EmptyState title="Convenio no encontrado" actionLabel="Volver a convenios" onAction={() => navigate(`${base}/convenios`)} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{convenio.nombre}</h1>
          <p className="page-subtitle">Productos de este convenio y configuración de venta para tus afiliados.</p>
        </div>
        <div className="page-header-actions">
          <PermissionGate fallback={<StatusBadge status={convenio.estado} />}>
            <Switch
              label={convenio.estado ? 'Activo' : 'Inactivo'}
              checked={convenio.estado}
              onChange={toggleEstado}
              disabled={savingEstado || (!convenio.estado && !convenio.puede_activarse)}
              title={!convenio.estado && !convenio.puede_activarse ? 'Configura porcentaje y al menos un producto antes de activar' : undefined}
            />
          </PermissionGate>
        </div>
      </div>

      {!convenio.estado && !convenio.puede_activarse && (
        <Alert tone="warning" title="Faltan datos para activar este convenio">
          Configura el porcentaje de ganancia y al menos un producto activo con precio público. El precio BEET se calcula automáticamente.
        </Alert>
      )}

      <Card padding="card-pad-lg" className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="text-label" style={{ color: 'var(--text-primary)' }}>Ganancia de la entidad</div>
          <span className="tabular" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            {convenio.porcentaje_ganancia_entidad != null ? `${convenio.porcentaje_ganancia_entidad}%` : 'Sin configurar'}
          </span>
        </div>
        <p className="text-caption" style={{ margin: 0, color: 'var(--text-primary)' }}>
          Se configura desde la lista de convenios y todos los productos la heredan automáticamente.
        </p>
      </Card>

      <Card padding="card-pad-lg" className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div className="text-label" style={{ color: 'var(--text-primary)' }}>Inventario total del convenio</div>
          <span className="tabular" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{inventarioTotal} unidades</span>
        </div>
        <p className="text-caption" style={{ margin: 0, color: 'var(--text-primary)' }}>
          Suma del inventario disponible de todos los productos de este convenio.
        </p>
      </Card>

      <Card padding="card-pad-lg" className="section-gap">
        <div className="text-label" style={{ marginBottom: 14 }}>Productos</div>
        {productos.length === 0 ? (
          <EmptyState title="Sin productos" description="GES todavía no registró productos para este convenio en el catálogo maestro." />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="right">Disponible</th>
                  <th className="right">Precio para afiliados</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id_producto} style={{ cursor: 'pointer' }} onClick={() => setProductoModal(p.id_producto)}>
                    <td>
                      <div className="cell-primary">{p.nombre}</div>
                      <div className="cell-muted">{p.descripcion_base ?? '—'}</div>
                    </td>
                    <td className="right tabular">{p.disponible} unidades</td>
                    <td className="right tabular">{p.configurado && p.precio_beet != null ? formatCOP(p.precio_beet) : '—'}</td>
                    <td>{p.configurado ? <StatusBadge status={p.estado} /> : <span className="text-small cell-muted">Sin configurar</span>}</td>
                    <td className="right">
                      <PermissionGate>
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setProductoModal(p.id_producto); }}>
                          {p.configurado ? 'Editar' : 'Configurar'}
                        </Button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProductoConfigModal
        open={!!productoModal}
        productoId={productoModal}
        convenioId={convenio.id_convenio}
        convenioNombre={convenio.nombre}
        onClose={() => setProductoModal(null)}
        onSaved={() => { setProductoModal(null); cargar(); }}
      />
    </div>
  );
}
