export const locales = ['pt', 'en', 'es', 'it', 'de'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'pt'

export const localeNames: Record<Locale, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
  it: 'Italiano',
  de: 'Deutsch',
}

type Dict = {
  brand: string
  tagline: string
  catalog: string
  home: string
  cart: string
  checkout: string
  addToCart: string
  viewDetails: string
  sold: string
  reserved: string
  preparing: string
  unavailable: string
  available: string
  description: string
  price: string
  subtotal: string
  total: string
  discount: string
  coupon: string
  applyCoupon: string
  couponPlaceholder: string
  email: string
  emailPlaceholder: string
  name: string
  namePlaceholder: string
  completeOrder: string
  emptyCart: string
  language: string
  backToCatalog: string
  invalidCoupon: string
  couponApplied: string
  firstOrderOnly: string
  chooseLanguage: string
  required: string
  admin: string
}

export const dictionaries: Record<Locale, Dict> = {
  pt: {
    brand: 'Flores Marina',
    tagline: 'Arranjos florais únicos, feitos à mão',
    catalog: 'Catálogo',
    home: 'Início',
    cart: 'Carrinho',
    checkout: 'Finalizar',
    addToCart: 'Adicionar',
    viewDetails: 'Ver detalhe',
    sold: 'Vendido',
    reserved: 'Reservado',
    preparing: 'Em preparação',
    unavailable: 'Indisponível',
    available: 'Disponível',
    description: 'Descrição',
    price: 'Preço',
    subtotal: 'Subtotal',
    total: 'Total',
    discount: 'Desconto',
    coupon: 'Cupão',
    applyCoupon: 'Aplicar',
    couponPlaceholder: 'Código de desconto',
    email: 'Email',
    emailPlaceholder: 'teu@email.com',
    name: 'Nome',
    namePlaceholder: 'O teu nome',
    completeOrder: 'Finalizar encomenda',
    emptyCart: 'O carrinho está vazio.',
    language: 'Idioma',
    backToCatalog: 'Voltar ao catálogo',
    invalidCoupon: 'Cupão inválido ou expirado.',
    couponApplied: 'Cupão aplicado!',
    firstOrderOnly: 'Apenas para primeira compra.',
    chooseLanguage: 'Escolher idioma',
    required: 'Obrigatório.',
    admin: 'Painel',
  },
  en: {
    brand: 'Flores Marina',
    tagline: 'Unique handmade floral arrangements',
    catalog: 'Catalog',
    home: 'Home',
    cart: 'Cart',
    checkout: 'Checkout',
    addToCart: 'Add',
    viewDetails: 'View details',
    sold: 'Sold',
    reserved: 'Reserved',
    preparing: 'Preparing',
    unavailable: 'Unavailable',
    available: 'Available',
    description: 'Description',
    price: 'Price',
    subtotal: 'Subtotal',
    total: 'Total',
    discount: 'Discount',
    coupon: 'Coupon',
    applyCoupon: 'Apply',
    couponPlaceholder: 'Discount code',
    email: 'Email',
    emailPlaceholder: 'you@email.com',
    name: 'Name',
    namePlaceholder: 'Your name',
    completeOrder: 'Complete order',
    emptyCart: 'Your cart is empty.',
    language: 'Language',
    backToCatalog: 'Back to catalog',
    invalidCoupon: 'Invalid or expired coupon.',
    couponApplied: 'Coupon applied!',
    firstOrderOnly: 'First order only.',
    chooseLanguage: 'Choose language',
    required: 'Required.',
    admin: 'Admin',
  },
  es: {
    brand: 'Flores Marina',
    tagline: 'Arreglos florales únicos, hechos a mano',
    catalog: 'Catálogo',
    home: 'Inicio',
    cart: 'Cesta',
    checkout: 'Pagar',
    addToCart: 'Añadir',
    viewDetails: 'Ver detalle',
    sold: 'Vendido',
    reserved: 'Reservado',
    preparing: 'En preparación',
    unavailable: 'No disponible',
    available: 'Disponible',
    description: 'Descripción',
    price: 'Precio',
    subtotal: 'Subtotal',
    total: 'Total',
    discount: 'Descuento',
    coupon: 'Cupón',
    applyCoupon: 'Aplicar',
    couponPlaceholder: 'Código de descuento',
    email: 'Correo',
    emailPlaceholder: 'tu@correo.com',
    name: 'Nombre',
    namePlaceholder: 'Tu nombre',
    completeOrder: 'Finalizar pedido',
    emptyCart: 'La cesta está vacía.',
    language: 'Idioma',
    backToCatalog: 'Volver al catálogo',
    invalidCoupon: 'Cupón inválido o caducado.',
    couponApplied: 'Cupón aplicado!',
    firstOrderOnly: 'Solo primera compra.',
    chooseLanguage: 'Elegir idioma',
    required: 'Obligatorio.',
    admin: 'Panel',
  },
  it: {
    brand: 'Flores Marina',
    tagline: 'Composizioni floreali uniche, fatte a mano',
    catalog: 'Catalogo',
    home: 'Home',
    cart: 'Carrello',
    checkout: 'Cassa',
    addToCart: 'Aggiungi',
    viewDetails: 'Vedi dettaglio',
    sold: 'Venduto',
    reserved: 'Prenotato',
    preparing: 'In preparazione',
    unavailable: 'Non disponibile',
    available: 'Disponibile',
    description: 'Descrizione',
    price: 'Prezzo',
    subtotal: 'Subtotale',
    total: 'Totale',
    discount: 'Sconto',
    coupon: 'Coupon',
    applyCoupon: 'Applica',
    couponPlaceholder: 'Codice sconto',
    email: 'Email',
    emailPlaceholder: 'tu@email.com',
    name: 'Nome',
    namePlaceholder: 'Il tuo nome',
    completeOrder: 'Completa ordine',
    emptyCart: 'Il carrello è vuoto.',
    language: 'Lingua',
    backToCatalog: 'Torna al catalogo',
    invalidCoupon: 'Coupon non valido o scaduto.',
    couponApplied: 'Coupon applicato!',
    firstOrderOnly: 'Solo primo ordine.',
    chooseLanguage: 'Scegli lingua',
    required: 'Obbligatorio.',
    admin: 'Pannello',
  },
  de: {
    brand: 'Flores Marina',
    tagline: 'Einzigartige handgemachte Floristik',
    catalog: 'Katalog',
    home: 'Start',
    cart: 'Warenkorb',
    checkout: 'Kasse',
    addToCart: 'Hinzufügen',
    viewDetails: 'Details ansehen',
    sold: 'Verkauft',
    reserved: 'Reserviert',
    preparing: 'In Vorbereitung',
    unavailable: 'Nicht verfügbar',
    available: 'Verfügbar',
    description: 'Beschreibung',
    price: 'Preis',
    subtotal: 'Zwischensumme',
    total: 'Gesamt',
    discount: 'Rabatt',
    coupon: 'Gutschein',
    applyCoupon: 'Anwenden',
    couponPlaceholder: 'Rabattcode',
    email: 'E-Mail',
    emailPlaceholder: 'du@email.com',
    name: 'Name',
    namePlaceholder: 'Dein Name',
    completeOrder: 'Bestellung abschließen',
    emptyCart: 'Der Warenkorb ist leer.',
    language: 'Sprache',
    backToCatalog: 'Zurück zum Katalog',
    invalidCoupon: 'Ungültiger oder abgelaufener Gutschein.',
    couponApplied: 'Gutschein angewendet!',
    firstOrderOnly: 'Nur Erstbestellung.',
    chooseLanguage: 'Sprache wählen',
    required: 'Erforderlich.',
    admin: 'Panel',
  },
}

export function getDictionary(locale: string): Dict {
  return dictionaries[(locale as Locale)] || dictionaries[defaultLocale]
}
