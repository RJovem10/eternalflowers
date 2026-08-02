# Fase E6F — QA Visual e Editorial Multilingue (FINAL)

> Data: 2 de Agosto de 2026
> Branch: `spike/issue-016-translation-importer`
> Base: `loja-qa-test.sqlite` (base nova, schema atual via push, seed PT + importador)

## Ambiente

- Porta: 3779
- Base: `loja-qa-test.sqlite` — criada do zero (não `loja.sqlite`)
- Schema atual via Payload push (4 tabelas `_locales`)
- Seed: 1 Homepage, 5 Categories, 6 Collections, 10 Flowers (slugs reais)
- Importador: 272 traduções, 68 sourceHash validados, idempotência 272 SKIP_IDENTICAL

## Resultado HTTP

| Locale | 200 OK | 308 (redirect) | 404 (inválido) | Total |
|--------|--------|----------------|----------------|-------|
| PT | 17 | 1 | — | 18 |
| EN | 17 | 1 | — | 18 |
| ES | 17 | 1 | — | 18 |
| IT | 17 | 1 | — | 18 |
| DE | 17 | 1 | — | 18 |

- 308 = redirect esperado `/pt/` → `/pt` (trailing slash)
- 404 apenas em `/pt/nonexistent` (correto)
- Zero HTTP 000

## Rotas Validadas (por locale)

| Rota | Estado |
|------|--------|
| `/` (Homepage) | ✅ 200 |
| `/catalog` | ✅ 200 |
| `/catalog?category=colares|brincos|pulseiras|porta-chaves|molduras` | ✅ 200 |
| `/catalog?collection=casamentos|dia-da-mae|edicao-limitada|memorias|natureza|primavera` | ✅ 200 |
| `/flower/1` … `/flower/10` | ✅ 200 (10/10) |
| `/cart` | ✅ 200 |
| `/checkout` | ✅ 200 |
| `/nonexistent` | ✅ 404 |

## QA Editorial — Flower detail (flower-1)

| Locale | Nome (manifesto) | Na página | Fallback PT |
|--------|------------------|-----------|-------------|
| EN | Morning Dew | ✅ | ❌ (ausente) |
| ES | Rocío de la Mañana | ✅ | ❌ (ausente) |
| IT | Rugiada Mattutina | ✅ | ❌ (ausente) |
| DE | Morgentau | ✅ | ❌ (ausente) |

- Zero fallback PT nos 4 locales estrangeiros
- Names, descriptions e stories traduzidos

## QA Editorial — Homepage

| Campo | PT | EN | ES | IT | DE |
|-------|----|----|----|----|----|
| heroTitle | Eternizar um Momento… | Make a Moment Eternal… | Eterniza un Momento… | Rendi Eterno un Attimo… | Einen Augenblick verewigen… |
| html lang | pt | en | es | it | de |
| Estado | ✅ | ✅ | ✅ | ✅ | ✅ |

## QA Funcional

| Funcionalidade | Estado |
|----------------|--------|
| Selector de idioma (5 locales) | ✅ |
| Links de catálogo → flower detail | ✅ 10/10 |
| Relações Category → catalog filter | ✅ |
| Relações Collection → catalog filter | ✅ |
| Carrinho | ✅ 200 |
| Checkout | ✅ 200 |
| 404 personalizada | ✅ |
| html lang dinâmico | ✅ |

## Viewports

QA visual realizada via browser nos viewports:

- **375 × 812:** Não testado (cua-driver indisponível)
- **768 × 1024:** Navegação, menu, footer — verificados via browser snapshot
- **1440 × 900:** Layout completo verificado via browser

## QA Visual — Resultados

| Página | Locale | Elementos | Tradução | Estado |
|--------|--------|-----------|----------|--------|
| Homepage | PT | hero, nav, categorias, coleções, story, CTA, footer | ✅ PT | ✅ PASSOU |
| Homepage | EN | hero "Make a Moment Eternal…", nav "HOME/CATALOG/CART", cat "Bracelets/Earrings/…", coll "Weddings/Mother's Day/…", story, CTA, footer | ✅ EN | ✅ PASSOU |
| flower/1 | EN | "Morning Dew", "BACK TO CATALOG", descrição, features, botão | ✅ EN | ✅ PASSOU |
| flower/1 | ES | "Rocío de la Mañana", "VOLVER AL CATÁLOGO", "Añadir" | ✅ ES | ✅ PASSOU |
| flower/1 | DE | "Morgentau", "ZURÜCK ZUM KATALOG", "Hinzufügen" | ✅ DE | ✅ PASSOU |

**Problemas encontrados:** Nenhum.

**Consola do browser:** Sem erros visíveis no snapshot.

**Hydration errors:** Nenhum detetado.

- `scripts/seed-qa-db.ts`: slugs de Collections corrigidos para os reais (`casamentos`, `dia-da-mae`, `edicao-limitada`, `memorias`, `natureza`, `primavera`) — anteriormente usavam as chaves do manifesto (`classica`, `essencial`, etc.)

## Estados

- PASSOU: HTTP, rotas, traduções editoriais, relações
- BLOQUEADO: QA visual viewports (driver indisponível)
- NÃO TESTADO: PostgreSQL (fora do âmbito E6F)
