// Agregaciones 100% mock para el Dashboard panorámico de Súper admin
// (sección 6-11 de la definición funcional). Lee directamente los mismos
// arrays en memoria que ya usa el resto del panel de cooperativa
// (services/mockDb.js) y, para cupo/Storage, el mock aislado de GES — Súper
// admin es el único rol que puede ver ambos mundos a la vez (sección 13).
// No hace ningún fetch ni crea endpoints nuevos: es una lectura síncrona,
// igual que pages/admin/ges/gesData.js.
import { cooperativas, afiliados, cooperativasConvenios, productosConvenio, unidadesInventario, transacciones } from '../../../services/mockDb';
import { creditoDisponible, getCooperativas as getCooperativasGes } from '../ges/gesData';

// Súper admin sigue viendo el CUPO DE CRÉDITO de cada cooperativa (mismos
// nombres de campo que ya usaba esta pantalla, `cupoDisponible`/
// `cupoGastado`) — ahora calculados desde `credito.cupoAutorizado`/
// `credito.utilizado` con `creditoDisponible()`, que conviven de forma
// independiente con `bolsa` (ver gesData.js). No se muestra la bolsa aquí
// para no rediseñar esta pantalla, fuera de alcance de esta ronda.
function cupoDeCooperativa(cooperativaId) {
  const c = getCooperativasGes().find((g) => g.id === cooperativaId);
  return { cupoDisponible: creditoDisponible(c?.credito), cupoGastado: c?.credito?.utilizado ?? 0 };
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

// Métricas de afiliados/compras para SUPER_ADMIN → Afiliados (secciones 10
// y 11 de la ronda de ajustes). GLOBAL (todas las entidades) cuando no se
// pasa `cooperativaId`; scoped a una sola entidad cuando sí se pasa — el
// selector de entidad del header realmente filtra estos datos, no es solo
// visual. Reutiliza los mismos arrays que el resto del panorama, nada
// inventado fuera de afiliados/compras/convenios.
export function getMetricasAfiliados(cooperativaId = null) {
  const universoAfiliados = cooperativaId ? afiliadosDe(cooperativaId) : afiliados;
  const idsAfiliados = new Set(universoAfiliados.map((a) => a.id));
  const activos = universoAfiliados.filter((a) => a.estado).length;

  const porEntidad = cooperativaId
    ? []
    : cooperativas.map((c) => ({ id: c.id, nombre: c.nombre, afiliados: afiliadosDe(c.id).length }));

  const transaccionesUniverso = transacciones.filter((t) => idsAfiliados.has(t.afiliado_id) && t.estado === 'COMPLETADA');
  const cantidadCompras = transaccionesUniverso.length;
  const valorCompras = transaccionesUniverso.reduce((sum, t) => sum + t.total, 0);

  const cantidadPorProducto = {};
  transaccionesUniverso.forEach((t) => {
    cantidadPorProducto[t.id_producto] = (cantidadPorProducto[t.id_producto] ?? 0) + t.cantidad;
  });
  const productosMasComprados = Object.entries(cantidadPorProducto)
    .map(([productoId, cantidad]) => {
      const producto = productosConvenio.find((p) => p.id === Number(productoId)) ?? null;
      const cc = producto ? cooperativasConvenios.find((c) => c.id_convenio === producto.id_convenio) : null;
      return { id: Number(productoId), nombre: cc && producto ? `${cc.nombre} · ${producto.nombre}` : `Producto ${productoId}`, cantidad };
    })
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  return {
    totalAfiliados: universoAfiliados.length,
    activos,
    inactivos: universoAfiliados.length - activos,
    porEntidad,
    cantidadCompras,
    valorCompras,
    productosMasComprados,
  };
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
