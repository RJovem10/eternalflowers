# Design Review V5 — Premium Product Experience

> **Documento de direção criativa: a nova página de produto da Eternal Flowers.**
> Data: Julho 2026 · Projeto: Eternal Flowers
> ISSUE-014 — Premium Product Experience

---

## Estado Anterior

A página de produto (`/[locale]/flower/[id]`) era funcional mas visualmente inconsistente com a homepage:

- **Cores:** usava paleta `stone-*`, `rose-*`, `emerald-*`, `amber-*`, `sky-*` — não alinhada com a paleta `brand-*` da marca
- **Cantos:** `rounded-3xl`, `rounded-xl`, `rounded-lg`, `rounded-full` — contradiziam o princípio "cantos retos = elegância"
- **Galeria:** `<img>` nativo com `@ts-ignore`, fallback emoji 🌷
- **Placeholder técnico:** `ProductStory` mostrava caixa tracejada quando não existia história
- **Sombras:** `shadow-sm`, `shadow-md` — a marca não usa sombras
- **FlowerCard:** cantos arredondados, sombras, cores incorrectas

## Decisões de Design

### Galeria (ProductGallery)

- Migrada para `next/image` — otimização automática
- Fundo `bg-brand-cream` — consistente com a homepage
- Cantos retos — alinhado com a identidade da marca
- Thumbnails ocultas quando existe apenas uma imagem
- Fallback: `/hero-fallback.png` (placeholder existente da marca)
- Transições `duration-500` — cinematográficas

### Informação do Produto (ProductInfo)

- Hierarquia tipográfica: nome (display), nome científico (itálico, subtil), preço (destaque)
- Categoria/coleção: chips discretos com cores `brand-wood`
- Disponibilidade: badges sem cantos arredondados, cores `brand-*`:
  - Available: `brand-sage`
  - Reserved: `brand-blush`
  - Sold: `brand-charcoal/40`
  - Preparing: `brand-lavender`
- Descrição: whitespace generoso, `brand-charcoal/60`

### História (ProductStory)

- Removido placeholder técnico (caixa tracejada)
- Se não existir história no CMS: `return null` — a secção não aparece
- Se existir: formato editorial com label "A História"
- Cores `brand-*`

### Atributos (ProductAttributes)

- 4 blocos fixos mantidos (flor real, handmade, peça única, embalagem premium)
- Cantos retos, cores `brand-*`
- Grid 2 colunas mobile, 4 desktop

### Card de Produto (FlowerCard)

- Cantos retos (removidos `rounded-xl`, `rounded`)
- Sem sombras (removidos `shadow-sm`, `shadow-md`)
- Fallback: `/hero-fallback.png`
- Cores `brand-*`

### Botão Adicionar ao Carrinho (AddToCartButton)

- `bg-brand-gold` → `hover:bg-brand-gold-dark`
- Cantos retos
- Lógica de carrinho inalterada

## Componentes Alterados

| Componente | Ficheiro | Principais Alterações |
|-----------|----------|----------------------|
| ProductGallery | `src/components/ProductGallery.tsx` | next/image, brand-cores, cantos retos, fallback PNG |
| ProductInfo | `src/components/ProductInfo.tsx` | brand-cores, badges retos, hierarquia |
| ProductStory | `src/components/ProductStory.tsx` | return null sem story, formato editorial |
| ProductAttributes | `src/components/ProductAttributes.tsx` | brand-cores, cantos retos |
| RelatedProducts | `src/components/RelatedProducts.tsx` | brand-cores, whitespace |
| FlowerCard | `src/components/FlowerCard.tsx` | cantos retos, sem sombras, brand-cores |
| AddToCartButton | `src/components/AddToCartButton.tsx` | brand-gold, cantos retos |
| Product page | `src/app/(frontend)/[locale]/flower/[id]/page.tsx` | whitespace, SEO dinâmico, brand-cores |

## Dados Preservados

- Todos os campos da coleção `Flowers` no CMS
- Relações com `Categories` e `Collections`
- Lógica do carrinho (CartProvider, AddToCartButton)
- Checkout, catálogo, homepage — inalterados
- i18n em 5 idiomas
- Rotas existentes

## Funcionalidades sem Regressão

Verificadas no browser:
- Página de produto com 1 imagem ✅
- Página de produto com várias imagens ✅
- Produto disponível ✅
- Produto reservado (Beijo de Luz) ✅
- Produto sem história (story null) — secção oculta ✅
- Adicionar ao carrinho ✅
- Navegação catálogo → produto ✅
- Navegação produto relacionado → produto ✅
- pt, en ✅
- Consola sem erros JavaScript ✅
- Network sem 404/403 ✅
- Build sem erros ✅

## Limitações Atuais do CMS

- Campo `story` é opcional — produtos sem história não mostram a secção
- Atributos são fixos da marca, não dinâmicos por produto
- Galeria multi-imagem depende do CMS ter `images[]` preenchido
- Seed data tem 1 imagem por produto, não várias

## Melhorias Futuras (Fora Desta ISSUE)

- Galeria com zoom/lightbox nativo
- Página "O Processo" / Como é Feito
- Integração Stripe para pagamentos
- Página "Sobre a Marina" completa
- Sessão fotográfica profissional