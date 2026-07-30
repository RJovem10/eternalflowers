interface ProductAttributesProps {
  dict: any
}

const items = [
  {
    key: 'realFlower' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-8 h-8">
        <path d="M12 2C9.5 5 7 7 7 10c0 3 2.5 5 5 5s5-2 5-5c0-3-2.5-5-5-8z" strokeLinecap="round" />
        <path d="M12 15v7" strokeLinecap="round" />
        <path d="M9 20h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'handmadePortugal' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-8 h-8">
        <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'uniquePiece' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-8 h-8">
        <circle cx="12" cy="8" r="5" strokeLinecap="round" />
        <path d="M5 22c0-4 3-7 7-7s7 3 7 7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'premiumPackaging' as const,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-8 h-8">
        <rect x="3" y="7" width="18" height="14" rx="2" strokeLinecap="round" />
        <path d="M3 7L12 2l9 5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 2v19" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function ProductAttributes({ dict }: ProductAttributesProps) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4 lg:gap-10">
      {items.map(({ key, icon }) => (
        <div
          key={key}
          className="border-t border-brand-wood/8 bg-brand-cream pt-5"
        >
          <div className="mb-5 text-brand-gold">
            {icon}
          </div>
          <h3 className="mb-2 font-display text-lg font-light leading-tight text-brand-charcoal">
            {dict[key]}
          </h3>
          <p className="text-xs leading-relaxed text-brand-wood sm:text-sm">
            {dict[`${key}Desc`]}
          </p>
        </div>
      ))}
    </div>
  )
}
