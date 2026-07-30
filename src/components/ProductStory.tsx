interface ProductStoryProps {
  story?: string | null
}

export default function ProductStory({ story }: ProductStoryProps) {
  if (!story?.trim()) return null

  return (
    <section className="mx-auto max-w-3xl border-l border-brand-gold px-6 py-3 sm:px-10">
      <h2 className="mb-7 text-xs font-medium uppercase tracking-[0.22em] text-brand-moss">
        A História
      </h2>
      <p className="whitespace-pre-line font-display text-2xl font-light leading-relaxed text-brand-charcoal/80 sm:text-3xl">
        {story}
      </p>
    </section>
  )
}
