import api, { ApiError } from '@/api/axios'
import type { TransactionPayload, TransactionResult } from '@/features/pos/types'

export const transactionService = {
  /**
   * POST /transactions — Registra una entrega en el POS.
   *
   * El backend extrae operator_id del JWT automáticamente;
   * el cliente NUNCA envía ese campo.
   *
   * @throws {ApiError} 404 → comensal no encontrado
   * @throws {ApiError} 403 → comensal desactivado
   * @throws {ApiError} 409 → sin porciones / QR ya usado / menú inactivo
   * @throws {ApiError} 429 → rate limit del endpoint
   */
  async create(payload: TransactionPayload): Promise<TransactionResult> {
    const { data } = await api.post<TransactionResult>('/transactions', payload)
    return data
  },
}

/**
 * Convierte un ApiError en un mensaje amigable para el cajero.
 * Cada código HTTP/descripción tiene un texto de acción claro.
 */
export function resolveTransactionError(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Error inesperado. Intente nuevamente.'

  const detail = String(err.detail ?? '').toLowerCase()

  switch (err.status) {
    case 404:
      return 'Comensal no encontrado en el sistema. Verifique el RUT o QR.'
    case 403:
      return 'La cuenta de este comensal está desactivada. Contacte a administración.'
    case 409:
      if (detail.includes('porcion') || detail.includes('concurrencia'))
        return '⚠ Sin porciones disponibles para este menú.'
      if (detail.includes('reserva') || detail.includes('utilizada') || detail.includes('consumed'))
        return '⚠ Este QR ya fue utilizado o la reserva está inactiva.'
      if (detail.includes('activo') || detail.includes('inactivo'))
        return 'El menú no está activo en este momento.'
      return 'Conflicto al procesar la entrega. Intente de nuevo.'
    case 422:
      return 'Datos inválidos. Verifique el RUT o token QR.'
    case 429:
      return 'Demasiadas peticiones. Espere unos segundos e intente de nuevo.'
    case 0:
      return 'Sin conexión al servidor. Verifique la red.'
    default:
      return err.message || 'Error al registrar la entrega.'
  }
}
