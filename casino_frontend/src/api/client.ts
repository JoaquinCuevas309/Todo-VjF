/**
 * client.ts — Cliente HTTP con interceptores de seguridad.
 *
 * Interceptor de REQUEST:
 *   Inyecta automáticamente el header `Authorization: Bearer <token>`
 *   en cada petición que salga. El token proviene del tokenStore
 *   (módulo-nivel, no React state) para que funcione fuera del árbol
 *   de componentes sin hooks.
 *
 * Interceptor de RESPONSE:
 *   • Captura globalmente el 401 Unauthorized y emite el evento
 *     personalizado `casino:session-expired`, que el AuthContext
 *     escucha para ejecutar el logout sin acoplamiento circular.
 *   • Normaliza los errores de la API (detail/message) en un objeto
 *     ApiError estándar para que los componentes no interpreten la
 *     estructura raw de FastAPI.
 */

import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { tokenStore } from './tokenStore'

// ─── Evento de sesión expirada ────────────────────────────────────
export const SESSION_EXPIRED_EVENT = 'casino:session-expired' as const

// ─── Error normalizado ────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Instancia de Axios ───────────────────────────────────────────
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,   // true si el backend usa cookies httpOnly
})

// ─── Interceptor: REQUEST ─────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// ─── Interceptor: RESPONSE ────────────────────────────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ detail?: string | { msg: string }[] }>) => {
    const status = error.response?.status ?? 0

    // 401: token expirado o inválido → logout global
    if (status === 401) {
      tokenStore.clear()
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }

    // Normalizar el mensaje de error del backend (FastAPI usa `detail`)
    const rawDetail = error.response?.data?.detail
    let message = 'Error de comunicación con el servidor'

    if (typeof rawDetail === 'string') {
      message = rawDetail
    } else if (Array.isArray(rawDetail)) {
      // Errores de validación Pydantic: [{loc, msg, type}, ...]
      message = rawDetail.map((e) => e.msg).join('; ')
    } else if (error.message === 'Network Error') {
      message = 'No se puede conectar al servidor. Verifique la red.'
    } else if (error.code === 'ECONNABORTED') {
      message = 'La petición tardó demasiado. Intente nuevamente.'
    }

    return Promise.reject(new ApiError(status, message, rawDetail))
  },
)

export default apiClient
