# Fase E5 — Frontend com Locale nas Queries Payload

> Data: 2 de Agosto de 2026
> Branch: `feature/issue-016-payload-localization`
> Head base: `ca1eb18`

## Resumo

Fazer o frontend enviar o locale atual e fallback PT para todas as queries Payload da Local API, garantindo que cada rota `/{locale}` recebe conteúdo localizado nativo.

## Queries Auditadas e Alteradas

| # | Ficheiro | Collection/Global | locale | fallbackLocale |
|---|----------|-------------------|--------|----------------|
| 1 | `[locale]/page.tsx:74` | homepage (findGlobal) | locale atual | pt |
| 2 | `[locale]/page.tsx:77` | categories (find) | locale atual | pt |
| 3 | `[locale]/page.tsx:78-84` | collections (find) | locale atual | pt |
| 4 | `[locale]/page.tsx:84` | flowers (find) | locale atual | pt |
| 5 | `[locale]/catalog/page.tsx:40` | flowers (find) | locale atual | pt |
| 6 | `[locale]/flower/[id]/page.tsx:30-34` | flowers (findByID metadata) | locale atual | pt |
| 7 | `[locale]/flower/[id]/page.tsx:75-79` | flowers (findByID depth:2) | locale atual | pt |
| 8 | `[locale]/flower/[id]/page.tsx:105-113` | flowers (find related) | locale atual | pt |

**Total:** 8 queries alteradas em 3 páginas.

**Não alteradas** (não têm campos localizados):
- `lib/coupon.ts` — coupons, orders
- `app/api/coupon/route.ts` — REST coupon
- `app/api/checkout/route.ts` — checkout/orders
- `src/middleware.ts` — locale detection (inalterado)

## Ficheiros Alterados

| Ficheiro | Tipo | Alteração |
|----------|------|-----------|
| `src/lib/payload-locale.ts` | **NOVO** | Helper tipado |
| `src/app/(frontend)/[locale]/page.tsx` | Modificado | 4 queries → locale |
| `src/app/(frontend)/[locale]/catalog/page.tsx` | Modificado | 1 query → locale |
| `src/app/(frontend)/[locale]/flower/[id]/page.tsx` | Modificado | 3 queries → locale |

## Helper

```typescript
// src/lib/payload-locale.ts
import type { Locale } from '@/i18n/dictionaries'

export function payloadLocaleOptions(locale: Locale) {
  return {
    locale,
    fallbackLocale: 'pt' as const,
  }
}
```

- Aceita `Locale` tipado (`'pt' | 'en' | 'es' | 'it' | 'de'`)
- Devolve `{ locale, fallbackLocale: 'pt' }`
- Sem `any`, sem duplicação de locales
- Usado com spread: `...payloadLocaleOptions(locale as Locale)`

## Locale e Fallback

| Parâmetro | Valor |
|-----------|-------|
| `locale` | Locale da rota (`'pt'`, `'en'`, `'es'`, `'it'`, `'de'`) |
| `fallbackLocale` | `'pt'` (defaultLocale) |

A config global do Payload já tem `fallback: true` e `defaultLocale: 'pt'` — o `fallbackLocale` explícito é redundante mas defensivo.

## Comportamento Esperado

- **Homepage** — 7 grupos com 16 campos localizados e 10 partilhados
- **Categories** — name e description localizados, slug partilhado
- **Collections** — name e description localizados, slug/image/isActive partilhados
- **Flowers** — story localizado, suffix (namePt/nameEn/descriptionPt/descriptionEn) preservados via Option B
- **Relações populadas** — Payload 3.86 propaga locale automaticamente para relações (depth≥1): Category e Collection aparecem no locale correto
- **Fallback PT** — ES, IT, DE sem tradução recebem PT
- **Links** — continuam com prefixo locale via frontend (`/${locale}/catalog`, etc.)
- **Suffix Option B** — preserve, não convertido. O locale só afeta `story` (campo localized). Nomes e descrições seguem o mapeamento `{ pt: 'namePt', en: 'nameEn', ... }`

## Fixtures de Teste

DB temporário: `loja-e5-test.sqlite` (cópia de `loja.sqlite` + E1→E4 migrado)

Marcadores de tradução:

| Entidade | PT | EN |
|----------|----|----|
| Homepage heroTitle | `E5_HOME_PT` | `E5_HOME_EN` |
| Category #1 name | `E5_CATEGORY_PT` | `E5_CATEGORY_EN` |
| Collection #1 name | `E5_COLLECTION_PT` | `E5_COLLECTION_EN` |
| Flower #1 story | `E5_STORY_PT` | `E5_STORY_EN` |

ES, IT, DE → sem tradução (fallback PT).

## Resultados HTTP — SQLite

| Rota | heroTitle | Categoria | Coleção | Status |
|------|-----------|-----------|---------|--------|
| `/pt` | `E5_HOME_PT` | `E5_CATEGORY_PT` | `E5_COLLECTION_PT` | 200 ✅ |
| `/en` | `E5_HOME_EN` | `E5_CATEGORY_EN` | `E5_COLLECTION_EN` | 200 ✅ |
| `/es` | `E5_HOME_PT` (fallback) | `E5_CATEGORY_PT` (fallback) | `E5_COLLECTION_PT` (fallback) | 200 ✅ |
| `/it` | `E5_HOME_PT` (fallback) | `E5_CATEGORY_PT` (fallback) | `E5_COLLECTION_PT` (fallback) | 200 ✅ |
| `/de` | `E5_HOME_PT` (fallback) | `E5_CATEGORY_PT` (fallback) | `E5_COLLECTION_PT` (fallback) | 200 ✅ |

**html lang:** `pt`, `en`, `es` corretos.
**Campos partilhados:** email, phone, URLs iguais em todos os locales.
**Flower story:** `/pt/flower/1` = `E5_STORY_PT`, `/en/flower/1` = `E5_STORY_EN`, `/es/flower/1` = `E5_STORY_PT`.
**Categoria populada na flor:** `/en/flower/1` mostra `E5_CATEGORY_EN` (relações propagam locale).
**Links:** todos com prefixo `/{locale}/` (ex: `href="/en/..."`).
**404:** `/en/flower/9999` = 404.
**Catalog:** todos os locales servem 200.

## Build SQLite

```
npm run build → 35/35 páginas, 5 locales SSG, 0 erros ✅
```

## PostgreSQL

**NÃO EXECUTADO.** O adapter PostgreSQL não tem `push: true` e o E1 (baseline) não existe como ficheiro de migração em `src/migrations-pg/`. As migrations PG (E2–E4) verificam a existência da tabela `flowers` e abortam se não existir. Para executar seria necessário:

1. Criar E1 baseline migration PG
2. Aplicar E2-PG → E3A-PG → E3B-PG → E4-PG

O comportamento de locale/fallback é independente do adapter — a camada Payload trata-o acima do banco. A validação SQLite é suficiente para aceitar a E5.

## Local API Direta

**NÃO EXECUTADA.** O comando `npx payload run` falha com `TypeError: Cannot destructure property 'loadEnvConfig'` — erro de compatibilidade entre `tsx` e `@next/env` no Payload 3.86 neste ambiente. O comportamento foi validado indiretamente via HTTP contra servidor built com SQLite.

## Nota sobre loja.sqlite

A base `loja.sqlite` original foi criada com `push: true` antes das migrations E1–E4 existirem. Não contém as tabelas `homepage_locales`, `categories_locales`, etc. O build contra esta base falha com `SQLITE_ERROR: no such table: homepage_locales` — comportamento esperado e documentado. A E5 requer uma base migrada com E1–E4.

## Revisão GPT-5.6 Sol

**Veredito:** APPROVED — Classificação A

**15/15 checks PASS.** Zero críticos, zero médios, 2 observações menores:

| # | Observação | Impacto | Resposta |
|---|-----------|---------|----------|
| 1 | `locale as Locale` nos call sites | Menor | Aceitável — o locale vem de `params` como `string`; a validação real ocorre no layout (`supportedLocales.has(candidate)`), e as páginas só são renderizadas após essa validação |
| 2 | PostgreSQL não testado | Menor | Aceitável — o comportamento de locale é tratado pela camada Payload, idêntico entre adapters. O E1 baseline não existe como ficheiro de migração, fora do âmbito da E5 |

### Checklist Sol

| Check | Resultado |
|-------|-----------|
| Locale tipado (não string livre) | ✅ `Locale` de `dictionaries.ts` |
| fallbackLocale: 'pt' explícito | ✅ |
| Propagação do locale a relações | ✅ Confirmado: `/en/flower/1` mostra `E5_CATEGORY_EN` |
| Option B dos suffix preservada | ✅ `namePt`/`nameEn`/`descriptionPt` não alterados |
| Mistura localized + suffix | ✅ Sem duplicação — story usa localização nativa, nomes usam suffix |
| SSG/cache | ✅ 35/35 páginas SSG com locale, sem warnings de cache |
| Links com locale | ✅ `href="/en/..."` preservado |
| Payload 3.86 compatibilidade | ✅ Tipos confirmados (find, findByID, findGlobal aceitam locale/fallbackLocale) |
| Regressões | ✅ Nenhuma (schema, migrations, slugs, uploads, auth, checkout inalterados) |

**Correções aplicadas:** Nenhuma — todos os checks passaram na primeira validação.