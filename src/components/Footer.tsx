interface FooterProps {
  brandDescription?: string | null
  email?: string | null
  phone?: string | null
  instagramUrl?: string | null
  whatsappUrl?: string | null
  locale: string
}

export default function Footer({
  brandDescription,
  email,
  phone,
  instagramUrl,
  whatsappUrl,
}: FooterProps) {
  return (
    <footer className="border-t border-stone-200 bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-sm font-semibold tracking-widest uppercase text-stone-400 mb-3">
              Eternal Flowers
            </h3>
            {brandDescription && (
              <p className="text-sm text-stone-600 leading-relaxed">{brandDescription}</p>
            )}
            <p className="text-xs text-stone-400 mt-4">
              🌷 Uma flor | 💎 Uma joia | 💖 uma memória
            </p>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold tracking-widest uppercase text-stone-400 mb-3">
              Contacto
            </h3>
            <ul className="space-y-2 text-sm text-stone-600">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="hover:text-stone-800 transition-colors">
                    {email}
                  </a>
                </li>
              )}
              {phone && <li>{phone}</li>}
              <li className="text-stone-400 text-xs">Braga · Portugal</li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-semibold tracking-widest uppercase text-stone-400 mb-3">
              Social
            </h3>
            <ul className="space-y-2 text-sm">
              {instagramUrl && (
                <li>
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-600 hover:text-stone-800 transition-colors"
                  >
                    Instagram →
                  </a>
                </li>
              )}
              {whatsappUrl && (
                <li>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-600 hover:text-stone-800 transition-colors"
                  >
                    WhatsApp →
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-stone-200 text-center text-xs text-stone-400">
          &copy; {new Date().getFullYear()} Eternal Flowers by Mar&Natur&reg;. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  )
}