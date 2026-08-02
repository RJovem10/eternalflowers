# Fase E6A — Auditoria de Conteúdo e Plano de Traduções

> Data: 2 de Agosto de 2026
> Branch: `feature/issue-016-payload-localization`
> Head base: `630e97f`

## Resumo

Auditoria completa de todo o conteúdo localizado da Eternal Flowers para preparar traduções para en, es, it, de. A fase anterior (E6A da memória) continha erros de contagem que são corrigidos nesta errata.

## Errata Histórica (E6A original)

| Afirmação original | Valor correto | Causa |
|--------------------|---------------|-------|
| cta.subtitle vazio | **Preenchido** (112 caracteres) | A sessão E5 anterior usou marcadores que sobrescreveram o conteúdo. A auditoria E6A original baseou-se na base de teste com fixtures, não na base real. |
| 9 required no Homepage | **10 required** | O campo `instagram.title` também é NOT NULL. A documentação E4 tinha esta contagem incorreta. |
| 80 strings suffix por locale | **20 strings** | Names (10) + descriptions (10) = 20 por locale, não 80. O total de 100 inclui todos os 5 locales. |
| 68 slots por locale | **52 slots** | HP (16) + Cat (10) + Coll (12) + Story (10) + Suffix name (10) + Suffix desc (10) — mas estes valores não estavam consolidados |

## Estado Real das Bases

| Base | Migrações | Conteúdo real | Fixtures E5 | Utilização |
|------|-----------|---------------|-------------|------------|
| `loja.sqlite` (372KB) | Push:true apenas | ✅ 5 cat, 6 coll, 10 flores, 1 homepage c/ 16 campos PT | ❌ | Original — preservada |
| `loja-audit.sqlite` (cópia) | E1–E4 | ✅ Idêntico | ❌ | Usada para auditoria, removida |

**Nenhum marcador E5_HOME_* / E5_CATEGORY_* / E5_COLLECTION_* / E5_STORY_* existe no conteúdo real.** Eram fixtures temporárias da base de teste E5, já eliminada.

## Homepage — 16 Campos Localizados

**10 REQUIRED (NOT NULL):** hero.heroTitle, hero.heroSubtitle, hero.primaryButtonText, realFlowers.title, story.title, story.text, international.title, instagram.title, cta.title, cta.buttonText

**6 opcionais:** hero.secondaryButtonText, realFlowers.subtitle, international.subtitle, instagram.text, cta.subtitle, footer.brandDescription

| Grupo | Campo | Required | PT chars | PT words | Estado |
|-------|-------|----------|----------|----------|--------|
| Hero | heroTitle | ✅ | 43 | 6 | Preenchido |
| Hero | heroSubtitle | ✅ | 195 | 34 | Preenchido |
| Hero | primaryButtonText | ✅ | 18 | 2 | Preenchido |
| Hero | secondaryButtonText | | 10 | 2 | Preenchido |
| RealFlowers | title | ✅ | 27 | 3 | Preenchido |
| RealFlowers | subtitle | | 76 | 13 | Preenchido |
| Story | title | ✅ | 20 | 4 | Preenchido |
| Story | text | ✅ | 677 | 114 | Preenchido |
| International | title | ✅ | 22 | 2 | Preenchido |
| International | subtitle | | 74 | 15 | Preenchido |
| Instagram | title | ✅ | 21 | 3 | Preenchido |
| Instagram | text | | 98 | 17 | Preenchido |
| CTA | title | ✅ | 34 | 5 | Preenchido |
| CTA | subtitle | | 112 | 22 | Preenchido |
| CTA | buttonText | ✅ | 13 | 2 | Preenchido |
| Footer | brandDescription | | 78 | 11 | Preenchido |

**Todos os 16 campos estão preenchidos em PT.** Nenhum está vazio.

## Categories — 5 Reais

| ID | Slug | PT name | PT description | EN/ES/IT/DE |
|----|------|---------|---------------|-------------|
| 1 | colares | Colares | Pendentes e colares com flores verdadeiras preservadas. | VAZIO |
| 2 | brincos | Brincos | Brincos delicados com miniaturas botânicas. | VAZIO |
| 3 | pulseiras | Pulseiras | Pulseiras artesanais com elementos florais. | VAZIO |
| 4 | porta-chaves | Porta-chaves | Pequenas memórias que leva consigo. | VAZIO |
| 5 | molduras | Molduras | Molduras com flores verdadeiras. | VAZIO |

**10 relações Flowers → Categories** (2 flores por categoria). Slugs partilhados.

## Collections — 6 Reais

| ID | Slug | PT name | PT description | EN/ES/IT/DE |
|----|------|---------|---------------|-------------|
| 1 | casamentos | Casamentos | Para celebrar o amor. | VAZIO |
| 2 | dia-da-mae | Dia da Mãe | Memórias que florescem para sempre. | VAZIO |
| 3 | primavera | Primavera | Peças frescas e vibrantes. | VAZIO |
| 4 | memorias | Memórias | Um instante que o tempo não apaga. | VAZIO |
| 5 | natureza | Natureza | Inspirado na beleza natural. | VAZIO |
| 6 | edicao-limitada | Edição Limitada | Criações únicas em tiragem limitada. | VAZIO |

**19 relações Flowers → Collections.** Todas activas. Slugs partilhados.

## Flowers — 10 Reais

**Stories (campo localized nativo):** 10 histórias PT, 0 traduzidas para qualquer outro locale. Total: 3.982 chars / 635 palavras (média 64 palavras/story).

**Suffix Option B:**

| Campo | PT | EN | ES | IT | DE |
|-------|----|----|----|----|----|
| `name_pt/en/es/it/de` | ✅ 10/10 | ❌ 0/10 | ❌ 0/10 | ❌ 0/10 | ❌ 0/10 |
| `description_pt/en/es/it/de` | ✅ 10/10 | ❌ 0/10 | ❌ 0/10 | ❌ 0/10 | ❌ 0/10 |
| `scientific_name` | ✅ 10/10 | — | — | — | — |
| `creation_name` | ✅ 10/10 (=name_pt) | — | — | — | — |

20 strings por locale (10 names + 10 descriptions). Todos em falta para EN/ES/IT/DE.

## Dicionários Frontend

| Locale | Chaves | Palavras | Caracteres | Estado |
|--------|--------|----------|------------|--------|
| PT | 109 | 366 | 2.375 | Completo |
| EN | 109 | 351 | 2.143 | Completo |
| ES | 109 | ~350 | ~2.100 | Completo |
| IT | 109 | ~350 | ~2.100 | Completo |
| DE | 109 | ~350 | ~2.100 | Completo |

Os dicionários fornecem fallback UI mas NÃO alimentam o Payload. Conteúdos equivalentes (heróis, story, CTA) são semelhantes mas não idênticos aos campos do Payload.

## Mapa Total de Conteúdo

| Entidade | Strings PT | Palavras PT | EN/ES/IT/DE |
|----------|-----------|-------------|-------------|
| Dicionário | 109 | 366 | ✅ 109 cada |
| Homepage | 16 | ~221 | ❌ 0 |
| Categories | 10 | ~30 | ❌ 0 |
| Collections | 12 | ~39 | ❌ 0 |
| Flower stories | 10 | 635 | ❌ 0 |
| Flower suffix names | 10 | ~20 | ❌ 0 |
| Flower suffix descs | 10 | ~80 | ❌ 0 |
| **Total Payload** | **68** | **~1.025** | **0%** |
| **Total + dicionários** | **177** | **~1.391** | — |

**Por locale:** 68 strings Payload (1.025 palavras) + 109 dicionário (366 palavras) = 177 strings (~1.391 palavras).

**Percentagem traduzida (Payload):** 0% para EN, ES, IT, DE.

## Política de Tradução

| Tipo | Decisão |
|------|---------|
| Nomes de produtos (suffix) | Traduzir |
| Nomes de coleções | Traduzir |
| Nomes de categorias | Traduzir |
| Descrições de cat/col | Traduzir |
| Histórias (story) | Traduzir — tom emocional |
| Botões/CTAs | Traduzir — curtos, imperativos |
| Slugs | Manter partilhados |
| Nomes científicos | Manter em latim |
| creation_name | Manter em português |
| Marca: Eternal Flowers, Mar&Natur | Não traduzir |
| Handle, URLs, email | Não traduzir |

## Riscos

| Risco | Nível | Mitigação |
|-------|-------|-----------|
| Perda de conteúdo PT | Crítico | Backup DB + importador com dry-run obrigatório |
| Sobrescrita de traduções | Alto | Importador idempotente, sem overwrite sem confirmação |
| Tradução pouco natural | Alto | Revisão editorial (Sol) antes de importar |
| Inconsistência terminológica | Médio | Glossário aprovado previamente |
| Required do Homepage | Alto | Validar 10 required em todos os locales |
| Option B suffix | Médio | Não converter para localização nativa nesta fase |
| Mistura fallback/tradução real | Médio | Fallback PT preservado; só ler tradução quando existe |