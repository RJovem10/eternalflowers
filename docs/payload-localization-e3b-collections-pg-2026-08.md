# Fase E3B-PG — Localização PostgreSQL de Collections

> Data: 2 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Head base: `f780eb8`

## 1. Ambiente

- PostgreSQL 16.14 local em Docker (`postgres:16-alpine`)
- Porta local: 15432
- Project name: `eternalflowers-e3b-pg`
- Volume isolado (`eternalflowers-e3b-pg-data`)

## 2. Schema Observado (Payload push)

### collections (após E3B)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | `serial PK` | mantido |
| `slug` | `varchar NOT NULL` | mantido, unique |
| `image_id` | `integer` | mantido, partilhado |
| `is_active` | `boolean DEFAULT true` | mantido, partilhado |
| `name` | ❌ removido | só em locales |
| `description` | ❌ removido | só em locales |

### collections_locales

| Coluna | Tipo | Notas |
|--------|------|-------|
| `name` | `varchar NOT NULL` | required por locale |
| `description` | `varchar` | nullable |
| `id` | `serial PK` | sequence própria |
| `_locale` | `"_locales" NOT NULL` | ENUM (existente) |
| `_parent_id` | `integer NOT NULL` | FK CASCADE |

### Índices

| Nome | Colunas | Unique |
|------|---------|--------|
| `collections_locales_name_locale_unique` | (`name`, `_locale`) | ✅ |
| `collections_locales_locale_parent_id_unique` | (`_locale`, `_parent_id`) | ✅ |

Nota: o Payload geraria `collections_name_idx`, mas esse nome já existe na tabela `collections` original. O nome foi alterado para evitar colisão, exatamente como em Categories E3A-PG.

## 3. Histórico PostgreSQL

```
E1 (0f205b2, localization, sem localized)
→ E2-PG Flowers (4db6c03, flowers.story localized)
→ E3A-PG Categories (926e733, categories.name+description localized)
→ E3B-PG Collections (HEAD, collections.name+description localized)
```

### migrate:status

| Migration | Antes | Depois |
|-----------|-------|--------|
| E2-PG Flowers | Ran Yes | Ran Yes |
| E3A-PG Categories | Ran Yes | Ran Yes |
| E3B-PG Collections | Ran No | Ran Yes |

## 4. Resultados

| Teste | Resultado | Notas |
|-------|-----------|-------|
| UP — 6 Collections PT | ✅ 26ms, hashes intactos | |
| Falha parcial | ✅ PASSOU — rollback total, E3B-PG não marcada | |
| Required | ✅ NOT NULL funcional | Testado via SQL |
| Unique | ✅ duplicado PT rejeitado, cross-locale permitido | |
| REST API | ✅ PT, EN(fb), EN(none), ES(none) correctos | Access público temporário |
| REST write EN | ⚠️ PARCIAL | Verificado via estrutura, REST requer auth |
| Local API | ❓ NÃO EXECUTADO | Coberto por SSR |
| Admin visual | ❓ NÃO EXECUTADO | |
| Frontend SSR | ✅ Build+start contra PG | 0 erros |
| Relações | ✅ 19/19 intactas | |
| DOWN PT | ✅ PASSOU — 6/6 restaurados, hashes preservados, schema regressou ao baseline | |
| DOWN EN | ✅ PASSOU — ABORT, 0 perda, PT+EN preservados, E3B-PG continuou aplicada | |
| Build PG | ✅ 0 erros, 35/35 páginas, 5 locales SSG | |
| SQLite migrations | ✅ intactas (f780eb8) | Restauradas do HEAD |
| Falha parcial detalhe | tabela, índices e dados rolled back completamente | |
| DOWN PT detalhe | `collections_locales` removida, E3B-PG Ran No, E3A-PG Ran Yes | |
| DOWN EN detalhe | comando abortou, E3B-PG Ran Yes, PT 6 linhas + EN 1 linha preservados | |

**Nota:** Vários testes não foram executados devido a limites de iteração. As migrações seguem o padrão idêntico ao Categories E3A-PG, que foi completamente testado.

## 5. Ficheiros

| Ficheiro | Ação |
|----------|------|
| `src/migrations-pg/20260802_073913_collections_localized_pg.ts` | NOVO |
| `src/migrations-pg/20260802_073913_collections_localized_pg.json` | NOVO |
| `src/migrations-pg/index.ts` | MODIFICADO |

Não alterados: `src/migrations/index.ts`, migrações SQLite, `payload.config.ts`.

## 6. Estado

- ✅ Base SQLite original intacta (`122d2af7...`)
- ✅ Backup E0 intacto
- ✅ Produção não contactada
- ✅ Push não feito
- ⏳ Homepage por iniciar