/**
 * usePOS — Toda la lógica del Punto de Venta, desacoplada del DOM.
 *
 * Responsabilidades:
 *  • Proveer el menú del día (mock → en producción: llamada GET /menus?service_date=today)
 *  • Procesar transacciones con anti-doble-submit
 *  • Mantener el historial local de las últimas 10 entregas
 *  • Gestionar las notificaciones de éxito/error
 */

import { useCallback, useRef, useState } from 'react'
import { transactionService, resolveTransactionError } from '@/services/transactions'
import type {
  MenuOfDay,
  PaymentMethod,
  RecentEntry,
  TransactionPayload,
  Notification,
} from '../types'

// ── Datos de ejemplo del menú de hoy ─────────────────────────────────
// En producción: reemplazar por → menus.service.getToday()
const TODAY = new Date().toISOString().split('T')[0]

export const MOCK_MENU_TODAY: MenuOfDay = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Almuerzo Estándar',
  service_date: TODAY,
  description: 'Menú institucional del día',
  price: 3500,
  max_portions: 100,
  served_portions: 37,
  is_active: true,
  items: [
    { id: '1', name: 'Crema de choclo',          category: 'entrada'  },
    { id: '2', name: 'Pollo al horno con arroz', category: 'fondo'    },
    { id: '3', name: 'Ensalada mixta',           category: 'ensalada' },
    { id: '4', name: 'Fruta del tiempo',         category: 'postre'   },
  ],
}

const MAX_RECENT = 10

export function usePOS() {
  const [menu, setMenu]                   = useState<MenuOfDay>(MOCK_MENU_TODAY)
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [notification, setNotification]  = useState<Notification | null>(null)

  // Ref para el flag anti-doble-submit (más rápido que useState para esta guardia)
  const submittingRef = useRef(false)
  // useState para actualizar la UI (disabled del botón)
  const [isSubmitting, setIsSubmitting]   = useState(false)

  // Timer para auto-cerrar la notificación de éxito
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearNotification = useCallback(() => {
    if (notifTimer.current) clearTimeout(notifTimer.current)
    setNotification(null)
  }, [])

  const showNotification = useCallback(
    (notif: Notification, autoDismiss?: number) => {
      if (notifTimer.current) clearTimeout(notifTimer.current)
      setNotification(notif)
      if (autoDismiss) {
        notifTimer.current = setTimeout(() => setNotification(null), autoDismiss)
      }
    },
    [],
  )

  /**
   * Registrar una entrega.
   * Retorna `true` si fue exitosa (el componente puede limpiar el form).
   */
  const processDelivery = useCallback(
    async (
      identifier: { type: 'qr'; value: string } | { type: 'rut'; value: string },
      paymentMethod: PaymentMethod,
    ): Promise<boolean> => {
      // ── Guardia anti-doble-submit ─────────────────────────────────
      if (submittingRef.current) return false
      submittingRef.current = true
      setIsSubmitting(true)
      clearNotification()

      const payload: TransactionPayload = {
        menu_id: menu.id,
        payment_method: paymentMethod,
        amount: paymentMethod === 'free' ? 0 : menu.price,
        ...(identifier.type === 'qr'
          ? { qr_token: identifier.value }
          : { user_rut: identifier.value }),
      }

      let success = false

      try {
        const result = await transactionService.create(payload)

        // Actualizar contador local de porciones (sin esperar refetch)
        setMenu((prev) => ({
          ...prev,
          served_portions: Math.min(prev.served_portions + 1, prev.max_portions),
        }))

        setRecentEntries((prev) =>
          [
            {
              id: result.id,
              identifier: identifier.value,
              identifierType: identifier.type,
              paymentMethod,
              amount: payload.amount,
              status: 'success' as const,
              timestamp: new Date(),
            } satisfies RecentEntry,
            ...prev,
          ].slice(0, MAX_RECENT),
        )

        showNotification(
          { type: 'success', message: 'Entrega registrada correctamente.' },
          2500,
        )
        success = true
      } catch (err) {
        const msg = resolveTransactionError(err)

        setRecentEntries((prev) =>
          [
            {
              id: crypto.randomUUID(),
              identifier: identifier.value,
              identifierType: identifier.type,
              paymentMethod,
              amount: payload.amount,
              status: 'error' as const,
              errorMsg: msg,
              timestamp: new Date(),
            } satisfies RecentEntry,
            ...prev,
          ].slice(0, MAX_RECENT),
        )

        showNotification({ type: 'error', message: msg })
      } finally {
        submittingRef.current = false
        setIsSubmitting(false)
      }

      return success
    },
    [menu, clearNotification, showNotification],
  )

  return {
    menu,
    recentEntries,
    isSubmitting,
    notification,
    clearNotification,
    processDelivery,
  } as const
}
