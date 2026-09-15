import { useState } from 'react';
import { useSetBreadcrumbs } from '../../components/layout/breadcrumbs';
import { Card } from '../../components/ui/Card';
import { Field, Input, Select } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PROVEEDORES, crearSolicitudDesdeCooperativa } from './ges/gesData';

// Vista GES DENTRO del panel del administrador de cooperativa — NO es el
// panel completo de GES (eso vive en /ges, solo para GES y Súper admin).
// El administrador de cooperativa únicamente puede solicitar/comprar bonos
// o boletas a GES; no ve Storage, ni la lista de cooperativas de GES, ni
// las transacciones globales. Ver sección 13 de la definición funcional.
export default function ComprarBonosGes() {
  useSetBreadcrumbs([{ label: 'GES' }]);
  const { currentUser, cooperativaId, nombreEntidad } = useAuth();
  const { push } = useToast();

  const [proveedorId, setProveedorId] = useState(PROVEEDORES[0]?.id ?? '');
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ultimaSolicitud, setUltimaSolicitud] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const n = Number(cantidad);
    if (!cantidad || n <= 0) {
      setError('La cantidad debe ser mayor a 0.');
      return;
    }
    setEnviando(true);
    try {
      const solicitud = crearSolicitudDesdeCooperativa({
        cooperativaId,
        proveedorId,
        cantidad: n,
        administrador: currentUser.nombre,
        formaPago: 'Cupo',
      });
      setUltimaSolicitud(solicitud);
      setCantidad('');
      push({ title: 'Solicitud enviada a GES', description: `${n.toLocaleString('es-CO')} unidades de ${PROVEEDORES.find((p) => p.id === proveedorId)?.nombre}.` });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-h1 page-title">Comprar bonos / boletas a GES</h1>
          <p className="page-subtitle">Solicita a GES que asigne inventario a {nombreEntidad} desde su Storage central.</p>
        </div>
      </div>

      <Card padding="card-pad-lg" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit}>
          <Field label="Convenio">
            <Select value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setError(''); }}>
              {PROVEEDORES.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cantidad" error={error}>
            <Input type="number" min="1" value={cantidad} onChange={(e) => { setCantidad(e.target.value); setError(''); }} placeholder="1000" />
          </Field>
          <Button type="submit" loading={enviando}>Solicitar</Button>
        </form>

        {ultimaSolicitud && (
          <div style={{ marginTop: 20 }}>
            <Alert tone="success" title="Solicitud registrada">
              Tu solicitud quedó en estado Pendiente. GES la revisará y asignará el inventario a {nombreEntidad}.
            </Alert>
          </div>
        )}

        <p className="text-caption cell-muted" style={{ marginTop: 20 }}>
          El proceso comercial (crédito, bolsa, pasarela de pago) todavía no está definido — esta solicitud es solo una
          simulación visual del flujo cooperativa → GES.
        </p>
      </Card>
    </div>
  );
}
