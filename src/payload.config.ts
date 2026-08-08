import { buildConfig, type CollectionConfig, type GlobalConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'

// Postgres (VPS) só quando DATABASE_URI começa por "postgres".
// Dev local: SQLite (ficheiro, sem servidor).
const uri = process.env.DATABASE_URI || ''
const usePostgres = uri.startsWith('postgres')
const db = usePostgres
  ? postgresAdapter({ pool: { connectionString: uri }, migrationDir: './src/migrations-pg', push: process.env.PAYLOAD_PG_PUSH === 'true' })
  : sqliteAdapter({ client: { url: uri.startsWith('file:') ? uri : 'file:./loja.sqlite' }, push: process.env.PAYLOAD_SQLITE_PUSH !== 'false', transactionOptions: {}})

const Flowers: CollectionConfig = {
  slug: 'flowers',
  admin: { useAsTitle: 'namePt' },
  fields: [
    { name: 'namePt', type: 'text', required: true, label: 'Nome (PT)' },
    { name: 'nameEn', type: 'text', label: 'Nome (EN)' },
    { name: 'nameEs', type: 'text', label: 'Nome (ES)' },
    { name: 'nameIt', type: 'text', label: 'Nome (IT)' },
    { name: 'nameDe', type: 'text', label: 'Nome (DE)' },
    {
      name: 'productType',
      type: 'select',
      required: true,
      defaultValue: 'permanente',
      label: 'Tipo de Produto',
      options: [
        { label: 'Permanente', value: 'permanente' },
        { label: 'Sazonal', value: 'sazonal' },
        { label: 'Exclusivo', value: 'exclusivo' },
      ],
    },
    { name: 'scientificName', type: 'text', required: true, label: 'Nome Científico' },
    { name: 'creationName', type: 'text', label: 'Nome da Criação' },
    { name: 'price', type: 'number', required: true, label: 'Preço (€)', min: 0 },
    { name: 'descriptionPt', type: 'textarea', label: 'Descrição (PT)' },
    { name: 'descriptionEn', type: 'textarea', label: 'Descrição (EN)' },
    { name: 'descriptionEs', type: 'textarea', label: 'Descrição (ES)' },
    { name: 'descriptionIt', type: 'textarea', label: 'Descrição (IT)' },
    { name: 'descriptionDe', type: 'textarea', label: 'Descrição (DE)' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Foto' },
    {
      name: 'availability',
      type: 'select',
      defaultValue: 'available',
      label: 'Disponibilidade',
      options: [
        { label: 'Disponível', value: 'available' },
        { label: 'Reservado', value: 'reserved' },
        { label: 'Vendido', value: 'sold' },
        { label: 'Em preparação', value: 'preparing' },
      ],
    },
    { name: 'sku', type: 'text', label: 'Código (SKU)' },
    {
      name: 'images',
      type: 'array',
      label: 'Galeria de Imagens',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'Imagem',
        },
      ],
    },
    {
      name: 'productionMode',
      type: 'select',
      label: 'Modo de Produção',
      options: [
        { label: 'Peça Única', value: 'unique' },
        { label: 'Reproduzível', value: 'reproducible' },
        { label: 'Produzido por Encomenda', value: 'made_to_order' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Como este produto é produzido. Os produtos demo podem ficar por preencher.',
      },
    },
    {
      name: 'productionLeadTime',
      type: 'number',
      label: 'Prazo de Produção (dias úteis)',
      min: 1,
      max: 255,
      admin: {
        position: 'sidebar',
        condition: (_data: any, siblingData: any) => siblingData?.productionMode === 'made_to_order',
        description: 'Obrigatório para made_to_order. Null para unique e reproducible.',
      },
    },
    {
      name: 'stockQuantity',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      label: 'Quantidade em Stock',
      admin: {
        position: 'sidebar',
        condition: (_data: any, siblingData: any) =>
          siblingData?.productionMode === 'unique' || siblingData?.productionMode === 'reproducible',
        description: 'Unique: 1 (disponível) ou 0 (vendido). Reproduzível: stock físico real.',
      },
    },
    { name: 'story', type: 'textarea', label: 'História da Peça', localized: true },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Categoria',
      hasMany: false,
    },
    {
      name: 'collections',
      type: 'relationship',
      relationTo: 'collections',
      label: 'Coleções',
      hasMany: true,
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation, originalDoc }) => {
        if (!data) return
        const { validateProductModel } = require('@/lib/stock') as typeof import('@/lib/stock')
        const op = operation as 'create' | 'update'
        const errors = validateProductModel(data, op, originalDoc as Record<string, unknown> | null | undefined)
        if (errors.length > 0) {
          throw new Error(errors.join(' '))
        }
      },
    ],
  },
}

const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'media',
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 400, position: 'centre' },
      { name: 'card', width: 600, height: 600, position: 'centre' },
    ],
  },
  access: {
    read: () => true,
  },
  fields: [],
}

const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: { useAsTitle: 'code' },
  fields: [
    { name: 'code', type: 'text', required: true, label: 'Código', unique: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'percent',
      label: 'Tipo',
      options: [
        { label: 'Percentagem', value: 'percent' },
        { label: 'Valor fixo (€)', value: 'fixed' },
      ],
    },
    { name: 'value', type: 'number', required: true, label: 'Valor (%, ou €)', min: 0 },
    { name: 'validFrom', type: 'date', label: 'Válido desde' },
    { name: 'validUntil', type: 'date', label: 'Válido até' },
    { name: 'maxUses', type: 'number', label: 'Usos máximos (0 = ilimitado)', defaultValue: 0, min: 0 },
    { name: 'minOrder', type: 'number', label: 'Valor mínimo da encomenda (€)', defaultValue: 0, min: 0 },
    { name: 'firstOrderOnly', type: 'checkbox', defaultValue: false, label: 'Apenas 1ª compra?' },
    { name: 'active', type: 'checkbox', defaultValue: true, label: 'Ativo?' },
    { name: 'usesCount', type: 'number', defaultValue: 0, label: 'Usos registados', admin: { readOnly: true } },
  ],
}

const Orders: CollectionConfig = {
  slug: 'orders',
  admin: { useAsTitle: 'orderNumber' },
  fields: [
    // --- Order number (unique when present, auto-assigned for legacy) ---
    { name: 'orderNumber', type: 'text', unique: true, label: 'Nº Encomenda', admin: { hidden: true } },

    // --- Customer group ---
    {
      name: 'customer',
      type: 'group',
      label: 'Cliente',
      fields: [
        { name: 'name', type: 'text', label: 'Nome' },
        { name: 'email', type: 'email', required: true, label: 'Email' },
        { name: 'phone', type: 'text', label: 'Telefone' },
        { name: 'companyName', type: 'text', label: 'Empresa' },
        { name: 'taxId', type: 'text', label: 'NIF' },
      ],
    },

    // --- Shipping address (opcional nesta fase) ---
    {
      name: 'shippingAddress',
      type: 'group',
      label: 'Morada de Envio',
      fields: [
        { name: 'recipientName', type: 'text', label: 'Destinatário' },
        { name: 'phone', type: 'text', label: 'Telefone' },
        { name: 'line1', type: 'text', label: 'Morada' },
        { name: 'line2', type: 'text', label: 'Complemento' },
        { name: 'city', type: 'text', label: 'Cidade' },
        { name: 'region', type: 'text', label: 'Distrito' },
        { name: 'postalCode', type: 'text', label: 'Código Postal' },
        { name: 'country', type: 'text', label: 'País (ISO 3166-1 alpha-2)' },
      ],
    },

    // --- Billing ---
    { name: 'billingSameAsShipping', type: 'checkbox', defaultValue: true, label: 'Faturação = Envio' },
    {
      name: 'billingAddress',
      type: 'group',
      label: 'Morada de Faturação',
      fields: [
        { name: 'recipientName', type: 'text', label: 'Destinatário' },
        { name: 'phone', type: 'text', label: 'Telefone' },
        { name: 'line1', type: 'text', label: 'Morada' },
        { name: 'line2', type: 'text', label: 'Complemento' },
        { name: 'city', type: 'text', label: 'Cidade' },
        { name: 'region', type: 'text', label: 'Distrito' },
        { name: 'postalCode', type: 'text', label: 'Código Postal' },
        { name: 'country', type: 'text', label: 'País (ISO 3166-1 alpha-2)' },
      ],
    },

    // --- Items ---
    {
      name: 'items',
      type: 'array',
      label: 'Itens',
      fields: [
        { name: 'flower', type: 'relationship', relationTo: 'flowers', required: true, label: 'Flor' },
        { name: 'name', type: 'text', label: 'Nome' },
        { name: 'price', type: 'number', label: 'Preço unitário (€)' },
        { name: 'qty', type: 'number', label: 'Qtd', defaultValue: 1 },
        { name: 'lineTotal', type: 'number', label: 'Total linha (€)' },
        { name: 'productionMode', type: 'text', label: 'Modo de produção', admin: { readOnly: true } },
      ],
    },

    // --- Financial summary ---
    { name: 'subtotal', type: 'number', label: 'Subtotal (€)' },
    { name: 'discount', type: 'number', label: 'Desconto (€)', defaultValue: 0 },
    { name: 'shippingCost', type: 'number', label: 'Portes (€)' },
    { name: 'total', type: 'number', label: 'Total (€)' },
    { name: 'coupon', type: 'text', label: 'Cupão usado' },
    { name: 'currency', type: 'text', label: 'Moeda', defaultValue: 'EUR' },

    // --- Status ---
    {
      name: 'orderStatus',
      type: 'select',
      defaultValue: 'pending_payment',
      label: 'Estado da Encomenda',
      options: [
        { label: 'Rascunho', value: 'draft' },
        { label: 'A aguardar pagamento', value: 'pending_payment' },
        { label: 'Confirmada', value: 'confirmed' },
        { label: 'Em preparação', value: 'processing' },
        { label: 'Expedida', value: 'shipped' },
        { label: 'Concluída', value: 'completed' },
        { label: 'Cancelada', value: 'cancelled' },
        { label: 'Expirada', value: 'expired' },
      ],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      defaultValue: 'unpaid',
      label: 'Estado do Pagamento',
      options: [
        { label: 'Não pago', value: 'unpaid' },
        { label: 'Pendente', value: 'pending' },
        { label: 'Pago', value: 'paid' },
        { label: 'Falhou', value: 'failed' },
        { label: 'Reembolsado', value: 'refunded' },
      ],
    },

    // --- Locale ---
    { name: 'locale', type: 'text', label: 'Língua do pedido', defaultValue: 'pt' },

    // --- Checkout hash (hidden, unique when present) ---
    { name: 'checkoutRequestHash', type: 'text', unique: true, label: 'Hash do checkout', admin: { hidden: true } },

    // --- Checkout attempt id (UUID, server-generated, hidden) ---
    { name: 'checkoutAttemptId', type: 'text', unique: true, label: 'Checkout Attempt ID', admin: { hidden: true } },

    // --- Shipping snapshot (populated on finalization) ---
    { name: 'shippingProvider', type: 'text', label: 'Transportadora', admin: { hidden: true } },
    { name: 'shippingServiceCode', type: 'text', label: 'Cód. Serviço Envio', admin: { hidden: true } },
    { name: 'shippingServiceName', type: 'text', label: 'Serviço Envio', admin: { hidden: true } },
    { name: 'shippingEstimatedMinDays', type: 'number', label: 'Estimativa Min (dias)', admin: { hidden: true } },
    { name: 'shippingEstimatedMaxDays', type: 'number', label: 'Estimativa Max (dias)', admin: { hidden: true } },

    // --- Legacy fields (preserved for backward compatibility, hidden in admin) ---
    { name: 'email', type: 'email', label: 'Email (legado)', admin: { hidden: true } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      label: 'Estado (legado)',
      admin: { hidden: true },
      options: [
        { label: 'Pendente', value: 'pending' },
        { label: 'Pago', value: 'paid' },
        { label: 'Cancelado', value: 'cancelled' },
      ],
    },
  ],
}

const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, label: 'Nome', localized: true },
    { name: 'slug', type: 'text', required: true, unique: true, label: 'Slug' },
    { name: 'description', type: 'textarea', label: 'Descrição', localized: true },
  ],
}

const Collections: CollectionConfig = {
  slug: 'collections',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, label: 'Nome', localized: true },
    { name: 'slug', type: 'text', required: true, unique: true, label: 'Slug' },
    { name: 'description', type: 'textarea', label: 'Descrição', localized: true },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem' },
    { name: 'isActive', type: 'checkbox', required: true, defaultValue: true, label: 'Ativo?' },
  ],
}

const StockReservations: CollectionConfig = {
  slug: 'stock-reservations',
  admin: {
    useAsTitle: 'id',
    group: 'Loja',
    description: 'Reservas temporárias de stock. Apenas consulta.',
  },
  access: {
    read: ({ req }: any) => req?.user?.collection === 'users',
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  lockDocuments: false,
  fields: [
    { name: 'flower', type: 'relationship', relationTo: 'flowers', required: true, index: true, label: 'Produto' },
    { name: 'quantity', type: 'number', required: true, min: 1, defaultValue: 1, label: 'Quantidade' },
    {
      name: 'status', type: 'select', required: true, defaultValue: 'active',
      options: [
        { label: 'Ativa', value: 'active' },
        { label: 'Confirmada', value: 'confirmed' },
        { label: 'Expirada', value: 'expired' },
        { label: 'Libertada', value: 'released' },
      ],
      index: true, label: 'Estado',
    },
    {
      name: 'idempotencyKeyHash', type: 'text', required: true, unique: true,
      admin: { hidden: true },
      access: { read: () => false, create: () => false, update: () => false },
    },
    { name: 'order', type: 'relationship', relationTo: 'orders', label: 'Encomenda', admin: { readOnly: true } },
    { name: 'expiresAt', type: 'date', required: true, label: 'Expira em', admin: { readOnly: true } },
    { name: 'confirmedAt', type: 'date', label: 'Confirmada em', admin: { readOnly: true } },
    { name: 'expiredAt', type: 'date', label: 'Expirada em', admin: { readOnly: true } },
    { name: 'releasedAt', type: 'date', label: 'Libertada em', admin: { readOnly: true } },
  ],
}

const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Homepage',
  fields: [
    {
      type: 'group',
      name: 'hero',
      label: 'Hero',
      fields: [
        { name: 'heroImage', type: 'upload', relationTo: 'media', label: 'Imagem de Fundo' },
        { name: 'heroTitle', type: 'text', required: true, label: 'Título', localized: true },
        { name: 'heroSubtitle', type: 'textarea', required: true, label: 'Subtítulo', localized: true },
        { name: 'primaryButtonText', type: 'text', required: true, label: 'Texto (botão primário)', localized: true },
        { name: 'primaryButtonLink', type: 'text', required: true, label: 'Link (botão primário)' },
        { name: 'secondaryButtonText', type: 'text', label: 'Texto (botão secundário)', localized: true },
        { name: 'secondaryButtonLink', type: 'text', label: 'Link (botão secundário)' },
      ],
    },
    {
      type: 'group',
      name: 'realFlowers',
      label: 'Flores Verdadeiras',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título', localized: true },
        { name: 'subtitle', type: 'textarea', label: 'Subtítulo', localized: true },
      ],
    },
    {
      type: 'group',
      name: 'story',
      label: 'História',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título', localized: true },
        { name: 'text', type: 'textarea', required: true, label: 'Texto', localized: true },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem' },
      ],
    },
    {
      type: 'group',
      name: 'international',
      label: 'Presença Internacional',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título', localized: true },
        { name: 'subtitle', type: 'textarea', label: 'Subtítulo', localized: true },
      ],
    },
    {
      type: 'group',
      name: 'instagram',
      label: 'Instagram',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título', localized: true },
        { name: 'handle', type: 'text', required: true, label: 'Handle' },
        { name: 'text', type: 'textarea', label: 'Texto', localized: true },
      ],
    },
    {
      type: 'group',
      name: 'cta',
      label: 'CTA Final',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título', localized: true },
        { name: 'subtitle', type: 'textarea', label: 'Subtítulo', localized: true },
        { name: 'buttonText', type: 'text', required: true, label: 'Texto do botão', localized: true },
        { name: 'buttonLink', type: 'text', required: true, label: 'Link do botão' },
      ],
    },
    {
      type: 'group',
      name: 'footer',
      label: 'Footer',
      fields: [
        { name: 'brandDescription', type: 'textarea', label: 'Descrição da marca', localized: true },
        { name: 'email', type: 'text', label: 'Email' },
        { name: 'phone', type: 'text', label: 'Telefone' },
        { name: 'instagramUrl', type: 'text', label: 'URL Instagram' },
        { name: 'whatsappUrl', type: 'text', label: 'URL WhatsApp' },
      ],
    },
  ],
}

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  collections: [Flowers, Categories, Collections, Media, Coupons, Orders, StockReservations],
  globals: [Homepage],
  db,
  localization: {
    locales: [
      { code: 'pt', label: 'Português' },
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
      { code: 'it', label: 'Italiano' },
      { code: 'de', label: 'Deutsch' },
    ],
    defaultLocale: 'pt',
    fallback: true,
  },
  admin: {
    importMap: {
      baseDir: __dirname,
    },
  },
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-local-mudar-em-prod',
  typescript: { outputFile: 'src/payload-types.ts' },
})
