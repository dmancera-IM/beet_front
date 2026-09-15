import { useState } from 'react';
import { useSetBreadcrumbs } from '../../../components/layout/breadcrumbs';
import { KpiCard } from '../../../components/ui/Card';
import { Field, Input, Select } from '../../../components/ui/Field';
import { IconBuscar, IconClose, IconPlus } from '../../../components/ui/Icons';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import FileUploader from '../../../components/ui/FileUploader';
import { EmptyState } from '../../../components/ui/States';
import { useTableState } from '../../../hooks/useTableState';
import { useToast } from '../../../context/ToastContext';
import GesNav from './GesNav';
import { getAsignacionesPorProveedor, getInventarioCentral, getProveedores } from './gesData';

// STORAGE: el almacenamiento central de GES — qué bonos/boletas tiene
// disponibles para asignar a las cooperativas, y cuánto ya asignó. Distinto
// del inventario que cada cooperativa recibe (eso vive en
// pages/admin/cooperativa/Inventario.jsx) — GES nunca mezcla ambas vistas.
export default function Storage() {
  useSetBreadcrumbs([{ label: 'GES', to: '/ges' }, { label: 'Storage' }]);
  const { push } = useToast();

  const storage = getInventarioCentral();
  const [detalle, setDetalle] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [proveedorId, setProveedorId] = useState('');
  const [xmlFile, setXmlFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const { search, setSearch, pageRows, total } = useTableState({
    data: storage,
    searchFields: ['proveedor'],
    pageSize: 50,
  });

  const totalDisponible = storage.reduce((s, i) => s + i.disponible, 0);
  const totalAsignado = storage.reduce((s, i) => s + i.asignado, 0);

  const cerrarForm = () => {
    if (saving) return;
    setFormOpen(false);
    setProveedorId('');
    setXmlFile(null);
  };

  const abrirForm = () => {
    setProveedorId(getProveedores()[0]?.id ?? '');
    setXmlFile(null);
    setFormOpen(true);
  };

  const handleFile = (file) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      push({ title: 'Archivo no válido', description: 'Solo se aceptan archivos .xml.', variant: 'error' });
      return;
    }
    setXmlFile(file);
  };

  // Simulación visual únicamente: no se procesa el XML, no se conecta con
  // ningún proveedor y no se modifica el inventario real de Storage. Los
  // proveedores (Cine Colombia, Mundo Aventura, Éxito, etc.) entregarán más
  // adelante estos archivos con la información real de bonos/boletas.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!proveedorId || !xmlFile) return;
    const nombreConvenio = getProveedores().find((p) => p.id === proveedorId)?.nombre ?? '';
    setSaving(true);
    setTimeout(() => {
      push({ title: 'XML cargado', description: `${xmlFile.name} se procesó correctamente para ${nombreConvenio} (simulación).` });
      setSaving(false);
      cerrarForm();
    }, 600);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Storage</h1>
          <p className="page-subtitle">Qué tiene GES disponible, cuánto ha asignado a cooperativas y cuánto le queda por convenio.</p>
        </div>
        <div className="page-header-actions">
          <Button icon={<IconPlus color="#fff" />} onClick={abrirForm}>Agregar storage</Button>
        </div>
      </div>

      <GesNav />

      <div className="grid grid-kpi section-gap">
        <KpiCard label="Disponible" value={totalDisponible.toLocaleString('es-CO')} deltaTone="neutral" delta="Listo para asignar" />
        <KpiCard label="Compradas" value={totalAsignado.toLocaleString('es-CO')} deltaTone="neutral" delta="Entregado a cooperativas" />
        <KpiCard label="Total" value={(totalDisponible + totalAsignado).toLocaleString('es-CO')} deltaTone="neutral" delta="En Storage" />
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <label className="input-affix-wrap" style={{ width: 260 }}>
              <span className="input-affix-icon"><IconBuscar size={16} color="var(--text-muted)" /></span>
              <Input placeholder="Buscar convenio o proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>

        {pageRows.length === 0 ? (
          total === 0 ? (
            <EmptyState title="Sin bonos/boletas en Storage" description="El inventario que GES reciba de sus proveedores aparecerá aquí." />
          ) : (
            <EmptyState title="Sin resultados" description="Ajusta el término de búsqueda." />
          )
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Convenio</th>
                  <th className="right">Disponibles</th>
                  <th className="right">Asignados</th>
                  <th className="right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((i) => (
                  <tr key={i.proveedorId}>
                    <td className="cell-primary">{i.proveedor}</td>
                    <td className="right tabular">{i.disponible.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{i.asignado.toLocaleString('es-CO')}</td>
                    <td className="right tabular">{i.total.toLocaleString('es-CO')}</td>
                    <td className="right"><Button size="sm" variant="secondary" onClick={() => setDetalle(i)}>Ver detalle</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title={detalle ? `Storage · ${detalle.proveedor}` : ''}
        actions={<Button variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}
      >
        {detalle && (
          <div>
            <div className="grid grid-3" style={{ marginBottom: 18 }}>
              <div>
                <div className="text-label">Disponible</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 600 }}>{detalle.disponible.toLocaleString('es-CO')}</div>
              </div>
              <div>
                <div className="text-label">Asignado</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 600 }}>{detalle.asignado.toLocaleString('es-CO')}</div>
              </div>
              <div>
                <div className="text-label">Total</div>
                <div className="tabular" style={{ fontSize: 18, fontWeight: 600 }}>{detalle.total.toLocaleString('es-CO')}</div>
              </div>
            </div>
            <div className="text-label" style={{ marginBottom: 10 }}>Asignado por cooperativa</div>
            {getAsignacionesPorProveedor(detalle.proveedorId).length === 0 ? (
              <div className="text-small cell-muted">Todavía no se ha asignado inventario de este convenio.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {getAsignacionesPorProveedor(detalle.proveedorId).map((a) => (
                  <div key={a.cooperativaId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{a.cooperativaNombre}</span>
                    <span className="tabular">{a.cantidad.toLocaleString('es-CO')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={cerrarForm}
        title="Agregar storage"
        actions={
          <>
            <Button variant="secondary" onClick={cerrarForm} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={saving} disabled={!proveedorId || !xmlFile}>Cargar XML</Button>
          </>
        }
      >
        <p className="text-caption cell-muted" style={{ marginTop: 0 }}>
          Los proveedores (Cine Colombia, Mundo Aventura, Éxito y otros) entregarán un archivo XML con la información de
          los bonos/boletas. Por ahora esta carga es solo una simulación visual — no se procesa el contenido.
        </p>
        <Field label="Convenio">
          <Select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            {getProveedores().map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </Field>
        {!xmlFile ? (
          <FileUploader
            label="Arrastra aquí el archivo XML"
            hint="o Seleccionar archivo · solo .xml"
            accept=".xml"
            onFile={handleFile}
          />
        ) : (
          <div className="table-card" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{xmlFile.name}</div>
              <div className="text-caption">Archivo seleccionado</div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<IconClose size={14} color="#1F2937" />}
              onClick={() => setXmlFile(null)}
              disabled={saving}
            >
              Quitar
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
