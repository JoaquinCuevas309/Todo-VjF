/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  src/api/axios.ts — Cliente HTTP con interceptores de seguridad  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * INTERCEPTOR DE REQUEST
 * ─────────────────────
 * Lee el JWT del tokenStore (módulo-nivel, no React state) e inyecta
 *   Authorization: Bearer <token>
 * en cada petición saliente. Funciona fuera del árbol React sin hooks.
 *
 * INTERCEPTOR DE RESPONSE
 * ───────────────────────
 * • 401 → limpia el token + dispara CustomEvent → el AuthContext hace
 *   logout automático y redirige a /login sin acoplamiento circular.
 * • Normaliza errores FastAPI: { detail: string | ValidationError[] }
 *   → ApiError unificado para que los componentes no parseen raw JSON.
 *
 * ANTI-DOS
 * ────────
 * Timeout de 15 s por petición. Las rutas de reportes tienen su propio
 * timeout extendido (ver reportService.ts).
 */

import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { tokenStore } from './tokenStore'

// ── Evento global de sesión expirada ─────────────────────────────────
export const SESSION_EXPIRED_EVENT = 'casino:session-expired' as const

// ── Error normalizado de la API ──────────────────────────────────────
export class ApiError extends Error {
  /** HTTP status code (0 = error de red) */
  public readonly status: number
  /** Detalle raw del backend (para logging interno, nunca mostrar al usuario) */
  public readonly detail?: unknown

  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// ── Instancia Axios ──────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // Header personalizado para identificar al cliente PWA
    'X-Client': 'casino-pwa/1.0',
  },
  withCredentials: false, // true cuando el backend use refresh-token httpOnly cookies
})

// ── Interceptor: REQUEST ─────────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.get()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// ── Interceptor: RESPONSE ────────────────────────────────────────────
api.interceptors.response.use(
  (response: AxiosResponse) => response,

  (error: AxiosError<FastApiErrorBody>) => {
    const status = error.response?.status ?? 0

    // ① Token expirado o inválido → logout global
    if (status === 401) {
      tokenStore.clear()
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }

    // ② Normalizar el cuerpo de error de FastAPI
    const raw = error.response?.data?.detail
    const message = resolveMessage(raw, error)

    return Promise.reject(new ApiError(status, message, raw))
  },
)

// ── Tipos auxiliares ─────────────────────────────────────────────────
interface FastApiErrorBody {
  detail?: string | PydanticError[]
}
interface PydanticError {
  msg: string
  loc?: string[]
  type?: string
}

function resolveMessage(
  detail: FastApiErrorBody['detail'],
  error: AxiosError,
): string {
  if (typeof detail === 'string' && detail.length > 0) {
    return detail
  }
  if (Array.isArray(detail) && detail.length > 0) {
    // Errores de validación Pydantic: unir mensajes sin exponer estructura interna
    return detail.map((e) => e.msg).join(' · ')
  }
  if (error.code === 'ECONNABORTED') {
    return 'La petición tardó demasiado. Verifique su conexión.'
  }
  if (error.message === 'Network Error') {
    return 'No se puede conectar al servidor. Verifique la red.'
  }
  return 'Error inesperado. Intente nuevamente.'
}

export default api
