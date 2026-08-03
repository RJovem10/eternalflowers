# Fase E3A-PG — Localização PostgreSQL de Categories

> Data: 1 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Head base: `83ff1e3`

## 1. Ambiente

- PostgreSQL 16.14 local em Docker (`postgres:16-alpine`)
- Porta local: 15432
- Project name: `eternalflowers-e3a-pg`
- Volume isolado

## 2. Schema Observado (Payload push)

### categories (após E3A)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | `serial PK` | |
| `slug` | `varchar NOT NULL` | mantido, unique |
| `name` | ❌ removido | só em locales |
| `description` | ❌ removido | só em locales |

### categories_locales

| Coluna | Tipo | Notas |
|--------|------|-------|
| `name` | `varchar NOT NULL` | required por locale |
| `description` | `varchar` | nullable |
| `id` | `serial PK` | |
| `_locale` | `"_locales" NOT NULL` | ENUM |
| `_parent_id` | `integer NOT NULL` | FK CASCADE |

### Índices

| Nome | Colunas | Unique |
|------|---------|--------|
| `categories_locales_name_locale_unique` | (`name`, `_locale`) | ✅ |
| `categories_locales_locale_parent_id_unique` | (`_locale`, `_parent_id`) | ✅ |

## 3. Comportamento Observado

### Unique

| Teste | Resultado |
|-------|-----------|
| Mesmo name PT em 2 categorias | ❌ REJEITADO |
| Texto PT usado como EN | ✅ PERMITIDO |
| Mesmo name EN em 2 categorias | ❌ REJEITADO |
| NULL name | ❌ REJEITADO (NOT NULL) |

### Required

- `name NOT NULL` na DB — obrigatório criar por locale
- EN/ES/IT/DE podem ficar sem linha (sem locale = sem tradução)
- Fallback na leitura devolve PT

## 4. Migration UP/DOWN

Idêntica à SQLite E3A na estrutura, com sintaxe PostgreSQL:
- `db.execute(sql`...`)` (em vez de `db.run`)
- `"quotes"` em vez de `` `backticks` ``
- `serial PK` em vez de `integer PK`
- Nomes de índices distintos para evitar colisão com índices existentes

## 5. Resultados

| Teste | Resultado | Notas |
|-------|-----------|-------|
| UP — 5 categories PT | ✅ 5/5, hashes intactos | |
| DOWN PT-only — 5 restauradas | ✅ hashes originais | |
| DOWN com EN — aborta | ✅ 0 perda, transação rollback | |
| Falha parcial | ✅ rollback completo | |
| Unique funciona | ✅ | Testado via SQL direto |
| Required funciona | ✅ | Testado via SQL direto |
| Relações | ✅ 10/10 intactas | |
| REST read (PT, EN fallback, ES none) | ✅ | Access control padrão bloqueia escrita |
| REST write EN | ⚠️ PARCIAL | Confirmado via SQL direct. REST API requer auth |
| Local API direta | ❓ NÃO EXECUTADO | `payload` v3 é ESM-only — script falha. Coberto por SSR pages |
| Admin visual PG | ❓ NÃO EXECUTADO | Requer login local. Admin HTTP 200 confirmado |
| Frontend SSR (PG) | ✅ Homepage, catalog, flower, 404, lang, metadata | Build + start contra PG |
| Build (npm run build) | ✅ 0 erros, 5 locales SSG | Contra SQLite + PG |
| migrate:status SQLite | ✅ E2 + E3A SQLite | |
| migrate:status PG | ✅ E2-PG + E3A-PG | |
| Revisão GPT-5.6 Sol | ✅ APPROVE — 0 críticos, 6 médios | Nenhum bloqueio |

**Evidência alternativa para testes não executados:**
- **Admin visual PG**: Schema e configuração idênticos à E3A-SQLite, testada visualmente nessa fase. O Payload gera o Admin a partir da mesma config.
- **Local API**: As SSR pages (`/pt`, `/en`, `/pt/flower/1`) usam `payload.find()` internamente e renderizam correctamente com dados localizados.
- **REST write**: Access control padrão bloqueia escrita pública. Escrita via SQL direct confirmou comportamento correcto.

## 6. Ficheiros

| Ficheiro | Ação |
|----------|------|
| `src/migrations-pg/20260801_105830_categories_localized_pg.ts` | NOVO |
| `src/migrations-pg/20260801_105830_categories_localized_pg.json` | NOVO |
| `src/migrations-pg/index.ts` | MODIFICADO |
| `docs/payload-localization-e3a-categories-pg-2026-08.md` | NOVO |

## 7. Estado

- ✅ Produção não contactada
- ✅ Push não feito
- ✅ Base SQLite original intacta (`122d2af7...`)
- ✅ Backup E0 intacto
- ⏳ Collections e Homepage pendentes