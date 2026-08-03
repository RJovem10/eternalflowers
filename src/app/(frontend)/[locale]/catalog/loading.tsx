export default function CatalogLoading() {
  return (
    <div
      className="flex items-center justify-center py-32"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Loading…</span>
      <span
        className="inline-block h-6 w-6 rounded-full border-2 border-brand-gold/30 border-t-brand-gold motion-safe:animate-spin"
        aria-hidden="true"
        style={{
          animationDuration: '1.2s',
        }}
      />
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-spin {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}