# Development Standards — Eternal Flowers

> **Padrões técnicos e de qualidade para o desenvolvimento do website.**
> Este documento garante que cada decisão técnica serve a marca e a experiência do cliente.
> Aplicável a developers, code reviewers, e modelos de IA que gerem código.

---

## 1. Stack Tecnológica

### 1.1 Framework Principal

| Tecnologia | Versão | Notas |
|---|---|---|
| **Next.js** | 15+ (App Router) | SSR para SEO, ISR para páginas de produto |
| **Payload CMS** | 3.x | Headless CMS, content management |
| **Tailwind CSS** | v3.4 | Utility-first styling |
| **TypeScript** | 5.x | Type safety em todo o código |
| **SQLite** | Dev | Base de dados de desenvolvimento |
| **PostgreSQL** | Produção | VPS |

### 1.2 Dependências Críticas

- **next/image** — para todas as imagens (optimização automática, lazy loading)
- **tailwindcss/forms** — estilização de formulários
- **@payloadcms/richtext-lexical** — editor de conteúdo rico
- **next-seo** / metadata API — SEO por página

---

## 2. Princípios de Código

### 2.1 Qualidade artesanal

O código deve refletir o mesmo cuidado que as joias:

- **Limpo** — sem dead code, sem comentários desnecessários, sem imports não usados
- **Consistente** — mesmas convenções em todo o projeto
- **Testado** — testes unitários para funções críticas, testes de integração para fluxos de compra
- **Documentado** — componentes com JSDoc, tipos exportados, ADRs para decisões arquiteturais

### 2.2 Performance como Prioridade

| Métrica | Target |
|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s |
| **FID** (First Input Delay) | < 100ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 |
| **Tempo de primeira carga (4G)** | < 3s |
| **Tamanho de bundle JS** | < 150KB (gzip) |
| **Tamanho de página** | < 500KB (incluindo imagens otimizadas) |

### 2.3 Acessibilidade

- **WCAG 2.1 AA** como standard mínimo
- **Contraste de cor:** ratios que excedem 4.5:1 para texto normal, 3:1 para texto grande
- **Navegação por teclado:** todos os elementos interativos acessíveis por Tab
- **Alt text:** todas as imagens de produto com descrição significativa
- **Aria labels:** onde necessário para elementos não-nativos
- **Focus states:** visíveis e estilizados (nunca `outline: none`)

### 2.4 SEO

- **Meta tags únicas** por página (title, description, og:image)
- **Schema.org structured data** (Product, Collection, LocalBusiness)
- **Open Graph tags** para partilhas em redes sociais
- **Sitemap dinâmico** gerado pelo CMS
- **URLs limpas** — `/produtos/blue-orchid` não `/produtos?id=123`

---

## 3. Arquitetura de Componentes

### 3.1 Princípio: Dados por Props

Componentes **não fazem fetch** diretamente. Recebem dados por props.

```
Página (Server Component)
  ├── Faz fetch dos dados
  └── Passa dados como props para componentes filhos
       ├── ProductCard({ product, variant })
       ├── CollectionGrid({ collection })
       └── StorySection({ text, image })
```

### 3.2 Organização de Ficheiros

```
src/
├── app/                    # App Router pages
│   ├── (marketing)/        # Homepage, About, Process
│   ├── (shop)/             # Category, Product pages
│   └── api/                # API routes
├── components/
│   ├── ui/                 # Base UI (Button, Card, Badge)
│   ├── layout/             # Header, Footer, Navigation
│   ├── product/            # ProductCard, ProductGallery, ProductInfo
│   ├── collections/        # CollectionGrid, CollectionHero
│   └── shared/             # InstagramFeed, Testimonial, Newsletter
├── lib/
│   ├── payload/            # CMS queries, types
│   ├── utils/              # Helpers (formatPrice, slugify)
│   └── constants/          # Brand colors, site config
└── styles/
    └── globals.css         # Tailwind + brand tokens
```

### 3.3 Naming Conventions

| Tipo | Pattern | Exemplo |
|---|---|---|
| Componentes | PascalCase | `ProductCard.tsx` |
| Funções utilitárias | camelCase | `formatPrice()` |
| Tipos/Interfaces | PascalCase | `ProductType` |
| Constantes | UPPER_SNAKE | `BRAND_COLORS` |
| Ficheiros CSS | kebab-case | `product-gallery.css` |
| Variáveis CSS | kebab-case | `--ef-gold` |

---

## 4. Brand no Código

### 4.1 Tailwind Config — Cores da Marca

```typescript
// tailwind.config.ts
colors: {
  brand: {
    cream: '#F5F0E8',
    gold: '#D4A853',
    sage: '#A8B5A0',
    blush: '#E8B4B8',
    lavender: '#C9B1D0',
    wood: '#8B7355',
    moss: '#6B7D5A',
    charcoal: '#2C2C2C',
  }
}
```

### 4.2 Variáveis CSS Globais

```css
:root {
  --ef-cream: #F5F0E8;
  --ef-gold: #D4A853;
  --ef-sage: #A8B5A0;
  --ef-font-display: 'Cormorant Garamond', serif;
  --ef-font-body: 'Inter', system-ui, sans-serif;
}
```

### 4.3 Fontes

Carregar com `next/font`:

```typescript
import { Cormorant_Garamond, Inter } from 'next/font/google'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-display',
})

const body = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
})
```

---

## 5. CMS (Payload) — Estrutura de Conteúdo

### 5.1 Collections Principais

| Collection | Slug | Descrição |
|---|---|---|
| Produtos | `products` | Catálogo de joias (com todos os metadados) |
| Coleções | `collections` | Agrupamentos temáticos |
| Categorias | `categories` | Brincos, Anéis, Pingentes... |
| Tipos de Produto | `product-types` | Argola, Gancho, Ajustável... |
| Espécies Botânicas | `species` | Catálogo de flores |
| Páginas | `pages` | Homepage, About, Process |
| Testemunhos | `testimonials` | Feedback de clientes |
| Configurações | `settings` | Site-wide settings, SEO global |

### 5.2 Campos Globais

```typescript
const Products: CollectionConfig = {
  slug: 'products',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'productType', relationTo: 'product-types' },
    { name: 'categories', type: 'relationship', hasMany: true, relationTo: 'categories' },
    { name: 'collections', type: 'relationship', hasMany: true, relationTo: 'collections' },
    { name: 'species', type: 'relationship', relationTo: 'species' },
    { name: 'images', type: 'array', fields: [/* upload */] },
    { name: 'price', type: 'number', required: true },
    { name: 'compareAtPrice', type: 'number' },
    { name: 'stock', type: 'number', defaultValue: -1 }, // -1 = made to order
    { name: 'shortDescription', type: 'textarea', maxLength: 120 },
    { name: 'description', type: 'richText' },
    { name: 'story', type: 'richText' },
    { name: 'isPersonalizable', type: 'checkbox' },
    { name: 'isRare', type: 'checkbox' },
    { name: 'productionTime', type: 'text', defaultValue: '5–7 dias úteis' },
  ],
}
```

---

## 6. Fluxos de Desenvolvimento

### 6.1 Processo de Issue

1. Issue é aberta com a **análise de impacto na marca** (como esta funcionalidade serve a filosofia?)
2. Design review baseado nos **Design Principles**
3. Implementação com **testes**
4. Code review com **checklist de qualidade**
5. Deploy com **verificação de performance**

### 6.2 Git Conventions

- **Commits:** `type(scope): descrição` (ex: `feat(products): add botanical species taxonomy`)
- **Branches:** `feature/issue-numero-descricao` (ex: `feature/010-brand-knowledge`)
- **PRs:** Sempre com descrição do impacto visual e funcional

### 6.3 Checklist de Qualidade Pré-Deploy

- [ ] Funcionalidade corresponde ao design e aos princípios da marca
- [ ] Performance auditada (Lighthouse > 90 em todas as categorias)
- [ ] Responsivo (mobile, tablet, desktop)
- [ ] Acessível (navegação por teclado, contraste, screen reader)
- [ ] Imagens otimizadas (WebP, lazy loading, dimensões corretas)
- [ ] Texto em PT-PT, consistente com o content-style guide
- [ ] SEO meta tags preenchidas
- [ ] Sem dead code, sem console.log, sem warnings

---

## 7. Experiência do Cliente (CX)

### 7.1 A Loja Online como Atelier

Cada ponto de contacto digital deve refletir o atelier físico:

| Momento | Sensação | Implementação |
|---|---|---|
| **Chegada ao site** | Entrar no atelier | Hero acolhedor, imagens de bastidores, luz quente |
| **Navegação** | Folhear um caderno de coleções | Apresentação editorial, whitespace generoso |
| **Ver um produto** | Pegar na peça para examinar | Galeria com zoom macro, múltiplos ângulos |
| **Ler a descrição** | Ouvir a história da artesã | Storytelling em vez de specs técnicas |
| **Checkout** | Encomendar como quem faz um pedido personalizado | Mensagem de confirmação pessoal, prazo realista |
| **Pós-compra** | Receber um presente enviado com cuidado | Email de confirmação caloroso, dicas de cuidado |
| **Unboxing** | Abrir uma caixa feita à mão | Embalagem que vale por si (cartão, ráfia, agradecimento) |

### 7.2 Mensagens Transacionais

**Confirmação de encomenda:**
> "A tua joia Eternal Flowers está a ser criada. Vou escolher a flor perfeita, desidratá-la com cuidado e encapsulá-la à mão. Receberás notícias minhas quando estiver pronta. 💖 — Marina"

**Notificação de envio:**
> "A tua joia já está pronta e vai a caminho! Espero que gostes tanto de a receber como eu gostei de a criar. 🌸"

**Follow-up:**
> "Já recebeste a tua joia? Conta-me como foi a experiência — adoro saber como as minhas peças chegam a quem as encomenda. 💌"