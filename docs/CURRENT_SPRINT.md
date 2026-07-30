# Eternal Flowers by Mar&Natur — Registo de Issues

> Documento central de acompanhamento do desenvolvimento.
> Actualizado em: 30 de Julho de 2026

---

## Resumo Executivo da Sprint

Esta sprint consolidou a **identidade da marca**, elevou a **qualidade visual** da homepage e corrigiu **problemas de runtime** detetados em validação real no browser.

**O que mudou:**
- De 11 documentos de marca (filosofia, linguagem visual, fotografia, tom, taxonomia, etc.) que definem como qualquer decisão futura deve ser tomada
- Homepage redesenhada com tipografia premium (Cormorant Garamond + Inter), paleta oficial (creme, dourado, verde-sálvia), e fotografias reais do Instagram
- Hero centrado na Marina (editorial split 50/50), substituindo o hero genérico anterior
- 48 fotografias reais do Instagram descarregadas e integradas no site
- Página "Conhecer a Marina" criada em /[locale]/about
- Imagens dos produtos corrigidas (depth: 1, acesso público, URLs relativas)
- Sobreposição do header fixed corrigida globalmente
- Estrutura de route groups reorganizada para eliminar hydration errors no Admin
- Página de produto redesenhada com experiência editorial premium (ProductGallery, ProductInfo, ProductStory, ProductAttributes, FlowerCard, RelatedProducts, AddToCartButton)
- UX de compra refinada: feedback "Adicionado ✓" com aria-live, navegação contextual (carrinho/checkout)
- Navegação mobile: menu hamburger com drawer, acesso a Início/Catálogo/Carrinho/Painel, seletor de idioma
- Link "← INÍCIO" no topo do catálogo

**Decisões estruturais:**
- A marca é a Marina — o hero deixa de vender produtos e passa a apresentar a artesã
- A marca não é um template — cantos retos, whitespace generoso, dourado como acento
- As fotografias reais do Instagram substituem placeholders em toda a homepage
- Route groups separados: (frontend) com layout próprio, (payload) com RootLayout do Payload
- APIs próprias da loja (checkout, coupon) mantidas no root, separadas da API REST do Payload

**Próxima prioridade:** A definir — backlog disponível na secção NEXT SESSION.

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
- Fotografia real da Marina (marina-hero.jpg, still de vídeo do Instagram) integrada
- Link "Conhecer a Marina" redirecionado para /[locale]/about (página mínima criada)

**Nota:** A fotografia atual é um still de vídeo do Instagram, considerada provisória. Futuramente poderá ser substituída por uma sessão fotográfica profissional com a Marina no atelier, conforme especificado em docs/design-review-v4.md.

**Ficheiros criados/alterados:**
- `src/components/FounderHero.tsx` — novo componente
- `src/app/[locale]/page.tsx` — Hero substituído por FounderHero
- `src/app/(frontend)/[locale]/about/page.tsx` — página "Conhecer a Marina"

**Documento produzido:** `docs/design-review-v4.md`

**Estado:** ✅ Concluída

---

## ✅ ISSUE-013B — Correções de Runtime

**Objectivo:** Corrigir problemas detetados em validação real no browser que não eram aparentes no build.

### 1. Imagens dos produtos no catálogo

**Causa raiz:** Três fatores encadeados:
- `depth: 0` nas queries do Payload → `f.image` era um número (ID), não o objeto populado
- Coleção `Media` sem `access: { read: () => true }` → API retornava 403 para público
- `NEXT_PUBLIC_SERVER_URL=http://localhost:3000` → URLs absolutas com porta fixa

**Correção:**
- `depth: 1` adicionado nas queries do catálogo e homepage
- `access: { read: () => true }` adicionado na coleção Media
- `NEXT_PUBLIC_SERVER_URL` esvaziado em `.env.local` para URLs relativas

**Resultado:** 10 imagens verificadas no browser com HTTP 200 e 800×800px.

### 2. Página "Conhecer a Marina"

**Causa raiz:** Botão no Hero apontava para `/${locale}/about`, rota inexistente.

**Correção:** Página mínima criada em `src/app/(frontend)/[locale]/about/page.tsx`. Aguarda desenvolvimento editorial completo.

### 3. Sobreposição do header fixed

**Causa raiz:** Header `fixed top-0` sem `padding-top` no `<main>`. Conteúdo de todas as páginas começava por baixo do header.

**Correção:**
- `<main>` no layout ganhou `pt-16 lg:pt-20` (64px mobile, 80px desktop)
- Homepage recebeu `-mt-16 lg:-mt-20` no wrapper para manter hero full-screen
- Hero text container ganhou `lg:pt-20` para texto começar abaixo do header

**Páginas validadas:** homepage, about, catálogo, carrinho, checkout, produto.

### 4. Hydration errors no Admin Payload

**Causa raiz:** `src/app/layout.tsx` renderizava `<html><body>` e `(payload)/layout.tsx` renderizava `<RootLayout>` com outro `<html><body>` → 4 hydration errors.

**Correção — Separação de route groups:**

```
src/app/
├── api/                    ← APIs da loja (checkout, coupon)
├── (frontend)/
│   ├── layout.tsx           ← html/body + fonts + globals.css
│   └── [locale]/            ← páginas do site
└── (payload)/
    ├── layout.tsx           ← RootLayout (próprio html/body)
    ├── admin/               ← painel Admin
    └── api/[...slug]/       ← API REST do Payload
```

**Resultado:**
- Zero hydration errors
- Zero html/body aninhados
- Admin, frontend e APIs validados no browser

**Validações concluídas:**
- `npm run build`: passou
- Homepage: 200
- Catálogo: 200 com imagens funcionais
- Página about: 200
- Carrinho: 200
- Checkout: 200
- Página de produto: 200
- Painel Admin: funcional, sem hydration errors
- Consola do browser: sem erros
- API coupon: funcional
- API Payload: funcional

**Ficheiros alterados:**
- `src/app/layout.tsx` — removido (substituído pelos route groups)
- `src/app/(frontend)/layout.tsx` — criado (root layout do frontend)
- `src/app/(frontend)/[locale]/` — movido de `src/app/[locale]/` (git mv)
- `src/app/(payload)/api/[...slug]/route.ts` — movido de `src/app/api/[...slug]/` (git mv)
- `src/app/(frontend)/[locale]/about/page.tsx` — criado
- `src/app/[locale]/catalog/page.tsx` — depth: 1
- `src/app/[locale]/page.tsx` — depth: 1 + -mt no wrapper
- `src/payload.config.ts` — access público na Media
- `.env.local` — NEXT_PUBLIC_SERVER_URL esvaziado
- `src/components/FounderHero.tsx` — lg:pt-20 no texto
- `src/app/[locale]/layout.tsx` — pt-16 lg:pt-20 no main

**Estado:** ✅ Concluída

🟡 Nenhuma neste momento.

---

## ✅ ISSUE-014 — Premium Product Experience

**Objectivo:** Transformar a página de produto numa experiência editorial premium, mantendo compatibilidade total com Payload CMS, carrinho, checkout, catálogo, SEO e i18n.

**Modelo usado:** GPT-5.6 Sol via Codex CLI (3 chamadas paralelas, ~7 minutos)

**Trabalho realizado:**
- **ProductGallery:** migrada para `next/image`, fundo `brand-cream`, cantos retos, thumbnails ocultas quando 1 imagem, fallback `/hero-fallback.png`
- **ProductInfo:** hierarquia tipográfica clara, cores `brand-*`, badges retos, estados disponibilidade tratados (available, reserved, sold, preparing)
- **ProductStory:** `return null` quando não existe história (sem placeholder técnico), formato editorial com label "A História"
- **ProductAttributes:** 4 blocos fixos da marca, cantos retos, grid 2/4 colunas, cores `brand-*`
- **RelatedProducts:** grid consistente, whitespace generoso, cores `brand-*`
- **FlowerCard:** cantos retos, sem sombras, fallback PNG, cores `brand-*`
- **AddToCartButton:** `bg-brand-gold`, cantos retos, lógica inalterada
- **Página de produto:** SEO dinâmico (generateMetadata), whitespace generoso, consistência com homepage

**Limitações atuais:**
- Produtos seed têm apenas uma imagem (galeria multi-imagem depende do CMS)
- Atributos continuam fixos da marca, não dinâmicos por produto
- Campo `story` é opcional — produtos sem história não mostram a secção
- Avisos `metadataBase` e `sharp` mantêm-se como conhecidos

**Documento produzido:** `docs/design-review-v5.md`

**Estado:** ✅ Concluída

---

## ✅ ISSUE-014B — Refinamento UX da Página de Produto

**Objectivo:** Corrigir problemas de UX identificados na revisão humana: feedback de carrinho, navegação contextual, carregamento de imagens e equilíbrio visual.

**Modelo usado:** GPT-5.6 Sol via Codex CLI

**Trabalho realizado:**
- **AddToCartButton:** feedback "Adicionado ✓" por 2.5s com aria-live; botão desabilitado durante feedback; bloqueio de cliques repetidos
- **Carrinho vazio:** link "Continuar a comprar" visível
- **Checkout:** link "← Voltar ao carrinho" no topo
- **Gap galeria-info:** reduzido de 48px para 32px (mobile) e 80px para 64px (desktop)
- **Traduções:** 3 novas chaves (addedToCart, continueShopping, backToCart) em pt, en, es, it, de
- **Imagens:** fundo do FlowerCard alterado para `bg-brand-cream` (neutro), evitando aspeto de erro durante carregamento
- **Atraso inicial:** identificado como comportamento de desenvolvimento (compilação dinâmica); em produção as páginas são pré-compiladas

**Risco:** baixo
**Duração:** ~2 minutos

**Estado:** ✅ Concluída

---

## ✅ ISSUE-014C — Navegação Mobile e Retorno Contextual

**Objectivo:** Completar a navegação mobile e adicionar retorno contextual no catálogo e demais páginas.

**Modelo usado:** GPT-5.6 Sol via Codex CLI (Header) + edição direta (catalog link)

### Parte 1 — Catálogo
- Link "← INÍCIO" adicionado no topo do catálogo, com o mesmo estilo visual do link "Voltar ao catálogo" da página de produto
- Destino explícito para `/${locale}`, funciona com URL direto, preserva locale

### Parte 2 — Menu mobile global
- Botão hamburger (SVG) visível apenas em mobile (`md:hidden`)
- Atributos `aria-label`, `aria-expanded`, `aria-controls` para acessibilidade
- Drawer lateral com fundo semi-transparente (`bg-brand-charcoal/20`)
- Links: Início, Catálogo, Carrinho (com badge), Painel
- Seletor de idioma reutilizado
- Fecho por: clique no X, clique no backdrop, tecla Escape, navegação num link
- `overflow: hidden` no body enquanto aberto
- Transições `duration-300` com paleta brand

### Correção de bug (pós-revisão)
- **Causa:** backdrop estava dentro do header `fixed z-50`; o stacking context do header impedia o menu de aparecer visualmente
- **Correção:** backdrop movido para fora do header através de React Fragment, passando a operar no stacking context raiz
- **Validação visual:** menu funcional, backdrop visível, navegação desktop inalterada

**Risco:** baixo

**Estado:** ✅ Concluída

---

## ✅ ISSUE-015 — The Founder Story

**Objectivo:** Criar a página editorial completa "Conhecer a Marina" em /[locale]/about, com 5 fotografias reais, texto biográfico em 5 idiomas, e experiência premium coerente com a homepage e página de produto.

**Modelo usado:** DeepSeek V4 Flash (análise fotográfica + implementação direta)

**Trabalho realizado:**

### Fotografia
- 6 fotografias reais copiadas para `public/marina/` com nomes e funções narrativas específicas
- Análise visual de cada imagem com IA de visão para determinar object-position em desktop e mobile
- Alt texts aprovados — factuais, sem emoções, sem interpretações subjetivas

### Página (10 secções)
1. **Hero editorial** — split 50/50 com `marina-hero-orquidea-rosa.jpeg`
2. **Percurso entre ciência e cuidado** — grid com `marina-terapeuta-bata-branca.jpeg`
3. **Formação e mudança para naturopatia e osteopatia** — texto centrado
4. **Criação da Mar&Natur** — texto centrado
5. **Origem da Eternal Flowers** — grid invertido com `marina-artesa-orquideas.jpeg`
6. **Aprendizagem e processo artesanal** — grid com `marina-processo-tesoura-orquidea.jpeg`
7. **Ritmo visual (opcional)** — banda larga com `marina-detalhe-ferramentas.jpeg` (usada)
8. **Exposições em Portugal e Espanha** — texto centrado
9. **A pessoa por detrás de cada peça** — grid invertido com `marina-retrato-natureza.jpeg`
10. **Citação final** — fundo escuro, blockquote
11. **CTA "Descobrir as peças"** — botão dourado

### i18n
- 5 idiomas completos: pt, en, es, it, de
- Texto base em português (versão editorial aprovada)
- Traduções com preservação de significado e tom elegante
- Documentado: necessitam de revisão humana antes da produção

### SEO e Acessibilidade
- `generateMetadata` com title e description localizados
- Open Graph com imagem do Hero
- Heading hierarchy: 1 h1 + 9 h2 (plana, sem skipping)
- Alt texts em português (a imagem é a mesma em todos os idiomas)
- Contraste adequado

### Ficheiros criados
- `src/content/about.ts` — conteúdo editorial completo para 5 idiomas
- `docs/design-review-v6.md` — documentação criativa

### Ficheiros alterados
- `src/app/(frontend)/[locale]/about/page.tsx` — substituído placeholder por página completa

### Validação
- `npm run build`: ✅ 0 erros
- `/pt/about`: 200, título "Conhecer a Marina — Eternal Flowers"
- `/en/about`: 200, título "Meet Marina — Eternal Flowers"
- `/de/about`: 200, título "Marina kennenlernen — Eternal Flowers"
- Consola browser: 0 erros JavaScript
- Network: 0 404/403
- Zero hydration errors
- Homepage e Admin sem regressões (não alterados)

### Limitações atuais
- `marina-retrato-natureza.jpeg` tem baixa resolução (768×1024)
- Iluminação inconsistente entre fotografias
- Traduções não verificadas por falantes nativos
- Avisos `metadataBase` e `sharp` mantêm-se como conhecidos

**Documento produzido:** `docs/design-review-v6.md`

**Estado:** ✅ Implementada — validação visual humana em curso

---

# Próximas Issues

Ordenadas por prioridade estimada.

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
- Coleção Media com `access: { read: () => true }` para permitir acesso público às imagens
- API REST do Payload em `(payload)/api/[...slug]`

### Arquitectura de Route Groups
```
src/app/
├── api/                          ← APIs próprias da loja
│   ├── checkout/route.ts
│   └── coupon/route.ts
├── globals.css
├── (frontend)/
│   ├── layout.tsx                ← html/body + fonts + globals.css + metadata
│   └── [locale]/                 ← páginas do site (homepage, about, cart, catalog, checkout, flower, thank-you)
└── (payload)/
    ├── layout.tsx                ← RootLayout do Payload (próprio html/body)
    ├── admin/[[...segments]]/    ← painel Admin
    └── api/[...slug]/            ← API REST do Payload
```

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
| Total de Issues | 21 |
| ✅ Concluídas | 21 |
| 🟡 Em progresso | 0 |
| ⚪ Planeadas | 3 |
| Documentos de marca | 10 |
| Fotografias Instagram integradas | 48 |

---

## NEXT SESSION

1. Confirmar working tree limpa.
2. Confirmar se todos os commits pendentes foram enviados para o repositório remoto.
3. Rever backlog e escolher a próxima prioridade.
4. Considerar como candidatos:
   - página "O Processo" / Como é Feito;
   - certificado digital e QR Code;
   - refinamento do checkout (Stripe, PayPal, MB WAY);
   - conteúdo e sessão fotográfica profissional.
5. Não assumir automaticamente qual será a próxima issue.