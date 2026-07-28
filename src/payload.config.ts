import { buildConfig, type CollectionConfig, type GlobalConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'

// Postgres (VPS) só quando DATABASE_URI começa por "postgres".
// Dev local: SQLite (ficheiro, sem servidor).
const uri = process.env.DATABASE_URI || ''
const usePostgres = uri.startsWith('postgres')
const db = usePostgres
  ? postgresAdapter({ pool: { connectionString: uri } })
  : sqliteAdapter({ client: { url: uri.startsWith('file:') ? uri : 'file:./loja.sqlite' }, push: true })

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
    { name: 'story', type: 'textarea', label: 'História da Peça' },
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
  admin: { useAsTitle: 'id' },
  fields: [
    { name: 'email', type: 'email', required: true, label: 'Email do cliente' },
    {
      name: 'items',
      type: 'array',
      label: 'Itens',
      fields: [
        { name: 'flower', type: 'text', label: 'ID da flor' },
        { name: 'name', type: 'text' },
        { name: 'price', type: 'number' },
        { name: 'qty', type: 'number', defaultValue: 1 },
      ],
    },
    { name: 'subtotal', type: 'number', label: 'Subtotal (€)' },
    { name: 'discount', type: 'number', label: 'Desconto (€)', defaultValue: 0 },
    { name: 'total', type: 'number', label: 'Total (€)' },
    { name: 'coupon', type: 'text', label: 'Cupão usado' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pendente', value: 'pending' },
        { label: 'Pago', value: 'paid' },
        { label: 'Cancelado', value: 'cancelled' },
      ],
    },
    { name: 'locale', type: 'text', label: 'Língua do pedido', defaultValue: 'pt' },
  ],
}

const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, label: 'Nome' },
    { name: 'slug', type: 'text', required: true, unique: true, label: 'Slug' },
    { name: 'description', type: 'textarea', label: 'Descrição' },
  ],
}

const Collections: CollectionConfig = {
  slug: 'collections',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, label: 'Nome' },
    { name: 'slug', type: 'text', required: true, unique: true, label: 'Slug' },
    { name: 'description', type: 'textarea', label: 'Descrição' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem' },
    { name: 'isActive', type: 'checkbox', required: true, defaultValue: true, label: 'Ativo?' },
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
        { name: 'heroTitle', type: 'text', required: true, label: 'Título' },
        { name: 'heroSubtitle', type: 'textarea', required: true, label: 'Subtítulo' },
        { name: 'primaryButtonText', type: 'text', required: true, label: 'Texto (botão primário)' },
        { name: 'primaryButtonLink', type: 'text', required: true, label: 'Link (botão primário)' },
        { name: 'secondaryButtonText', type: 'text', label: 'Texto (botão secundário)' },
        { name: 'secondaryButtonLink', type: 'text', label: 'Link (botão secundário)' },
      ],
    },
    {
      type: 'group',
      name: 'realFlowers',
      label: 'Flores Verdadeiras',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título' },
        { name: 'subtitle', type: 'textarea', label: 'Subtítulo' },
      ],
    },
    {
      type: 'group',
      name: 'story',
      label: 'História',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título' },
        { name: 'text', type: 'textarea', required: true, label: 'Texto' },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem' },
      ],
    },
    {
      type: 'group',
      name: 'international',
      label: 'Presença Internacional',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título' },
        { name: 'subtitle', type: 'textarea', label: 'Subtítulo' },
      ],
    },
    {
      type: 'group',
      name: 'instagram',
      label: 'Instagram',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título' },
        { name: 'handle', type: 'text', required: true, label: 'Handle' },
        { name: 'text', type: 'textarea', label: 'Texto' },
      ],
    },
    {
      type: 'group',
      name: 'cta',
      label: 'CTA Final',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'Título' },
        { name: 'subtitle', type: 'textarea', label: 'Subtítulo' },
        { name: 'buttonText', type: 'text', required: true, label: 'Texto do botão' },
        { name: 'buttonLink', type: 'text', required: true, label: 'Link do botão' },
      ],
    },
    {
      type: 'group',
      name: 'footer',
      label: 'Footer',
      fields: [
        { name: 'brandDescription', type: 'textarea', label: 'Descrição da marca' },
        { name: 'email', type: 'text', label: 'Email' },
        { name: 'phone', type: 'text', label: 'Telefone' },
        { name: 'instagramUrl', type: 'text', label: 'URL Instagram' },
        { name: 'whatsappUrl', type: 'text', label: 'URL WhatsApp' },
      ],
    },
  ],
}

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
  collections: [Flowers, Categories, Collections, Media, Coupons, Orders],
  globals: [Homepage],
  db,
  admin: {
    importMap: {
      baseDir: __dirname,
    },
  },
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-local-mudar-em-prod',
  typescript: { outputFile: 'src/payload-types.ts' },
})
