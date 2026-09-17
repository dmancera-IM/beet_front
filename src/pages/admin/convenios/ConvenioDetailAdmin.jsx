import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Switch } from '../../../components/ui/Field';
import { StatusBadge } from '../../../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/States';
import PermissionGate from '../../../components/ui/PermissionGate';
import Button from '../../../components/ui/Button';
import * as convenioService from '../../../services/convenioService';
import { useToast } from '../../../context/ToastContext';
import { useAreaBase } from '../../../hooks/useAreaBase';

// Detalle de un convenio para ADMIN (sección 10.3): muestra los productos
// que pertenecen a ese convenio/proveedor (catálogo maestro de GES) y el
// inventario disponible de cada uno. El precio NO se edita aquí — cada
// producto se configura por separado (sección 10.4) porque el precio
// pertenece a cooperativa + producto, nunca al convenio (sección 11).
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
        return convenioService.listarProductosCooperativa(c.id_convenio);
      })
      .then(setProductos)
      .catch((err) => setError(err.status === 404 ? null : err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleEstado = async () => {
    const nuevoEstado = !convenio.estado;
    setSavingEstado(true);
    try {
      const actualizado = await convenioService.actualizarConvenio(convenio.id, { estado: nuevoEstado });
      setConvenio(actualizado);
      push({ title: nuevoEstado ? 'Convenio activado' : 'Convenio desactivado', description: convenio.nombre });
    } catch (err) {
      push({ title: 'No se pudo actualizar el convenio', description: err.message, variant: 'error' });
    } finally {
      setSavingEstado(false);
    }
  };

  if (loading) return <LoadingState title="Cargando convenio…" />;
  if (error) return <ErrorState description={error} onRetry={cargar} />;
  if (!convenio) {
    return <EmptyState title="Convenio no encontrado" description="Puede haber sido eliminado del catálogo." actionLabel="Volver a convenios" onAction={() => navigate(`${base}/convenios`)} />;
  }

  const inventarioTotal = productos.reduce((s, p) => s + (p.disponible ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">{convenio.nombre}</h1>
          <p className="page-subtitle">Productos de este convenio y el inventario que tu cooperativa tiene disponible para cada uno.</p>
        </div>
        <div className="page-header-actions">
          <PermissionGate fallback={<StatusBadge status={convenio.estado} />}>
            <Switch label={convenio.estado ? 'Activo' : 'Inactivo'} checked={convenio.estado} onChange={toggleEstado} disabled={savingEstado} />
          </PermissionGate>
        </div>
      </div>

      <Card padding="card-pad-lg" className="section-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div className="text-label" style={{ color: 'var(--text-primary)' }}>Inventario total del convenio</div>
          <span className="tabular" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{inventarioTotal} unidades</span>
        </div>
        {/* `cell-muted`/`text-caption` usan --text-muted (gris claro), poco
            legible en esta card — se fuerza --text-primary (oscuro) solo
            aquí, sin tocar esas clases compartidas por el resto de la app. */}
        <p className="text-caption" style={{ margin: 0, color: 'var(--text-primary)' }}>
          Suma del inventario disponible de todos los productos de este convenio. Llega automáticamente cuando tu cooperativa adquiere inventario desde GES.
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
                  <tr key={p.id_producto} style={{ cursor: 'pointer' }} onClick={() => navigate(`${base}/convenios/${convenio.id}/productos/${p.id_producto}`)}>
                    <td>
                      <div className="cell-primary">{p.nombre}</div>
                      <div className="cell-muted">{p.descripcion_base ?? '—'}</div>
                    </td>
                    <td className="right tabular">{p.disponible} unidades</td>
                    <td className="right tabular">{p.configurado ? `$${p.precio_beet.toLocaleString('es-CO')}` : '—'}</td>
                    <td>
                      {p.configurado ? <StatusBadge status={p.estado} /> : <span className="text-small cell-muted">Sin configurar</span>}
                    </td>
                    <td className="right">
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); navigate(`${base}/convenios/${convenio.id}/productos/${p.id_producto}`); }}>
                        {p.configurado ? 'Editar' : 'Configurar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
