# Fase E3A — Localização SQLite de Categories

> Data: 1 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Commit base: `4db6c03`

## 1. Schema Atual (Categories)

```ts
const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name',        type: 'text',     required: true, unique: true, label: 'Nome' },
    { name: 'slug',        type: 'text',     required: true, unique: true, label: 'Slug' },
    { name: 'description', type: 'textarea',                          label: 'Descrição' },
  ],
}
```

## 2. Alteração Aplicada

```diff
- { name: 'name',        type: 'text',     required: true, unique: true, label: 'Nome' }
+ { name: 'name',        type: 'text',     required: true, unique: true, label: 'Nome', localized: true }
- { name: 'description', type: 'textarea',                          label: 'Descrição' }
+ { name: 'description', type: 'textarea',                          label: 'Descrição', localized: true }
```

Slug permanece não localizado. Campos não alterados: `slug`, `id`, `updatedAt`, `createdAt`.

## 3. Schema Gerado pelo Payload (descoberto via migrate:create)

### categories (após localização)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | integer PK | inalterado |
| `name` | ❌ removido | agora em categories_locales |
| `description` | ❌ removido | agora em categories_locales |
| `slug` | text NOT NULL | mantido, unique |
| `updated_at` | text | mantido |
| `created_at` | text | mantido |

### categories_locales (NOVA)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `name` | text NOT NULL | required por locale |
| `description` | text | nullable |
| `id` | integer PK | auto |
| `_locale` | text NOT NULL | |
| `_parent_id` | integer NOT NULL | FK → categories(id) ON DELETE CASCADE |

### Índices

| Nome | Tabela | Colunas | Unique |
|------|--------|---------|--------|
| `categories_locales_name_locale_unique` | categories_locales | (name, _locale) | ✅ |

Nota: o nome do índice foi alterado para evitar colisão com o índice original `categories_name_idx` em `categories`.

## 4. Comportamento Observado

### Unique

O índice é **`UNIQUE (name, _locale)`** — não global.

- ✅ Mesmo nome pode existir em PT e EN (locales diferentes)
- ✅ Mesmo nome NÃO pode repetir-se no mesmo locale
- ✅ Nenhuma colisão com 5 categorias actuais

### Required

- `name` é `NOT NULL` em `categories_locales` (required por locale)
- PT é obrigatório
- EN/ES/IT/DE podem ficar vazios (sem required não-PT)
- Fallback devolve PT na leitura

## 5. Migration UP (SQLite)

1. Verifica que `categories` existe
2. Verifica que `categories_locales` NÃO existe
3. Cria `categories_locales` com `name` (NOT NULL), `description`, `_locale`, `_parent_id`
4. Cria `UNIQUE INDEX (name, _locale)`
5. Backfill: copia `name` + `description` + `'pt'` + `id` de categories para categories_locales
6. Aborta se 0 registos inseridos

## 6. Migration DOWN

1. Conta `_locale != 'pt'`
2. Se > 0: ABORTA (transação rollback, 0 perda)
3. Restaura name com COALESCE
4. Restaura description com COALESCE
5. Remove INDEX, DROP TABLE

## 8. Resultados Funcionais

### migrate:status
```
┌──────────────────────────────────────┬───────┬─────┐
│                                 Name │ Batch │ Ran │
├──────────────────────────────────────┼───────┼─────┤
│                      20260801_083313 │     1 │ Yes │
│ 20260801_103101_categories_localized │     1 │ Yes │
└──────────────────────────────────────┴───────┴─────┘
```

### Comportamento unique

Índice: `categories_locales_name_locale_unique` UNIQUE (`name`, `_locale`)

| Teste | Resultado |
|-------|-----------|
| Mesmo name PT em duas categorias | ❌ REJEITADO (UNIQUE constraint) |
| Texto PT usado como EN noutra categoria | ✅ PERMITIDO (locales diferentes) |
| Mesmo name EN em duas categorias | ❌ REJEITADO |
| Mensagem | `UNIQUE constraint failed: categories_locales.name, categories_locales._locale` |

### Comportamento required

| Teste | Resultado |
|-------|-----------|
| `name = NULL` na INSERT direta | ❌ REJEITADO (NOT NULL) |
| `name = ''` (string vazia) | ✅ PERMITIDO |
| PT obrigatório no Admin | ✅ required por locale |
| EN/ES/IT/DE podem ficar vazios | ✅ sem erro |

### Frontend SSR (contra base migrada, sem alterar queries)

| Rota | Status | Notas |
|------|--------|-------|
| `/pt` | 200 | `lang="pt"` |
| `/en` | 200 | `lang="en"` |
| `/pt/catalog` | 200 | |
| `/en/catalog` | 200 | |
| `/pt/flower/1` | 200 | badge "Colares" PT |
| `/en/flower/1` | 200 | badge "Colares" (fallback PT) |
| `/pt/flower/999999` | 404 | |
| `/admin` | 200 | |
| Links categoria homepage | ✅ 5 slugs corretos | `?category=colares` etc. |

### Escrita EN (via SQL direct + Local API)

| Verificação | Resultado |
|-------------|-----------|
| EN name escrito | ✅ "Necklaces" |
| EN description escrita | ✅ 45 chars |
| PT inalterado | ✅ "Colares" mantido |
| Slug inalterado | ✅ "colares" |
| ID inalterado | ✅ 1 |
| Relações Flowers intactas | ✅ 10/10 |

### Integridade

| Verificação | Resultado |
|-------------|-----------|
| `integrity_check` | ok |
| `foreign_key_check` | 0 erros |
| Base original `loja.sqlite` | checksum inalterado (122d2af7) |

### Tipos e Build

| Comando | Resultado |
|---------|-----------|
| `npm run generate:types` | ✅ `Category.name: string` |
| `npm run build` | ✅ 0 erros, 35/35 páginas, 5 locales SSG |

## 8. Ficheiros Alterados

| Ficheiro | Ação |
|----------|------|
| `src/payload.config.ts` | MODIFICADO — `localized: true` em name + description |
| `src/migrations/20260801_103101_categories_localized.ts` | NOVO |
| `src/migrations/20260801_103101_categories_localized.json` | NOVO |
| `src/migrations/index.ts` | MODIFICADO — E3A adicionada após E2 |
| `docs/payload-localization-e3a-categories-sqlite-2026-08.md` | NOVO |

## 9. Estado

- ✅ Base SQLite original intacta
- ✅ Backup E0 intacto
- ✅ Produção não contactada
- ✅ Push não feito
- ⏳ E3A-PG pendente
- ⏳ Collections e Homepage por iniciar