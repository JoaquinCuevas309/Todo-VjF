/**
 * useLogin — Hook que encapsula la lógica de envío del formulario.
 *
 * Responsabilidades:
 *  - Llamar a authService.login()
 *  - Gestionar los estados: idle | loading | success | error
 *  - Proporcionar el estado visual del indicador de la tarjeta
 *  - NO saber nada del DOM — la vista lo consume
 */

import { useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService } from '@/services/auth'
import { ApiError } from '@/api/axios'
import { useAuth } from '@/hooks/useAuth'
import type { LoginFormData } from '../schemas/loginSchema'

export type CardStatus = 'idle' | 'loading' | 'success' | 'error'

/** Color del borde lateral de la tarjeta según el estado. */
export const CARD_STATUS_COLOR: Record<CardStatus, string> = {
  idle:    'rgba(245,158,11,0.55)',
  loading: 'rgba(245,158,11,0.9)',
  success: 'rgba(52,211,153,0.85)',
  error:   'rgba(248,113,113,0.7)',
}

export function useLogin() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const location     = useLocation()
  const redirectTo   = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  const [cardStatus, setCardStatus] = useState<CardStatus>('idle')
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  const onSubmit = useCallback(
    async (data: LoginFormData, resetPasswordField: () => void) => {
      // Previene doble-submit
      if (cardStatus === 'loading') return

      setErrorMsg(null)
      setCardStatus('loading')

      try {
        const { access_token } = await authService.login(data)

        setCardStatus('success')
        login(access_token)

        // Pequeña pausa para que el usuario vea el estado "✓ Acceso concedido"
        setTimeout(() => navigate(redirectTo, { replace: true }), 650)
      } catch (err) {
        setCardStatus('error')

        // ── Mensajes genéricos — sin revelar si el usuario existe ──────
        if (err instanceof ApiError) {
          switch (err.status) {
            case 429:
              setErrorMsg('Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente en 15 minutos.')
              break
            case 0:
              setErrorMsg('Sin conexión con el servidor. Verifique su red e intente de nuevo.')
              break
            default:
              // 401, 403, 422 → mismo mensaje genérico (previene enumeración de usuarios)
              setErrorMsg('Credenciales inválidas. Verifique su información e intente de nuevo.')
          }
        } else {
          setErrorMsg('Error inesperado. Intente nuevamente.')
        }

        // Limpiar el campo contraseña en cualquier error
        resetPasswordField()

        // Volver a idle después de mostrar el error
        setTimeout(() => setCardStatus('idle'), 4_000)
      }
    },
    [cardStatus, login, navigate, redirectTo],
  )

  return { onSubmit, cardStatus, errorMsg } as const
}
