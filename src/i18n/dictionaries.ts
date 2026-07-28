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
  scientificName: string
  category: string
  collection: string
  productType: string
  story: string
  storyPlaceholder: string
  realFlower: string
  realFlowerDesc: string
  handmadePortugal: string
  handmadePortugalDesc: string
  uniquePiece: string
  uniquePieceDesc: string
  premiumPackaging: string
  premiumPackagingDesc: string
  relatedProducts: string
  productTypePermanente: string
  productTypeSazonal: string
  productTypeExclusivo: string
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
    scientificName: 'Nome Científico',
    category: 'Categoria',
    collection: 'Coleção',
    productType: 'Tipo',
    story: 'História',
    storyPlaceholder: 'Cada peça tem a sua própria história. Em breve, poderá ler aqui o significado especial desta criação.',
    realFlower: 'Flor Verdadeira',
    realFlowerDesc: 'Cada peça é criada com flores verdadeiras, preservadas para durar.',
    handmadePortugal: 'Feito à Mão em Portugal',
    handmadePortugalDesc: 'Artesanato português, com dedicação e atenção a cada detalhe.',
    uniquePiece: 'Peça Única',
    uniquePieceDesc: 'Não existem duas iguais. Cada criação é uma edição limitada.',
    premiumPackaging: 'Embalagem Premium',
    premiumPackagingDesc: 'Embalagem especial, preparada para oferecer ou guardar.',
    relatedProducts: 'Peças Relacionadas',
    productTypePermanente: 'Permanente',
    productTypeSazonal: 'Sazonal',
    productTypeExclusivo: 'Exclusivo',
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
    scientificName: 'Scientific Name',
    category: 'Category',
    collection: 'Collection',
    productType: 'Type',
    story: 'Story',
    storyPlaceholder: 'Every piece has its own story. Soon you will be able to read here the special meaning of this creation.',
    realFlower: 'Real Flower',
    realFlowerDesc: 'Each piece is crafted with real flowers, preserved to last.',
    handmadePortugal: 'Handmade in Portugal',
    handmadePortugalDesc: 'Portuguese craftsmanship, with dedication and attention to every detail.',
    uniquePiece: 'Unique Piece',
    uniquePieceDesc: 'No two are alike. Each creation is a limited edition.',
    premiumPackaging: 'Premium Packaging',
    premiumPackagingDesc: 'Special packaging, ready to gift or keep.',
    relatedProducts: 'Related Pieces',
    productTypePermanente: 'Permanent',
    productTypeSazonal: 'Seasonal',
    productTypeExclusivo: 'Exclusive',
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
    scientificName: 'Nombre Científico',
    category: 'Categoría',
    collection: 'Colección',
    productType: 'Tipo',
    story: 'Historia',
    storyPlaceholder: 'Cada pieza tiene su propia historia. Pronto podrás leer aquí el significado especial de esta creación.',
    realFlower: 'Flor Verdadera',
    realFlowerDesc: 'Cada pieza está hecha con flores verdaderas, preservadas para durar.',
    handmadePortugal: 'Hecho a Mano en Portugal',
    handmadePortugalDesc: 'Artesanía portuguesa, con dedicación y atención a cada detalle.',
    uniquePiece: 'Pieza Única',
    uniquePieceDesc: 'No hay dos iguales. Cada creación es una edición limitada.',
    premiumPackaging: 'Embalaje Premium',
    premiumPackagingDesc: 'Embalaje especial, listo para regalar o guardar.',
    relatedProducts: 'Piezas Relacionadas',
    productTypePermanente: 'Permanente',
    productTypeSazonal: 'Estacional',
    productTypeExclusivo: 'Exclusivo',
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
    scientificName: 'Nome Scientifico',
    category: 'Categoria',
    collection: 'Collezione',
    productType: 'Tipo',
    story: 'Storia',
    storyPlaceholder: 'Ogni pezzo ha la sua storia. Presto potrai leggere qui il significato speciale di questa creazione.',
    realFlower: 'Fiore Vero',
    realFlowerDesc: 'Ogni pezzo è realizzato con fiori veri, preservati per durare.',
    handmadePortugal: 'Fatto a Mano in Portogallo',
    handmadePortugalDesc: 'Artigianato portoghese, con dedizione e attenzione a ogni dettaglio.',
    uniquePiece: 'Pezzo Unico',
    uniquePieceDesc: 'Non esistono due pezzi uguali. Ogni creazione è un\'edizione limitata.',
    premiumPackaging: 'Confezione Premium',
    premiumPackagingDesc: 'Confezione speciale, pronta per regalare o conservare.',
    relatedProducts: 'Pezzi Correlati',
    productTypePermanente: 'Permanente',
    productTypeSazonal: 'Stagionale',
    productTypeExclusivo: 'Esclusivo',
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
    scientificName: 'Wissenschaftlicher Name',
    category: 'Kategorie',
    collection: 'Kollektion',
    productType: 'Typ',
    story: 'Geschichte',
    storyPlaceholder: 'Jedes Stück hat seine eigene Geschichte. Bald kannst du hier die besondere Bedeutung dieser Kreation lesen.',
    realFlower: 'Echte Blume',
    realFlowerDesc: 'Jedes Stück wird mit echten Blumen hergestellt, konserviert um zu halten.',
    handmadePortugal: 'Handgefertigt in Portugal',
    handmadePortugalDesc: 'Portugiesisches Handwerk mit Hingabe und Aufmerksamkeit für jedes Detail.',
    uniquePiece: 'Einzigartiges Stück',
    uniquePieceDesc: 'Keine zwei sind gleich. Jede Kreation ist eine limitierte Auflage.',
    premiumPackaging: 'Premium-Verpackung',
    premiumPackagingDesc: 'Spezielle Verpackung, bereit zum Verschenken oder Aufbewahren.',
    relatedProducts: 'Ähnliche Stücke',
    productTypePermanente: 'Dauerhaft',
    productTypeSazonal: 'Saisonal',
    productTypeExclusivo: 'Exklusiv',
  },
}

export function getDictionary(locale: string): Dict {
  return dictionaries[(locale as Locale)] || dictionaries[defaultLocale]
}
