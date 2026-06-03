import { useState, useId } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { loginSchema, type LoginFormData } from './schemas'
import { authApi } from '@/api/auth.api'
import { ApiError } from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

// ─── Ícono de advertencia inline (sin dependencias de iconos) ─────
const WarnIcon = () => (
  <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const EyeIcon = ({ open }: { open: boolean }) => (
  open ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
)

// ─── Decoración: línea de separación con texto ────────────────────
const Divider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-6">
    <div className="flex-1 h-px bg-ci-line" />
    <span className="text-[10px] font-mono tracking-[0.3em] text-ci-muted uppercase">{label}</span>
    <div className="flex-1 h-px bg-ci-line" />
  </div>
)

// ─── Badge de estado del sistema ──────────────────────────────────
const SystemStatus = () => (
  <div className="flex items-center gap-2">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ci-success opacity-50" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-ci-success" />
    </span>
    <span className="font-mono text-[10px] tracking-[0.25em] text-ci-muted uppercase">
      Sistema en línea
    </span>
  </div>
)

// ─── Lista de módulos del sistema (panel izquierdo) ───────────────
const MODULES = [
  { code: 'M-01', label: 'Gestión de Menús y Planificación' },
  { code: 'M-02', label: 'Sistema POS y Transacciones' },
  { code: 'M-03', label: 'Control de Acceso por Roles' },
  { code: 'M-04', label: 'Reportes y Auditoría Inmutable' },
]

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const formId       = useId()
  const [apiError, setApiError]       = useState<string | null>(null)
  const [showPassword, setShowPwd]    = useState(false)
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success'>('idle')

  const {
    register,
    handleSubmit,
    formState: { errors },
    resetField,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  })

  const onSubmit = async (data: LoginFormData) => {
    // Guard anti-doble-submit: si ya está cargando, ignorar
    if (submitState !== 'idle') return

    setApiError(null)
    setSubmitState('loading')

    try {
      const response = await authApi.login(data)
      setSubmitState('success')
      login(response.access_token)
      // Pequeña pausa para que el usuario vea el estado "éxito"
      setTimeout(() => navigate('/dashboard', { replace: true }), 600)
    } catch (err) {
      setSubmitState('idle')

      // Error genérico: NO revelar si el usuario existe o no (previene enumeración)
      if (err instanceof ApiError && err.status === 429) {
        setApiError('Demasiados intentos. Su cuenta ha sido bloqueada temporalmente.')
      } else {
        setApiError('Credenciales inválidas. Verifique su información e intente de nuevo.')
      }

      // Limpiar la contraseña tras error — el usuario debe reescribirla
      resetField('password')
    }
  }

  const isLoading = submitState === 'loading'
  const isSuccess = submitState === 'success'

  return (
    // ── Contenedor raíz con fondo de cuadrícula ──────────────────
    <div className="min-h-screen bg-ci-void bg-grid bg-grid flex overflow-hidden">

      {/* ── Panel izquierdo (identidad del sistema) — oculto en mobile ── */}
      <aside className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 xl:p-16 relative border-r border-ci-line">

        {/* Línea de acento superior */}
        <div
          aria-hidden
          className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-ci-amber/50 to-transparent"
        />

        {/* Identificador del sistema */}
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-14">
            {/* Logomark */}
            <div className="w-9 h-9 border border-ci-amber/50 flex items-center justify-center bg-ci-amber/5">
              <span className="font-mono font-bold text-ci-amber text-xs tracking-tight">CI</span>
            </div>
            <div className="h-px flex-1 bg-ci-line" />
            <span className="font-mono text-[10px] tracking-[0.3em] text-ci-muted uppercase">
              v1.0.0
            </span>
          </div>

          {/* Título principal */}
          <div className="mb-10">
            <h1 className="font-display font-black text-[88px] xl:text-[104px] leading-none text-ci-primary tracking-tight">
              CASINO
            </h1>
            <p className="font-display font-light text-3xl xl:text-4xl text-ci-amber/80 tracking-[0.18em] -mt-2">
              INSTITUCIONAL
            </p>
          </div>

          <p className="text-sm text-ci-secondary leading-relaxed max-w-[280px] mb-10 font-body">
            Plataforma integral de gestión para casinos de alimentación institucional. Segura, trazable y auditable.
          </p>

          {/* Lista de módulos */}
          <ul className="space-y-3.5">
            {MODULES.map(({ code, label }, i) => (
              <li
                key={code}
                className="flex items-center gap-3 animate-slide-in"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                <span className="font-mono text-[10px] text-ci-amber/40 w-10 shrink-0">{code}</span>
                <div className="w-px h-3 bg-ci-line" />
                <span className="text-sm text-ci-muted font-body">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer del panel */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <SystemStatus />
          <p className="font-mono text-[10px] text-ci-muted/50 tracking-wider">
            © 2024 · Arquitectura FastAPI + PostgreSQL · JWT RS256
          </p>
        </div>
      </aside>

      {/* ── Panel derecho (formulario) ─────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-12 xl:p-16 relative">

        {/* Resplandor de fondo sutil */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,158,11,0.03) 0%, transparent 70%)',
          }}
        />

        <div className="w-full max-w-[420px] animate-slide-up">

          {/* Header mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-5">
              <div className="w-7 h-7 border border-ci-amber/50 flex items-center justify-center">
                <span className="font-mono font-bold text-ci-amber text-[10px]">CI</span>
              </div>
            </div>
            <h1 className="font-display font-black text-5xl text-ci-primary leading-none">CASINO</h1>
            <p className="font-display text-xl text-ci-amber/70 tracking-[0.18em] mt-1">INSTITUCIONAL</p>
          </div>

          {/* Tarjeta del formulario */}
          <div
            className="relative border border-ci-line bg-ci-base/90 backdrop-blur-sm p-8 sm:p-10"
            style={{ boxShadow: '0 0 0 1px rgba(245,158,11,0.04), 0 24px 48px -12px rgba(0,0,0,0.6)' }}
          >
            {/* Línea de acento top */}
            <div
              aria-hidden
              className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-ci-amber/35 to-transparent"
            />

            {/* Encabezado del formulario */}
            <div className="mb-7">
              <p className="font-mono text-[10px] tracking-[0.35em] text-ci-amber/50 uppercase mb-3">
                Autenticación requerida
              </p>
              <div className="h-px bg-ci-line" />
            </div>

            {/* ── Banner de error global ──────────────────────────── */}
            {apiError && (
              <div
                role="alert"
                className="mb-6 flex gap-2.5 items-start border border-ci-error/20 bg-ci-error/5 p-3.5 text-ci-error animate-slide-up"
              >
                <WarnIcon />
                <p className="text-xs font-body leading-relaxed">{apiError}</p>
              </div>
            )}

            {/* ── Formulario ──────────────────────────────────────── */}
            <form
              id={formId}
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-7"
            >
              {/* Campo: Identificador */}
              <div>
                <label
                  htmlFor={`${formId}-identifier`}
                  className="block font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-2.5"
                >
                  RUT o Correo Electrónico
                </label>
                <input
                  id={`${formId}-identifier`}
                  {...register('identifier')}
                  type="text"
                  disabled={isLoading || isSuccess}
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="off"
                  placeholder="12345678-9  ·  usuario@empresa.cl"
                  className={[
                    'input-terminal',
                    errors.identifier ? 'error' : '',
                  ].join(' ')}
                />
                {errors.identifier && (
                  <p className="mt-1.5 text-[11px] font-mono text-ci-error/80 animate-slide-up">
                    {errors.identifier.message}
                  </p>
                )}
              </div>

              {/* Campo: Contraseña */}
              <div>
                <label
                  htmlFor={`${formId}-password`}
                  className="block font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-2.5"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id={`${formId}-password`}
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    disabled={isLoading || isSuccess}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className={[
                      'input-terminal pr-10',
                      errors.password ? 'error' : '',
                    ].join(' ')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-0 bottom-2.5 text-ci-muted hover:text-ci-amber transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-[11px] font-mono text-ci-error/80 animate-slide-up">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Botón de submit */}
              <button
                type="submit"
                form={formId}
                disabled={isLoading || isSuccess}
                className={[
                  'relative w-full flex items-center justify-center gap-2.5',
                  'font-display font-bold text-sm tracking-[0.22em] uppercase',
                  'py-3.5 mt-2 overflow-hidden',
                  'transition-all duration-200 group',
                  isSuccess
                    ? 'bg-ci-success text-ci-void cursor-default'
                    : isLoading
                      ? 'bg-ci-amber/80 text-ci-void cursor-not-allowed'
                      : 'bg-ci-amber text-ci-void hover:bg-ci-amber-bright active:scale-[0.99]',
                ].join(' ')}
                aria-live="polite"
                aria-busy={isLoading}
              >
                {/* Fondo de "barrido" en hover */}
                {!isLoading && !isSuccess && (
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-white/10 translate-x-[-101%] group-hover:translate-x-[101%] transition-transform duration-500 skew-x-12"
                  />
                )}

                {isLoading ? (
                  <>
                    <span
                      className="w-4 h-4 border-2 border-ci-void/30 border-t-ci-void rounded-full animate-spin"
                      aria-hidden
                    />
                    Verificando…
                  </>
                ) : isSuccess ? (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Acceso concedido
                  </>
                ) : (
                  <>
                    Ingresar al sistema
                    <span
                      aria-hidden
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </>
                )}
              </button>
            </form>

            <Divider label="Seguridad" />

            {/* Nota de seguridad */}
            <div className="flex items-center justify-center gap-4 text-ci-muted/40">
              {['TLS 1.3', 'JWT', 'Argon2'].map((badge) => (
                <span key={badge} className="font-mono text-[9px] tracking-[0.2em] uppercase">
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Mobile status */}
          <div className="lg:hidden flex justify-center mt-5">
            <SystemStatus />
          </div>
        </div>
      </main>
    </div>
  )
}
