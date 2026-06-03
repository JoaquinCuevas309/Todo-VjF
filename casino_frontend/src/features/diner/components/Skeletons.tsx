/**
 * Skeletons.tsx — Skeleton loaders reutilizables para la vista del comensal.
 *
 * Los skeletons replican EXACTAMENTE la forma del contenido real.
 * Esto elimina el "layout shift" al cargar y da sensación de velocidad
 * en redes móviles lentas (efecto psicológico de carga percibida).
 */

// ── Bloque base pulsante ──────────────────────────────────────────
function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-ci-raised/80 ${className ?? ''}`}
      aria-hidden="true"
    />
  )
}

// ── Skeleton: tarjeta de QR ───────────────────────────────────────
export function SkeletonQR() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-5">
      {/* Título */}
      <Pulse className="h-3 w-36 rounded-sm" />
      {/* Cuadrado QR */}
      <Pulse className="w-[220px] h-[220px] rounded-sm" />
      {/* Subtítulo */}
      <Pulse className="h-3 w-48 rounded-sm" />
      <Pulse className="h-3 w-32 rounded-sm" />
    </div>
  )
}

// ── Skeleton: tarjeta del menú del día ────────────────────────────
export function SkeletonMenu() {
  return (
    <div className="border border-ci-line bg-ci-base p-5 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <Pulse className="h-3 w-24 rounded-sm" />
        <Pulse className="h-5 w-48 rounded-sm" />
        <Pulse className="h-3 w-36 rounded-sm" />
      </div>
      <div className="h-px bg-ci-line" />
      {/* Ítems del menú (4 filas) */}
      {[80, 72, 60, 52].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <Pulse className="h-3 w-14 rounded-sm shrink-0" />
          <div className="w-px h-3 bg-ci-line shrink-0" />
          <Pulse className={`h-3 w-${w} rounded-sm`} style={{ width: `${w}%` }} />
        </div>
      ))}
      <div className="h-px bg-ci-line" />
      {/* Footer precio + disponibilidad */}
      <div className="flex justify-between">
        <Pulse className="h-4 w-20 rounded-sm" />
        <Pulse className="h-4 w-16 rounded-sm" />
      </div>
    </div>
  )
}

// ── Skeleton: fila de historial ───────────────────────────────────
export function SkeletonHistoryRow() {
  return (
    <div className="flex items-center gap-4 border border-ci-line bg-ci-base p-4">
      <Pulse className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-3.5 w-2/3 rounded-sm" />
        <Pulse className="h-3 w-1/2 rounded-sm" />
      </div>
      <Pulse className="h-4 w-16 rounded-sm shrink-0" />
    </div>
  )
}

// ── Skeleton: lista de historial completa ─────────────────────────
export function SkeletonHistory() {
  return (
    <div className="space-y-2 p-4">
      <Pulse className="h-3 w-28 mb-4 rounded-sm" />
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonHistoryRow key={i} />
      ))}
    </div>
  )
}
