// Almacenamiento de la cuenta de pago (pagos con tarjeta) de cada entidad
// (ADMIN → Configuración → Pagos). Todavía no existe integración real con
// una pasarela de pagos, así que esto es 100% mock/visual: nunca se pide ni
// se guarda número de tarjeta real, CVV, contraseñas ni credenciales
// bancarias — solo un proveedor (dato mock) y los últimos 4 dígitos de una
// cuenta ficticia, igual que logoStore.js usa localStorage con una llave
// por entidad para que la configuración sobreviva a recargas de página. La
// cuenta pertenece a la entidad (id_cooperativa), nunca al afiliado.
// Cuando exista integración real con una pasarela, esto se reemplaza por el
// registro real en backend — la API de este módulo no debería tener que
// cambiar.

const PREFIX = 'beetticket_cuenta_pago_cooperativa_';

export function getCuentaPago(cooperativaId) {
  if (!cooperativaId) return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${cooperativaId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCuentaPago(cooperativaId, { proveedor, ultimosDigitos }) {
  if (!cooperativaId) return null;
  const cuenta = { proveedor, ultimosDigitos, configuradaEn: new Date().toISOString() };
  try {
    localStorage.setItem(`${PREFIX}${cooperativaId}`, JSON.stringify(cuenta));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota llena, etc.) — la
    // configuración simplemente no persiste; no es un error bloqueante.
  }
  return cuenta;
}

// Comisión que BEET cobra a la entidad por usar la infraestructura de pagos
// con tarjeta de BEET. Es un dato de solo lectura para el ADMIN: lo
// configura/controla BEET/GES, no cada entidad. Valor mock temporal —
// reemplazar cuando exista un porcentaje definitivo del lado de BEET/GES.
export const COMISION_BEET_PAGOS = 2.5; // TODO: reemplazar por el porcentaje real definido por BEET/GES
