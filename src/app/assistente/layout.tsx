/**
 * Layout para /assistente
 *
 * Layout mínimo com HTML wrapper, sem locale header, cart provider, ou fontes.
 */

import '@/app/globals.css'

export default function AssistenteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body className="min-h-screen bg-white">
        {children}
      </body>
    </html>
  )
}