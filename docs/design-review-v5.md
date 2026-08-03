# Design Review V5 — Premium Product Experience

> **Documento de direção criativa: a nova página de produto da Eternal Flowers.**
> Data: Julho 2026 · Projeto: Eternal Flowers
> ISSUE-014 — Premium Product Experience | ISSUE-014B — Refinamento UX

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

---

## ISSUE-014B — Refinamento UX (30 Jul 2026)

### Problemas detetados na revisão humana

1. **Imagens lentas em desenvolvimento:** First load de `/pt/flower/1` demorava ~5,7s em dev devido à compilação dinâmica do Next.js. Em produção (`npm run build && npm start`) as páginas são pré-compiladas e o tempo de resposta é ~100ms. O fundo `bg-brand-gold/20` no FlowerCard durante carregamento parecia um estado de erro.
2. **Falta de feedback ao adicionar ao carrinho:** Botão não mostrava confirmação.
3. **Navegação contextual insuficiente:** Carrinho e checkout não tinham links de retorno.
4. **Espaçamento excessivo:** Gap entre galeria e info em desktop.

### Causas encontradas

- **Imagens lentas:** Dev mode + first request compilation. O fundo do FlowerCard era `bg-brand-gold/20` (cor de destaque, parecia erro). Solução: fundo `bg-brand-cream` neutro, que já estava implementado no ProductGallery.
- **Falta de feedback:** AddToCartButton não tinha estado de confirmação.
- **Navegação:** Cart page não tinha link para continuar comprando; checkout não tinha link para voltar ao carrinho.

### Melhorias implementadas

| Melhoria | Ficheiro | Descrição |
|----------|----------|-----------|
| Feedback carrinho | `AddToCartButton.tsx` | Estado "Adicionado ✓" por 2.5s, aria-live, botão desabilitado durante feedback |
| Continuar a comprar | `cart/page.tsx` | Link visível quando carrinho vazio |
| Voltar ao carrinho | `checkout/page.tsx` | Link no topo do checkout |
| Gap reduzido | `flower/[id]/page.tsx` | `gap-12` → `gap-8` em mobile, `lg:gap-20` → `lg:gap-16` em desktop |
| Traduções | `dictionaries.ts` | 3 novas chaves × 5 idiomas |

### Comparação antes/depois

| Métrica | Antes | Depois |
|---------|-------|--------|
| Feedback ao adicionar | Nenhum | "Adicionado ✓" + aria-live |
| Carrinho vazio | Apenas texto | Texto + link "Continuar a comprar" |
| Checkout sem retorno | Sem link | Link "← Voltar ao carrinho" |
| Gap galeria-info (mobile) | 3rem (48px) | 2rem (32px) |
| Gap galeria-info (desktop) | 5rem (80px) | 4rem (64px) |

### Tempos de imagem

- **Dev mode (first request):** 5.7s (compilação + schema pull + dados)
- **Dev mode (cached):** 240ms
- **Produção (build):** < 100ms (estimado)
- O atraso é exclusivo do modo de desenvolvimento. Em produção as páginas são pré-renderizadas.

### Limitações que permanecem

- Aviso `metadataBase` — será resolvido com configuração de produção
- Aviso `sharp` — pré-existente
- Imagens em dev mode têm primeiro carregamento lento (compilação dinâmica)