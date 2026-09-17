import { IconCheckSmall, IconClose, IconWarningTriangle } from './Icons';

export function Badge({ tone = 'neutral', dot = false, icon = null, children }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {icon}
      {children}
    </span>
  );
}

// Maps the five inventory states + transaction/affiliate states from the
// functional spec to a fixed badge, so the same status always looks the same
// everywhere in the app.
const STATUS_MAP = {
  // Inventario
  Disponible: { tone: 'green', dot: true },
  Reservado: { tone: 'blue', dot: true },
  Entregado: { tone: 'blue-solid', icon: <IconCheckSmall color="var(--brand-primary)" /> },
  Utilizado: { tone: 'neutral', dot: true },
  'Próximo a vencer': { tone: 'amber', icon: <IconWarningTriangle size={12} color="var(--warning)" /> },
  Cancelado: { tone: 'red', icon: <IconClose color="var(--error)" /> },
  Vencido: { tone: 'vencido' },
  // Transacciones
  Procesando: { tone: 'blue', spinner: true },
  Rechazado: { tone: 'red', icon: <IconClose color="var(--error)" /> },
  // Afiliados / cupos
  activo: { tone: 'green', dot: true, label: 'Activo' },
  retirado: { tone: 'neutral', dot: true, label: 'Retirado' },
  suspendido: { tone: 'amber', label: 'Suspendido' },
  inactivo: { tone: 'neutral', dot: true, label: 'Inactivo' },
  // unidades_inventario.estado (sección 12 del modelo) — solo estos tres
  // existen; BEET no controla la redención del bono, así que no hay un
  // estado "utilizado/redimida" (sección 13), y tampoco existe un estado
  // "bloqueada" en la interfaz.
  DISPONIBLE: { tone: 'green', dot: true, label: 'Disponible' },
  ENTREGADA: { tone: 'blue-solid', icon: <IconCheckSmall color="var(--brand-primary)" />, label: 'Entregada' },
  VENCIDA: { tone: 'vencido', label: 'Vencida' },
  ASIGNADO: { tone: 'blue-solid', icon: <IconCheckSmall color="var(--brand-primary)" />, label: 'Asignado' },
  // transacciones.estado (sección 11) — únicamente estos dos: no hay
  // aprobar/rechazar manual.
  PENDIENTE: { tone: 'blue', spinner: true, label: 'Pendiente' },
  COMPLETADA: { tone: 'blue-solid', icon: <IconCheckSmall color="var(--brand-primary)" />, label: 'Completada' },
  // documentos_asuncion_deuda.estado
  FIRMADO: { tone: 'green', dot: true, label: 'Firmado' },
  CANCELADO: { tone: 'red', icon: <IconClose color="var(--error)" />, label: 'Cancelado' },
  // GES — estado de cooperativa (title case, distinto de activo/inactivo
  // booleano de otras entidades porque acá existe un tercer estado real:
  // "Pendiente" mientras el convenio con la cooperativa se formaliza).
  Activa: { tone: 'green', dot: true, label: 'Activa' },
  Pendiente: { tone: 'blue', spinner: true, label: 'Pendiente' },
  Inactiva: { tone: 'neutral', dot: true, label: 'Inactiva' },
  // GES — estado de una unidad/lote de inventario central.
  Asignada: { tone: 'blue-solid', icon: <IconCheckSmall color="var(--brand-primary)" />, label: 'Asignada' },
  Agotada: { tone: 'amber', icon: <IconWarningTriangle size={12} color="var(--warning)" />, label: 'Agotada' },
  // GES — estado de una transacción GES↔cooperativa (título, distinto del
  // PENDIENTE/COMPLETADA en mayúsculas del backend real): representa si
  // GES ya tiene inventario suficiente para completar la operación.
  Completada: { tone: 'blue-solid', icon: <IconCheckSmall color="var(--brand-primary)" />, label: 'Completada' },
};

export function StatusBadge({ status }) {
  // usuarios_admin/afiliados/convenios/cupos_credito/plantillas.estado are
  // plain PostgreSQL booleans in the real schema (not a string enum) — map
  // true/false to the existing activo/inactivo badge look.
  if (typeof status === 'boolean') status = status ? 'activo' : 'inactivo';
  const cfg = STATUS_MAP[status] ?? { tone: 'neutral' };
  const toneClass = cfg.tone === 'blue-solid' ? 'blue-solid' : cfg.tone;
  return (
    <span className={`badge badge-${toneClass}`}>
      {cfg.dot && <span className="badge-dot" />}
      {cfg.spinner && (
        <span
          style={{
            width: 9,
            height: 9,
            border: '1.8px solid var(--brand-primary)',
            borderTopColor: 'transparent',
            borderRadius: 999,
            display: 'inline-block',
            animation: 'beetSpin 0.8s linear infinite',
          }}
        />
      )}
      {cfg.icon}
      {cfg.label ?? status}
    </span>
  );
}

export function RoleBadge({ role }) {
  if (role === 'Súper administrador') return <Badge tone="brand-solid">Súper admin</Badge>;
  if (role === 'GES') return <Badge tone="green">GES</Badge>;
  if (role === 'Administrador') return <Badge tone="blue">Administrador</Badge>;
  return <Badge tone="outline">Lector</Badge>;
}
