import { useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Select, Input } from '../../../components/ui/Field';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import FileUploader from '../../../components/ui/FileUploader';
import { IconClose, IconDescargar, IconInventario, IconUpload } from '../../../components/ui/Icons';
import { useToast } from '../../../context/ToastContext';
import GesNav from './GesNav';
import { agregarStorage, getProductos, getProveedores } from './gesData';

// GES no compra bonos/boletas directamente al proveedor desde esta
// pantalla (eso ya no aplica a este flujo) — GES RECIBE un Excel con los
// bonos/boletas que le llegaron y los carga a su Storage central:
//
//   Excel de bonos/boletas → Carga → Storage GES
//
// Todavía no hay integración real con Excel/backend: el archivo no se
// parsea, pero al "procesar" la carga sí se alimenta el Storage con la
// lógica mock existente (agregarStorage), igual que si esas filas del
// Excel se hubieran leído una por una.
export default function ComprarBonos() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Carga de bonos y boletas' }]);
  const { push } = useToast();

  const [archivo, setArchivo] = useState(null);
  const [proveedorId, setProveedorId] = useState(getProveedores()[0]?.id ?? '');
  const [productoId, setProductoId] = useState(getProductos(getProveedores()[0]?.id ?? '')[0]?.id ?? '');
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const productosDelConvenio = getProductos(proveedorId);

  const handleProveedorChange = (id) => {
    setProveedorId(id);
    setProductoId(getProductos(id)[0]?.id ?? '');
  };

  const handleArchivo = (file) => {
    const nombre = file.name.toLowerCase();
    if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.xls') && !nombre.endsWith('.csv')) {
      push({ title: 'Archivo no válido', description: 'Solo se aceptan archivos Excel (.xlsx, .xls) o .csv.', variant: 'error' });
      return;
    }
    setArchivo(file);
    setResultado(null);
  };

  const procesarCarga = (e) => {
    e.preventDefault();
    setError('');
    const n = Number(cantidad);
    if (!archivo) {
      setError('Primero sube el Excel con los bonos/boletas recibidos.');
      return;
    }
    if (!productoId) {
      setError('Selecciona el producto que trae el Excel.');
      return;
    }
    if (!n || n <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    setProcesando(true);
    try {
      const resumen = agregarStorage({ productoId, cantidad: n });
      const nombreConvenio = getProveedores().find((p) => p.id === proveedorId)?.nombre ?? '';
      const nombreProducto = productosDelConvenio.find((p) => p.id === Number(productoId))?.nombre ?? '';
      setResultado({ nombreConvenio, nombreProducto, cantidad: n, disponibleActual: resumen?.disponible ?? null });
      push({ title: 'Storage actualizado', description: `${n.toLocaleString('es-CO')} unidades de ${nombreConvenio} · ${nombreProducto} cargadas al Storage de GES.` });
      setCantidad('');
      setArchivo(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Carga de bonos y boletas</h1>
          <p className="page-subtitle">Sube el Excel con los bonos/boletas recibidos para alimentar el Storage central de GES.</p>
        </div>
      </div>

      <GesNav />

      <Card padding="card-pad-lg">
        <form onSubmit={procesarCarga} style={{ maxWidth: 520 }}>
          <div className="text-label" style={{ marginBottom: 4 }}>Archivo</div>
          <p className="text-caption cell-muted" style={{ marginTop: 0, marginBottom: 12 }}>
            El Excel contiene los bonos/boletas que un proveedor le entregó a GES. Todavía no se procesa el contenido del
            archivo automáticamente — selecciona abajo a qué convenio/producto corresponde y cuántas unidades trae.
          </p>
          {!archivo ? (
            <FileUploader
              label="Arrastra aquí el Excel de bonos/boletas"
              hint="o Seleccionar archivo · .xlsx, .xls o .csv"
              accept=".xlsx,.xls,.csv"
              onFile={handleArchivo}
            />
          ) : (
            <div className="table-card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{archivo.name}</div>
                <div className="text-caption">Excel de bonos/boletas listo para cargar</div>
              </div>
              <Button type="button" variant="ghost" size="sm" icon={<IconClose size={14} color="#1F2937" />} onClick={() => setArchivo(null)} disabled={procesando}>
                Quitar
              </Button>
            </div>
          )}

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <Field label="Convenio">
              <Select value={proveedorId} onChange={(e) => handleProveedorChange(e.target.value)}>
                {getProveedores().map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </Select>
            </Field>
            <Field label="Producto">
              <Select value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={productosDelConvenio.length === 0}>
                {productosDelConvenio.length === 0 ? (
                  <option value="">Sin productos para este convenio</option>
                ) : (
                  productosDelConvenio.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))
                )}
              </Select>
            </Field>
          </div>


          <Button type="submit" loading={procesando}>Procesar carga</Button>
        </form>

        {resultado && (
          <div style={{ marginTop: 20 }}>
            <Alert tone="success" title="Bonos/boletas cargados al Storage">
              {resultado.cantidad.toLocaleString('es-CO')} unidades de {resultado.nombreConvenio} · {resultado.nombreProducto} ya están disponibles en Storage
              {resultado.disponibleActual != null ? ` (${resultado.disponibleActual.toLocaleString('es-CO')} disponibles en total para este producto)` : ''}.
            </Alert>
          </div>
        )}
      </Card>
    </div>
  );
}

function PasoFlujo({ icon, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <span style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--bg-brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <span className="text-small" style={{ fontWeight: 600, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function Flecha() {
  return <span className="text-h2 cell-muted" aria-hidden="true">→</span>;
}
