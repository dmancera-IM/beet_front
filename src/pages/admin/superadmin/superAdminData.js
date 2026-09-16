// Agregaciones 100% mock para el Dashboard panorámico de Súper admin
// (sección 6-11 de la definición funcional). Lee directamente los mismos
// arrays en memoria que ya usa el resto del panel de cooperativa
// (services/mockDb.js) y, para cupo/Storage, el mock aislado de GES — Súper
// admin es el único rol que puede ver ambos mundos a la vez (sección 13).
// No hace ningún fetch ni crea endpoints nuevos: es una lectura síncrona,
// igual que pages/admin/ges/gesData.js.
import { cooperativas, afiliados, cooperativasConvenios, productosConvenio, unidadesInventario, transacciones } from '../../../services/mockDb';
import { getCooperativas as getCooperativasGes } from '../ges/gesData';

function cupoDeCooperativa(cooperativaId) {
  const c = getCooperativasGes().find((g) => g.id === cooperativaId);
  return { cupoDisponible: c?.cupoDisponible ?? 0, cupoGastado: c?.cupoGastado ?? 0 };
}

function afiliadosDe(cooperativaId) {
  return afiliados.filter((a) => a.id_cooperativa === cooperativaId);
}

function ventasDe(idsAfiliados) {
  return transacciones
    .filter((t) => idsAfiliados.has(t.afiliado_id) && t.estado === 'COMPLETADA')
    .reduce((sum, t) => sum + t.total, 0);
}

export function getResumenGlobal() {
  const cooperativasActivas = cooperativas.filter((c) => c.estado).length;
  const transaccionesCompletadas = transacciones.filter((t) => t.estado === 'COMPLETADA');
  const bonosVendidos = transaccionesCompletadas.reduce((sum, t) => sum + t.cantidad, 0);
  const inventarioDisponible = unidadesInventario.filter((u) => u.estado === 'DISPONIBLE').length;
  // BEET no controla la redención del bono (sección 13): "vendido" aquí
  // solo significa que ya fue entregado al afiliado, nunca "usado/redimido".
  const inventarioVendido = unidadesInventario.filter((u) => u.estado === 'ENTREGADA').length;
  const solicitudesPendientes = getCooperativasGes().reduce((sum, c) => sum + c.solicitudesPendientes, 0);

  return {
    cooperativas: cooperativas.length,
    cooperativasActivas,
    afiliados: afiliados.length,
    bonosVendidos,
    inventarioTotal: unidadesInventario.length,
    inventarioDisponible,
    inventarioVendido,
    solicitudesPendientes,
    transacciones: transacciones.length,
  };
}

export function getVentasPorCooperativa() {
  return cooperativas.map((c) => {
    const afiliadosCoop = afiliadosDe(c.id);
    const idsAfiliados = new Set(afiliadosCoop.map((a) => a.id));
    return { id: c.id, nombre: c.nombre, ventas: ventasDe(idsAfiliados), afiliados: afiliadosCoop.length };
  });
}

export function getConveniosMasUtilizados() {
  const cantidadPorProducto = {};
  transacciones
    .filter((t) => t.estado === 'COMPLETADA')
    .forEach((t) => {
      cantidadPorProducto[t.id_producto] = (cantidadPorProducto[t.id_producto] ?? 0) + t.cantidad;
    });
  return Object.entries(cantidadPorProducto)
    .map(([productoId, cantidad]) => {
      // Un producto pertenece a un convenio (sección 7) — la fila
      // cooperativas_convenios que lo habilitó es lo que trae el nombre
      // comercial que ve el afiliado.
      const producto = productosConvenio.find((p) => p.id === Number(productoId)) ?? null;
      const cc = producto ? cooperativasConvenios.find((c) => c.id_convenio === producto.id_convenio) : null;
      return {
        id: Number(productoId),
        nombre: cc && producto ? `${cc.nombre} · ${producto.nombre}` : `Producto ${productoId}`,
        cantidad,
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad);
}

export function getResumenCooperativas() {
  return cooperativas.map((c) => {
    const afiliadosCoop = afiliadosDe(c.id);
    const idsAfiliados = new Set(afiliadosCoop.map((a) => a.id));
    const conveniosCoop = cooperativasConvenios.filter((cv) => cv.id_cooperativa === c.id);
    const { cupoDisponible, cupoGastado } = cupoDeCooperativa(c.id);
    return {
      id: c.id,
      nombre: c.nombre,
      estado: c.estado,
      afiliados: afiliadosCoop.length,
      conveniosActivos: conveniosCoop.filter((cv) => cv.estado).length,
      inventario: unidadesInventario.filter((u) => u.id_cooperativa === c.id).length,
      ventas: ventasDe(idsAfiliados),
      cupoDisponible,
      cupoGastado,
    };
  });
}
