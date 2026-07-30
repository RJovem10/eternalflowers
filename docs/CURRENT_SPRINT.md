# Eternal Flowers by Mar&Natur — Registo de Issues

> Documento central de acompanhamento do desenvolvimento.
> Actualizado em: 28 de Julho de 2026

---

## Resumo Executivo da Sprint

Esta sprint consolidou a **identidade da marca** e elevou a **qualidade visual** da homepage.

**O que mudou:**
- De 11 documentos de marca (filosofia, linguagem visual, fotografia, tom, taxonomia, etc.) que definem como qualquer decisão futura deve ser tomada
- Homepage redesenhada com tipografia premium (Cormorant Garamond + Inter), paleta oficial (creme, dourado, verde-sálvia), e fotografias reais do Instagram
- Hero centrado na Marina (editorial split 50/50), substituindo o hero genérico anterior
- 48 fotografias reais do Instagram descarregadas e integradas no site

**Decisões estruturais:**
- A marca é a Marina — o hero deixa de vender produtos e passa a apresentar a artesã
- A marca não é um template — cantos retos, whitespace generoso, dourado como acento
- As fotografias reais do Instagram substituem placeholders em toda a homepage

**Próxima prioridade:** Página de Produto — elevar ao mesmo nível de refinamento visual da homepage.

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Concluída |
| 🟡 | Em progresso |
| ⚪ | Planeada |

---

# Issues Concluídas

---

## ✅ ISSUE-001 — Infraestrutura do Projecto

**Objectivo:** Estabelecer a base técnica: ambiente de desenvolvimento, framework, CMS e base de dados.

**Trabalho realizado:**
- Setup Next.js 15 + App Router + React 19
- Instalação e configuração do Payload CMS 3
- Configuração do Tailwind CSS v3.4
- Configuração Docker + Docker Compose
- SQLite (dev) / PostgreSQL (prod)
- i18n com 5 idiomas (pt, en, es, it, de) via dicionários locais

**Decisões técnicas:**
- Stack: Next.js 15 + Payload CMS 3 + Tailwind CSS + SQLite/Postgres
- i18n sem bibliotecas externas — dicionário tipado + middleware
- Dev: `push: true` para schema automático
- Produção: PostgreSQL via Docker Compose

**Estado:** ✅ Concluída

---

## ✅ ISSUE-002 — Sistema de Cupões

**Objectivo:** Implementar descontos por código promocional.

**Trabalho realizado:**
- Colecção `Coupons` no Payload
- Tipos: percentagem e valor fixo
- Validação: validade, usos máximos, valor mínimo, primeira compra
- Route Handler `/api/coupon` com validação centralizada
- Integração com checkout e cálculo de totais

**Estado:** ✅ Concluída

---

## ✅ ISSUE-003 — Modelo de Domínio

**Objectivo:** Definir o funcionamento do negócio como base para todas as decisões técnicas.

**Trabalho realizado:**
- Tipos de produto: Permanente, Sazonal, Exclusivo
- Ciclo de vida dos produtos e encomendas
- Regras de stock: "Em stock" vs "Produzido por encomenda"
- Filosofia: tecnologia ao serviço da artesã
- Perfil do cliente ideal (mulher, 40-55 anos)
- Categorias: Colares, Brincos, Pulseiras, Porta-chaves, Molduras, Conjuntos
- Customer Journey e perguntas que o site deve responder
- Fotografia de modelo vs fotografia real da peça

**Documentos produzidos:** `docs/DOMAIN_MODEL.md`

**Estado:** ✅ Concluída

---

## ✅ ISSUE-004 — Evolução do Schema Payload

**Objectivo:** Implementar campos e colecções para representar o modelo de domínio no CMS.

**Trabalho realizado:**
- Passo 1: Campo `productType` (select: permanente, sazonal, exclusivo)
- Passo 2: Campos `scientificName` e `creationName`
- Passo 3: Colecção `Categories` + relationship Flowers → Category
- Passo 4: Colecção `Collections` + relationship Flowers ↔ Collections (many-to-many)
- Types actualizados com `payload generate:types`

**Decisões técnicas:**
- Categories: relação one-to-one com Flowers
- Collections: relação many-to-many com Flowers
- Ambas configuráveis pela Marina no CMS

**Estado:** ✅ Concluída

---

## ✅ ISSUE-005 — UX / Descoberta da Marca

**Objectivo:** Definir identidade visual, tom e experiência emocional.

**Trabalho realizado:**
- Identidade: luxo artesanal, humano, acessível, elegante, natureza, exclusividade
- Estrutura da homepage: Hero → Flores Verdadeiras → Categorias → Colecções → História → Escolhas da Marina → Presença Internacional → Instagram → CTA → Footer
- Customer Journey documentado
- Tom: delicado, artesanal, emocional, premium

**Estado:** ✅ Concluída

---

## ✅ ISSUE-006 — Homepage CMS-Driven

**Objectivo:** Tornar todo o conteúdo da homepage gerível pela Marina via Payload.

**Trabalho realizado:**
- Global `homepage` com grupos: hero, realFlowers, story, international, instagram, cta, footer
- Componentes: Hero, Section, RealFlowers, CategoriesSection, CollectionsSection, StorySection, MarinaPicks, InternationalPresence, InstagramSection, CTAFinal, Footer
- Fallbacks inline para quando o CMS está vazio
- Componentes puros (dados por props)

**Estado:** ✅ Concluída

---

## ✅ ISSUE-007 — Componentes Reutilizáveis

**Objectivo:** Criar biblioteca de componentes base.

**Trabalho realizado:**
- `Button` (primary/secondary/accent, button + link)
- `Section` (container com título, subtítulo, fundo)
- `FlowerCard`, `AddToCartButton`, `CartProvider`
- `Header` com selector de idioma, `Footer` com redes sociais
- Server Components por defeito; Client só com `'use client'`

**Estado:** ✅ Concluída

---

## ✅ ISSUE-008 — Catálogo & Checkout

**Objectivo:** Implementar navegação do catálogo e fluxo de checkout.

**Trabalho realizado:**
- Catálogo (`/[locale]/catalog`) com filtros por URL params
- Carrinho (`/[locale]/cart`) com items, quantidades, total
- Checkout (`/[locale]/checkout`) com formulário e resumo
- Página de agradecimento (`/[locale]/thank-you`)
- API: `/api/checkout` (criar encomenda), `/api/coupon` (validar cupão)
- Colecção `Orders` no Payload

**Decisões técnicas:**
- Carrinho gerido no cliente (localStorage) via CartProvider
- Encomenda persistida apenas após submissão do checkout

**Estado:** ✅ Concluída

---

## ✅ ISSUE-009 — Product Experience (Passo 1)

**Objectivo:** Criar página de produto com experiência premium (Apple, Tiffany, Bang & Olufsen).

**Trabalho realizado:**
- `ProductGallery`: galeria com imagem principal + miniaturas
- `ProductInfo`: nome, nome científico, categoria, colecções, tipo, preço, disponibilidade
- `ProductStory`: história do CMS ou placeholder
- `ProductAttributes`: 4 blocos com ícones SVG
- `RelatedProducts`: grelha de peças relacionadas

**Alterações ao CMS:**
- Campo `images` (array de uploads) na Flowers — para galeria
- Campo `story` (textarea) na Flowers — para história

**Design:** Muito espaço branco, tipografia leve, fotografia como elemento principal. Tailwind exclusivamente.

**Estado:** ✅ Concluída

---

## ✅ ISSUE-009A — Robustez dos Componentes

**Objectivo:** Eliminar "undefined", "null" e links quebrados no frontend.

**Problemas corrigidos:**
- Hero: fallback image via `<img>` em vez de CSS `url()` (resolução relativa)
- Hero/CTAFinal: links com `undefined` → função `safeLink()`
- FlowerCard: `displayName` com fallback para `'—'`
- InstagramSection: `safeHandle()` com fallback
- page.tsx: `|| '/'` nos valores do Hero

**Estado:** ✅ Concluída

---

## ✅ ISSUE-009B — Seed Data Premium

**Objectivo:** Criar dados de demonstração completos para avaliação da marca.

**Trabalho realizado:**
- 11 imagens placeholder (Pillow)
- 5 categorias, 6 colecções
- 10 produtos com nome, história, descrição, preço
- Homepage completa com todas as secções
- Script Python `scripts/seed.py` via REST API do Payload

**Produtos:** Lágrima de Orvalho, Sorriso da Manhã, Abraço Eterno, Memória Doce, Janela para o Jardim, Beijo de Luz, Dança das Pétalas, Raiz do Amor, Sussurro da Natureza, Eternidade em Flor

**Estado:** ✅ Concluída

---

## ✅ ISSUE-010 — Brand Intelligence & Design Knowledge Base

**Objectivo:** Compreender profundamente a identidade da Eternal Flowers através da análise do Instagram (@eternal.flowers.pt, 171 publicações, 1.482 seguidores) e consolidar num sistema de conhecimento para referência contínua.

**Trabalho realizado:**
- Análise detalhada do perfil Instagram: padrões visuais, tom de voz, tipos de conteúdo, highlights, arco narrativo das peças
- Identificação de espécies botânicas, coleções, tipos de produto, e materiais
- Definição da cliente ideal (Sofia, 28-55 anos), emoções que procura, e porque compra
- Mapeamento da experiência de marca completa: unboxing, email, cartão, QR code, página "Sobre a Marina"

**Documentos produzidos (10):**
- `docs/project-philosophy.md` — missão, visão, diferenciação, ecossistema da marca
- `docs/visual-language.md` — paleta oficial, tipografia, texturas, atmosfera, logótipo
- `docs/design-principles.md` — 10 princípios norteadores
- `docs/photography-guide.md` — guia completo de fotografia (macro, lifestyle, embalagem, bastidores, botânica)
- `docs/content-style.md` — tom, vocabulário, estrutura de textos, emojis, emails
- `docs/product-taxonomy.md` — categorias, coleções, tipos de peça, espécies botânicas
- `docs/instagram-insights.md` — análise do perfil, highlights, padrões, audiência
- `docs/development-standards.md` — padrões técnicos, stack, performance, componentes, Payload
- `docs/website-recommendations.md` — visão criativa do website, funcionalidades, storytelling
- `docs/brand-experience.md` — a marca completa: unboxing, email, cartão, QR, página "Sobre a Marina"

**Estado:** ✅ Concluída

---

## ✅ ISSUE-011 — Visual Refinement (Homepage V2)

**Objectivo:** Transformar a homepage numa experiência digna de uma marca premium, respeitando a identidade visual definida na ISSUE-010.

**Trabalho realizado:**
- Configuração do Tailwind com cores oficiais da marca (`brand.cream`, `brand.gold`, `brand.sage`, etc.)
- Instalação de tipografia Cormorant Garamond (títulos) + Inter (corpo) via `next/font`
- Redesenho completo do Header: fixed com backdrop-blur, logo com subtítulo "Resin Art & Jewelry", navegação em uppercase tracking
- Botões redesenhados: dourado como cor primária, sem border-radius, uppercase tracking
- Secções com alternância de fundos (branco → creme → branco → escuro) e tamanhos (compact → default → large)
- Remoção de todos os cantos arredondados (cantos retos = elegância)
- Linhas douradas decorativas entre título e subtítulo em cada secção
- Footer escuro com endereço completo da loja em Braga

**Ficheiros alterados:** `tailwind.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/[locale]/layout.tsx`, `src/components/Button.tsx`, `Header.tsx`, `Hero.tsx`, `Section.tsx`, `RealFlowers.tsx`, `CategoriesSection.tsx`, `CollectionsSection.tsx`, `StorySection.tsx`, `MarinaPicks.tsx`, `InternationalPresence.tsx`, `InstagramSection.tsx`, `CTAFinal.tsx`, `Footer.tsx`

**Documento produzido:** `docs/design-review-v2.md`

**Estado:** ✅ Concluída

---

## ✅ ISSUE-012 — Art Direction & Visual Storytelling (Homepage V3)

**Objectivo:** Elevar ainda mais a qualidade visual da homepage com referências explícitas a Apple (espaço branco), Tiffany & Co. (elegância) e Bang & Olufsen (fotografia).

**Trabalho realizado:**
- Hero redesenhado: full-screen, gradiente vertical suave, badge de entrada "Joias Botânicas Artesanais", scroll indicator, fallback gradiente sofisticado
- Sistema de `size` nas secções (default/large/compact) para criar ritmo visual
- RealFlowers: círculos com fotografias reais de orquídeas + nomes científicos
- StorySection: label "O Processo", formato editorial 3:4, espaçamento generoso entre parágrafos
- MarinaPicks: moldura dourada no hover, CTA com linha decorativa
- CTAFinal: textura de fundo (radial-gradient), label "Eternize uma Memória"
- Footer: setas douradas nos links sociais, transições consistentes
- Micro-detalhes: transições `duration-300` (rápidas) e `duration-700` (imagens, cinematográficas)

**Documento produzido:** `docs/design-review-v3.md`

**Estado:** ✅ Concluída

---

## ✅ ISSUE-012A — Corrigir URLs das Imagens do CMS

**Objectivo:** Resolver 404 nas imagens causado por URL hardcoded a apontar para a porta 3000.

**Causa raiz:** `src/payload.config.ts:266` — `serverURL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'`

**Correção:**
- `serverURL` passou a usar string vazia como fallback em vez de `'http://localhost:3000'`
- Com `serverURL` vazio, o Payload gera URLs relativas, que funcionam em qualquer porta
- Mesma correção aplicada no `docker-compose.yml`

**Estado:** ✅ Concluída

---

## ✅ ISSUE-013 — The Founder Hero

**Objectivo:** Criar um Hero centrado na Marina, substituindo o hero genérico de produtos.

**Trabalho realizado:**
- Análise de 3 propostas de composição (Editorial Split, Full-screen, Assimétrica)
- Proposta A vencedora: split 50/50 editorial, texto à esquerda, fotografia à direita
- Headline emocional em 2 linhas: "Joias Botânicas / Feitas à Mão"
- CTAs: "Descobrir Coleções" + "Conhecer a Marina"
- Badge "Artesanato · Braga · Portugal"
- Assinatura "Eternal Flowers — by Mar&Natur®" na base
- Cantos dourados decorativos na moldura da fotografia
- Fotografia real da Marina (marina-hero.jpg) integrada

**Ficheiros criados/alterados:**
- `src/components/FounderHero.tsx` — novo componente
- `src/app/[locale]/page.tsx` — Hero substituído por FounderHero

**Documento produzido:** `docs/design-review-v4.md`

**Estado:** ✅ Concluída

---

# Issues em Progresso

🟡 Nenhuma neste momento.

---

# Próximas Issues

Ordenadas por prioridade estimada.

---

## ⚪ Refinamento Visual da Página de Produto

Elevar a página de produto ao mesmo nível da homepage: tipografia, espaçamento, fotografia, micro-interacções. Galeria com zoom/lightbox, indicador de stock, FAQ específica, botão "falar com a Marina" (WhatsApp).

---

## ⚪ Catálogo — Filtros e Pesquisa

Filtros combinados (categoria + colecção + tipo + preço), pesquisa por nome, ordenação, paginação ou scroll infinito.

---

## ⚪ Checkout — Pagamentos

Integração de gateway (Stripe, PayPal ou MB WAY), tabela de portes, confirmação por email, página de estado da encomenda.

---

## ⚪ Página "O Processo" / Como é Feito

Scrollytelling do processo completo: colheita → desidratação → resina → joia. Conteúdo educativo que diferencia a marca.

---

## ⚪ Página "Sobre a Marina"

História pessoal da Marina, ligação à naturopatia (Mar&Natur), exposições internacionais, filosofia.

---

## ⚪ Área da Marina (Admin)

Dashboard personalizado: gestão de encomendas, notificações, estatísticas de vendas, gestão de stock, contacto com clientes.

---

# Anexo — Decisões Técnicas Importantes

### Arquitectura Payload
- CMS headless integrado no Next.js (App Router)
- Colecções: Flowers, Categories, Collections, Media, Coupons, Orders, Users
- Globals: homepage
- `push: true` em dev para schema automático; migrações manuais em prod
- `serverURL` dinâmico (string vazia como fallback) — URLs relativas de media funcionam em qualquer porta

### Homepage CMS-driven
- Todo o conteúdo da homepage vem do Global `homepage`
- Componentes recebem dados por props; a página faz as queries Payload
- Fallbacks inline para CMS vazio

### Componentes Reutilizáveis
- Button: polimórfico (button + link), 3 variantes (primary/secondary/ghost)
- Section: container standard com título, subtítulo, background, tamanho (default/large/compact)
- Server Components por defeito

### Paleta de Cores (Tailwind)
```typescript
brand: {
  cream: '#F5F0E8',     // Fundo de página
  gold: '#D4A853',       // CTAs, badges, hover states
  sage: '#A8B5A0',       // Badges, detalhes botânicos
  blush: '#E8B4B8',      // Destaques suaves
  lavender: '#C9B1D0',   // Edição limitada
  wood: '#8B7355',       // Elementos de suporte
  moss: '#6B7D5A',       // Confirmações
  charcoal: '#2C2C2C',   // Texto principal
}
```

### Tipografia
- Display: Cormorant Garamond (300, 400, 600, 700) — títulos, hero
- Body: Inter (300, 400, 500, 600) — corpo, UI, navegação
- Carregadas via `next/font/google` com `display: swap`

### Página de Produto
- Layout: galeria (esq) + info (dir) desktop, empilhado mobile
- Dados enriquecidos com `depth: 2`
- Segue: história → atributos → relacionados

### i18n
- 5 idiomas: pt, en, es, it, de
- Dicionários tipados em `dictionaries.ts`
- Idioma por cookie + middleware
- Middleware ignora ficheiros estáticos (imagens, fontes, CSS, JS)

### Estilo
- Tailwind exclusivamente (sem CSS separado)
- Cantos retos (sem border-radius) — elegância e artesanato
- Whitespace generoso — luxo e respiro visual
- Dourado como acento, não como cor dominante
- Inspirado em Apple (espaço), Tiffany & Co. (elegância), Bang & Olufsen (fotografia)

---

## Resumo

| Indicador | Valor |
|-----------|-------|
| Total de Issues | 16 |
| ✅ Concluídas | 15 |
| 🟡 Em progresso | 0 |
| ⚪ Planeadas | 5 |
| Documentos de marca | 10 |
| Fotografias Instagram integradas | 48 |