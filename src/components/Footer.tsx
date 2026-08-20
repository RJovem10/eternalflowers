interface FooterProps {
  brandDescription?: string | null
  email?: string | null
  phone?: string | null
  instagramUrl?: string | null
  whatsappUrl?: string | null
  locale: string
  dict: any
}

export default function Footer({
  brandDescription,
  email,
  phone,
  instagramUrl,
  whatsappUrl,
  locale,
  dict,
}: FooterProps) {
  return (
    <footer className="bg-brand-charcoal text-white/55">
      <div className="max-w-content mx-auto px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          {/* Brand — a alma da marca */}
          <div className="md:col-span-1">
            <span className="text-2xl block mb-3">🌺</span>
            <h3 className="font-display text-xl font-light text-white/85 mb-2">
              Eternal Flowers
            </h3>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-body font-medium mb-5">
              Resin Art &amp; Jewelry by Mar&Natur&reg;
            </p>
            {brandDescription && (
              <p className="text-sm text-white/50 leading-relaxed font-body font-light">
                {brandDescription}
              </p>
            )}
            <p className="text-sm text-white/35 mt-6 font-body font-light leading-relaxed">
              {dict.taglineDecor}
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.25em] text-white/35 font-body font-medium mb-5">
              {dict.contact}
            </h4>
            <ul className="space-y-3 text-sm text-white/45 font-body font-light">
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="hover:text-white/80 transition-colors duration-300"
                  >
                    {email}
                  </a>
                </li>
              )}
              {phone && <li>{phone}</li>}
              <li className="text-white/25 text-xs leading-relaxed">
                Av. Quinta da Rocha, Loja 30
                <br />
                Prado, Braga · Portugal
              </li>
            </ul>
          </div>

          {/* Follow us */}
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.25em] text-white/35 font-body font-medium mb-5">
              {dict.followUs}
            </h4>
            <ul className="space-y-3 text-sm">
              {instagramUrl && (
                <li>
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-white/45 hover:text-white/80 transition-colors duration-300 font-body font-light"
                  >
                    Instagram
                    <span className="text-brand-gold/40 group-hover:text-brand-gold/80 transition-colors duration-300">→</span>
                  </a>
                </li>
              )}
              {whatsappUrl && (
                <li>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 text-white/45 hover:text-white/80 transition-colors duration-300 font-body font-light"
                  >
                    WhatsApp
                    <span className="text-brand-gold/40 group-hover:text-brand-gold/80 transition-colors duration-300">→</span>
                  </a>
                </li>
              )}
            </ul>
            <div className="mt-6 pt-6 border-t border-white/8">
              <a
                href={`/${locale}/care`}
                className="group inline-flex items-center gap-2 text-white/45 hover:text-white/80 transition-colors duration-300 font-body font-light text-sm"
              >
                {dict.careGuide}
                <span className="text-brand-gold/40 group-hover:text-brand-gold/80 transition-colors duration-300">→</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/8 text-center">
          <p className="text-xs text-white/20 font-body font-light">
            &copy; {new Date().getFullYear()} Eternal Flowers by Mar&Natur&reg;. {dict.rightsReserved}
          </p>
        </div>
      </div>
    </footer>
  )
}