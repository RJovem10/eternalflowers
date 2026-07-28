# Eternal Flowers by Mar&Natur — Registo de Issues

> Documento central de acompanhamento do desenvolvimento.
> Actualizado em: 28 de Julho de 2026

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

# Issues em Progresso

🟡 Nenhuma neste momento.

---

# Próximas Issues

Ordenadas por prioridade estimada.

---

## 🟡 ISSUE-010 — Brand Intelligence & Design Knowledge Base

**Objectivo:** Consolidar informação visual do Instagram da marca (`@eternal.flowers.pt`, 171 publicações, 1.482 seguidores) num sistema de conhecimento para referência contínua.

**Trabalho previsto:**
- Análise detalhada das publicações
- Extracção de paleta de cores, estilos fotográficos, tipos de produto
- Criação de Design Knowledge Base documentado
- Princípios de fotografia de produto
- Download de imagens de referência para o disco

**Estado:** 🟡 Em progresso

---

## ⚪ Design Review

Revisão visual completa de todas as páginas implementadas (Homepage, Produto, Catálogo, Carrinho, Checkout). Critérios: consistência da marca, tipografia, experiência mobile, micro-interacções, estados de carregamento e vazio.

---

## ⚪ Refinamento Visual da Homepage

Ajustes finos: hero mais refinado, ícones de categoria personalizados, micro-interacções, transições suaves, galeria de destaques do Instagram.

---

## ⚪ Refinamento Visual da Página de Produto

Galeria com zoom/lightbox, indicador de stock, FAQ específica do produto, botão "falar com a Marina" (WhatsApp).

---

## ⚪ Catálogo — Filtros e Pesquisa

Filtros combinados (categoria + colecção + tipo + preço), pesquisa por nome, ordenação, paginação ou scroll infinito.

---

## ⚪ Checkout — Pagamentos

Integração de gateway (Stripe, PayPal ou MB WAY), tabela de portes, confirmação por email, página de estado da encomenda.

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

### Homepage CMS-driven
- Todo o conteúdo da homepage vem do Global `homepage`
- Componentes recebem dados por props; a página faz as queries Payload
- Fallbacks inline para CMS vazio

### Componentes Reutilizáveis
- Button: polimórfico (button + link), 3 variantes
- Section: container standard com título, subtítulo, background
- Server Components por defeito

### Página de Produto
- Layout: galeria (esq) + info (dir) desktop, empilhado mobile
- Dados enriquecidos com `depth: 2`
- Segue: história → atributos → relacionados

### i18n
- 5 idiomas: pt, en, es, it, de
- Dicionários tipados em `dictionaries.ts`
- Idioma por cookie + middleware

### Estilo
- Tailwind exclusivamente (sem CSS separado)
- Paleta: stone (neutro), rose/amber (acento)
- Inspirado em Apple, Tiffany & Co., Bang & Olufsen

---

## Resumo

| Indicador | Valor |
|-----------|-------|
| Total de Issues | 12 |
| ✅ Concluídas | 11 |
| 🟡 Em progresso | 1 |
| ⚪ Planeadas | 6 |