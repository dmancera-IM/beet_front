import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { Card } from '../../../components/ui/Card';
import { Field, Select } from '../../../components/ui/Field';
import Alert from '../../../components/ui/Alert';
import FileUploader from '../../../components/ui/FileUploader';
import { LoadingState } from '../../../components/ui/States';
import * as storageService from '../../../services/storageService';
import * as convenioService from '../../../services/convenioService';
import { useToast } from '../../../context/ToastContext';
import GesNav from './GesNav';

const LOTE = 500; // tamaño de lote por request a POST /storage/bulk — soporta archivos grandes sin mandar todo en una sola petición.

// Carga real de bonos/boletas: BEET nunca inventa códigos, GES sube el
// Excel que le entrega el proveedor tal cual. Única columna obligatoria:
// `codigo` (alfanumérico). Nunca se manda fecha_vencimiento — la vigencia
// del beneficio la define la cooperativa al configurar el producto
// (cooperativa_productos.fecha_fin), no el código en Storage.
export default function ComprarBonos() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Carga de bonos y boletas' }]);
  const { push } = useToast();

  const [convenios, setConvenios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);
  const [convenioId, setConvenioId] = useState('');
  const [productoId, setProductoId] = useState('');

  const [estado, setEstado] = useState('idle'); // idle | leyendo | cargando | listo | error
  const [progreso, setProgreso] = useState({ lote: 0, totalLotes: 0, cargados: 0, total: 0 });
  const [resultadoError, setResultadoError] = useState('');

  useEffect(() => {
    Promise.all([convenioService.listarConvenios(), convenioService.listarProductos({})])
      .then(([c, p]) => {
        setConvenios(c);
        setProductos(p);
      })
      .finally(() => setLoadingCatalogo(false));
  }, []);

  const productosDelConvenio = productos.filter((p) => String(p.id_convenio) === String(convenioId));

  const handleConvenioChange = (id) => {
    setConvenioId(id);
    setProductoId('');
  };

  const parsearExcel = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.onload = (e) => {
        try {
          const libro = XLSX.read(e.target.result, { type: 'array' });
          const hoja = libro.Sheets[libro.SheetNames[0]];
          const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });
          if (filas.length === 0) throw new Error('El archivo está vacío.');
          const columnaCodigo = Object.keys(filas[0]).find((k) => k.trim().toLowerCase() === 'codigo');
          if (!columnaCodigo) throw new Error("El Excel debe tener una columna 'codigo'.");
          // Códigos alfanuméricos, tal cual vienen — nunca se generan, prefijan ni modifican.
          const codigos = filas
            .map((fila) => String(fila[columnaCodigo] ?? '').trim())
            .filter((codigo) => codigo.length > 0);
          if (codigos.length === 0) throw new Error("No se encontraron códigos en la columna 'codigo'.");
          resolve(codigos);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const handleFile = async (file) => {
    if (!productoId) {
      push({ title: 'Selecciona convenio y producto primero', variant: 'error' });
      return;
    }
    setResultadoError('');
    setEstado('leyendo');
    let codigos;
    try {
      codigos = await parsearExcel(file);
    } catch (err) {
      setEstado('error');
      setResultadoError(err.message);
      return;
    }

    const totalLotes = Math.ceil(codigos.length / LOTE);
    setEstado('cargando');
    setProgreso({ lote: 0, totalLotes, cargados: 0, total: codigos.length });

    for (let i = 0; i < totalLotes; i++) {
      const lote = codigos.slice(i * LOTE, (i + 1) * LOTE);
      try {
        // fecha_vencimiento SIEMPRE null — ver comentario del componente.
        await storageService.cargarCodigosEnLote({ idProducto: Number(productoId), codigos: lote, fechaVencimiento: null });
        setProgreso((p) => ({ ...p, lote: i + 1, cargados: p.cargados + lote.length }));
      } catch (err) {
        setEstado('error');
        setResultadoError(`Lote ${i + 1} de ${totalLotes} falló: ${err.message} — ${i * LOTE} código(s) ya se cargaron correctamente antes de este lote.`);
        return;
      }
    }
    setEstado('listo');
    push({ title: 'Códigos cargados', description: `${codigos.length} código(s) agregados a Storage.` });
  };

  const reiniciar = () => {
    setEstado('idle');
    setProgreso({ lote: 0, totalLotes: 0, cargados: 0, total: 0 });
    setResultadoError('');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Carga de bonos y boletas</h1>
          <p className="page-subtitle">Sube el Excel del proveedor tal cual — BEET no genera ni modifica códigos.</p>
        </div>
      </div>

      <GesNav />

      <Card padding="card-pad-lg">
        {loadingCatalogo ? (
          <LoadingState title="Cargando convenios y productos…" />
        ) : (
          <>
            <div className="grid grid-2" style={{ marginBottom: 18 }}>
              <Field label="Convenio">
                <Select value={convenioId} onChange={(e) => handleConvenioChange(e.target.value)} disabled={estado === 'leyendo' || estado === 'cargando'}>
                  <option value="">Selecciona un convenio…</option>
                  {convenios.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Producto">
                <Select
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                  disabled={!convenioId || productosDelConvenio.length === 0 || estado === 'leyendo' || estado === 'cargando'}
                >
                  <option value="">{productosDelConvenio.length === 0 ? 'Sin productos para este convenio' : 'Selecciona un producto…'}</option>
                  {productosDelConvenio.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Alert tone="info" title="Solo una columna obligatoria: 'codigo'">
              El Excel debe tener una columna llamada <code>codigo</code> con los códigos alfanuméricos reales del proveedor, uno por fila.
              No incluyas fecha de vencimiento — la vigencia la define cada cooperativa al configurar el producto.
            </Alert>

            <div style={{ marginTop: 16 }}>
              <FileUploader
                accept=".xlsx"
                hint={productoId ? 'Excel (.xlsx) con columna codigo' : 'Selecciona convenio y producto primero'}
                onFile={handleFile}
              />
            </div>

            {estado === 'leyendo' && <LoadingState title="Leyendo archivo…" />}

            {estado === 'cargando' && (
              <div style={{ marginTop: 16 }}>
                <div className="progress-track thin" style={{ marginBottom: 6 }}>
                  <div className="progress-fill green" style={{ width: `${(progreso.lote / progreso.totalLotes) * 100}%` }} />
                </div>
                <div className="text-small cell-muted">
                  Cargando lote {progreso.lote} de {progreso.totalLotes} — {progreso.cargados} de {progreso.total} código(s)…
                </div>
              </div>
            )}

            {estado === 'listo' && (
              <div style={{ marginTop: 16 }}>
                <Alert tone="success" title="Carga finalizada">
                  {progreso.total} código(s) agregados a Storage para este producto.
                </Alert>
              </div>
            )}

            {estado === 'error' && (
              <div style={{ marginTop: 16 }}>
                <Alert tone="error" title="No se pudo completar la carga">{resultadoError}</Alert>
              </div>
            )}

            {(estado === 'listo' || estado === 'error') && (
              <div style={{ marginTop: 12 }}>
                <button type="button" className="text-small" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--brand-primary)', fontWeight: 600 }} onClick={reiniciar}>
                  Cargar otro archivo
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
