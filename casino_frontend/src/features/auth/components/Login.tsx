/**
 * Login.tsx — Pantalla de autenticación.
 *
 * Estética: "Access Credential Station"
 * ─────────────────────────────────────
 * Fondo oscuro con dos orbes de gradiente ambar que derivan lentamente.
 * Tarjeta centrada con borde izquierdo de color dinámico (indicador de
 * estado: ambar → loading, verde → éxito, rojo → error).
 *
 * Seguridad implementada en este componente:
 *  • Error genérico (misma respuesta para "usuario no existe" y "contraseña
 *    incorrecta") → previene enumeración de usuarios.
 *  • Botón deshabilitado mientras isLoading=true → previene doble-submit.
 *  • resetField('password') tras cualquier error → usuario no reenvía misma clave.
 *  • noValidate en el form → Zod es la única fuente de verdad, no el browser.
 *  • autoComplete correcto → el gestor de contraseñas no rellena campos equivocados.
 */

import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../schemas/loginSchema'
import { useLogin, CARD_STATUS_COLOR } from '../hooks/useLogin'

// ─── Iconos SVG inline (sin dependencia de librería) ────────────────
const IconWarn = () => (
  <svg
    aria-hidden
    className="w-4 h-4 shrink-0 mt-0.5 text-ci-error"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

const IconEye = ({ open }: { open: boolean }) =>
  open ? (
    <svg aria-hidden className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg aria-hidden className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )

const IconCheck = () => (
  <svg aria-hidden className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconSpinner = () => (
  <span
    aria-hidden
    className="w-4 h-4 rounded-full border-2 border-ci-void/30 border-t-ci-void animate-spin"
  />
)

// ─── Badges de seguridad ─────────────────────────────────────────────
const SECURITY_BADGES = ['TLS 1.3', 'JWT', 'Argon2', 'PWA'] as const

// ═══════════════════════════════════════════════════════════════════════
export default function Login() {
  const formId                        = useId()
  const [showPwd, setShowPwd]         = useState(false)
  const { onSubmit, cardStatus, errorMsg } = useLogin()

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',   // valida al salir del campo, no al escribir
  })

  const isLoading = cardStatus === 'loading'
  const isSuccess = cardStatus === 'success'
  const isDisabled = isLoading || isSuccess

  const submitHandler = handleSubmit(
    (data) => onSubmit(data, () => resetField('password')),
  )

  return (
    // ── Wrapper con fondo y orbes animados ─────────────────────────
    <div
      className="relative min-h-screen bg-ci-void flex flex-col items-center justify-center px-4 py-10 overflow-hidden"
      aria-label="Pantalla de acceso al sistema"
    >

      {/* ── Orbe superior-izquierdo ─────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/4 -left-1/4 w-[70vmax] h-[70vmax] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 65%)',
          animation: 'orbFloat1 22s ease-in-out infinite alternate',
        }}
      />
      {/* ── Orbe inferior-derecho ───────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-1/3 -right-1/4 w-[60vmax] h-[60vmax] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 60%)',
          animation: 'orbFloat2 28s ease-in-out infinite alternate',
        }}
      />
      {/* ── Cuadrícula de fondo ─────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid opacity-60"
      />

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TARJETA PRINCIPAL                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div
        className="relative w-full max-w-[420px] border border-ci-line bg-ci-base/90 backdrop-blur-sm animate-fade-in"
        style={{
          borderLeft: `3px solid ${CARD_STATUS_COLOR[cardStatus]}`,
          boxShadow: '0 0 0 1px rgba(245,158,11,0.03), 0 32px 64px -16px rgba(0,0,0,0.75)',
          transition: 'border-left-color 0.5s ease',
        }}
        role="main"
      >
        {/* Línea de acento superior */}
        <div
          aria-hidden
          className="absolute inset-x-6 top-0 h-px"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)',
          }}
        />

        <div className="px-8 pt-10 pb-8 sm:px-10 sm:pt-12">

          {/* ── Cabecera de la tarjeta ──────────────────────────── */}
          <header className="mb-7">
            <div className="flex items-center gap-4 mb-5">
              {/* Logomark geométrico */}
              <div
                className="w-11 h-11 border border-ci-amber/40 bg-ci-amber/8 flex items-center justify-center shrink-0"
                style={{ clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)' }}
                aria-label="Casino Institucional"
              >
                <span className="font-mono font-bold text-ci-amber text-xs tracking-tight">CI</span>
              </div>

              <div className="min-w-0">
                <h1 className="font-display font-black text-[2.6rem] leading-none text-ci-primary tracking-tight">
                  CASINO
                </h1>
                <p className="font-display font-light text-base text-ci-amber/70 tracking-[0.22em] -mt-1">
                  INSTITUCIONAL
                </p>
              </div>
            </div>

            {/* Estado del sistema */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ci-success opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ci-success" />
              </span>
              <span className="font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase">
                Sistema activo
              </span>
            </div>
          </header>

          {/* Divider */}
          <div
            aria-hidden
            className="mb-7 h-px"
            style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.3), transparent)' }}
          />

          {/* ── Banner de error global ──────────────────────────── */}
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 flex gap-2.5 items-start border border-ci-error/20 bg-ci-error/5 p-3.5 animate-slide-up"
            >
              <IconWarn />
              <p className="text-xs text-ci-error/90 font-body leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* ── Sección label ──────────────────────────────────── */}
          <p className="font-mono text-[10px] tracking-[0.32em] text-ci-muted uppercase mb-6">
            Credenciales de acceso
          </p>

          {/* ══════════════════════════════════════════════════════ */}
          {/* FORMULARIO                                             */}
          {/* ══════════════════════════════════════════════════════ */}
          <form
            id={formId}
            onSubmit={submitHandler}
            noValidate
            className="space-y-6"
          >

            {/* ── Campo: Identificador (RUT o correo) ─────────── */}
            <div>
              <label
                htmlFor={`${formId}-id`}
                className="block font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-2.5"
              >
                RUT o Correo Electrónico
              </label>
              <input
                id={`${formId}-id`}
                {...register('identifier')}
                type="text"
                disabled={isDisabled}
                autoComplete="username"
                spellCheck={false}
                autoCapitalize="off"
                placeholder="12345678-9 · usuario@empresa.cl"
                aria-invalid={Boolean(errors.identifier)}
                aria-describedby={errors.identifier ? `${formId}-id-err` : undefined}
                className={[
                  'input-terminal',
                  errors.identifier ? 'error' : '',
                ].join(' ')}
              />
              {errors.identifier && (
                <p
                  id={`${formId}-id-err`}
                  role="alert"
                  className="mt-1.5 text-[11px] font-mono text-ci-error/80 animate-slide-up"
                >
                  {errors.identifier.message}
                </p>
              )}
            </div>

            {/* ── Campo: Contraseña ────────────────────────────── */}
            <div>
              <label
                htmlFor={`${formId}-pwd`}
                className="block font-mono text-[10px] tracking-[0.28em] text-ci-muted uppercase mb-2.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id={`${formId}-pwd`}
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  disabled={isDisabled}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? `${formId}-pwd-err` : undefined}
                  className={[
                    'input-terminal pr-10',
                    errors.password ? 'error' : '',
                  ].join(' ')}
                />
                {/* Toggle visibilidad */}
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  disabled={isDisabled}
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-0 bottom-2.5 text-ci-muted hover:text-ci-amber disabled:opacity-40 transition-colors"
                >
                  <IconEye open={showPwd} />
                </button>
              </div>
              {errors.password && (
                <p
                  id={`${formId}-pwd-err`}
                  role="alert"
                  className="mt-1.5 text-[11px] font-mono text-ci-error/80 animate-slide-up"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* ── Botón de submit ──────────────────────────────── */}
            <button
              type="submit"
              form={formId}
              disabled={isDisabled}
              aria-busy={isLoading}
              aria-live="polite"
              className={[
                'relative w-full flex items-center justify-center gap-2.5 mt-2',
                'font-display font-bold text-sm tracking-[0.22em] uppercase',
                'py-3.5 overflow-hidden transition-all duration-200 group',
                isSuccess
                  ? 'bg-ci-success text-ci-void cursor-default'
                  : isLoading
                    ? 'bg-ci-amber/75 text-ci-void cursor-not-allowed'
                    : 'bg-ci-amber text-ci-void hover:bg-ci-amber-bright active:scale-[0.99]',
              ].join(' ')}
            >
              {/* Efecto "barrido" en hover (solo estado idle) */}
              {!isDisabled && (
                <span
                  aria-hidden
                  className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-500 skew-x-12"
                />
              )}

              {isLoading ? (
                <>
                  <IconSpinner />
                  Verificando…
                </>
              ) : isSuccess ? (
                <>
                  <IconCheck />
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

          {/* ── Badges de seguridad ─────────────────────────────── */}
          <div className="mt-8 pt-6 border-t border-ci-line flex items-center justify-center gap-4">
            {SECURITY_BADGES.map((badge) => (
              <span
                key={badge}
                className="font-mono text-[9px] tracking-[0.2em] text-ci-muted/40 uppercase"
              >
                {badge}
              </span>
            ))}
          </div>

        </div>
      </div>

      {/* Nota de versión debajo de la tarjeta */}
      <p className="mt-4 font-mono text-[10px] text-ci-muted/25 tracking-widest">
        Sistema de Gestión · v1.0.0
      </p>

    </div>
  )
}
