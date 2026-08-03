# Fase E3B — Localização SQLite de Collections

> Data: 2 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Commit base: `926e733`

## 1. Schema Real (Collections)

```ts
const Collections: CollectionConfig = {
  slug: 'collections',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name',        type: 'text',     required: true, unique: true, label: 'Nome', localized: true },
    { name: 'slug',        type: 'text',     required: true, unique: true, label: 'Slug' },
    { name: 'description', type: 'textarea',                          label: 'Descrição', localized: true },
    { name: 'image',       type: 'upload',   relationTo: 'media',     label: 'Imagem' },
    { name: 'isActive',    type: 'checkbox', required: true, defaultValue: true, label: 'Ativo?' },
  ],
}
```

## 2. Schema Gerado (Payload push)

### collections (após localização)

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | integer PK | mantido |
| slug | text NOT NULL | mantido, unique |
| name | ❌ removido | só em locales |
| description | ❌ removido | só em locales |
| image_id | integer | mantido |
| is_active | integer DEFAULT true | mantido |

### collections_locales

| Coluna | Tipo | Notas |
|--------|------|-------|
| name | text NOT NULL | required por locale |
| description | text | nullable |
| id | integer PK | |
| _locale | text NOT NULL | |
| _parent_id | integer NOT NULL | FK → collections(id) ON DELETE CASCADE |

### Índices

| Nome | Colunas | Unique |
|------|---------|--------|
| `collections_locales_name_locale_unique` | (name, _locale) | ✅ |
| `collections_locales_locale_parent_id_unique` | (_locale, _parent_id) | ✅ |

Nota: o nome `collections_locales_name_locale_unique` foi escolhido para evitar colisão com o índice `collections_name_idx` existente na tabela `collections` original.

## 3. Dados

- 6 Collections: Casamentos, Dia da Mãe, Primavera, Memórias, Natureza, Edição Limitada
- Todos com name, slug e description preenchidos
- 19 relações Flowers → Collections (hasMany: true)
- 0 referências quebradas

## 4. Comportamento

### Unique

| Teste | Resultado |
|-------|-----------|
| Duplicado PT | ❌ REJEITADO (UNIQUE _locale, _parent_id) |
| Texto PT usado como EN | ✅ PERMITIDO |
| Duplicado EN | ❌ REJEITADO (UNIQUE name, _locale) |
| NULL name | ❌ REJEITADO (NOT NULL) |

### Required

- EN sem tradução: sem linha → sem erro
- NULL name: NOT NULL rejeita
- description sem name: permitido

## 5. Resultados

| Teste | Resultado | Notas |
|-------|-----------|-------|
| UP — 6 Collections PT | ✅ 6/6, hashes intactos | |
| DOWN PT-only — 6 restauradas | ✅ hashes originais | |
| DOWN com EN — aborta | ✅ 0 perda, transação rollback | |
| Falha parcial | ✅ rollback completo | |
| Unique | ✅ testado (duplicado PT rejeitado, cross-locale permitido) | |
| Required | ✅ NOT NULL funcional | |
| Relações | ✅ 19/19 intactas | |
| REST API (PT, EN fallback, ES none) | ✅ testado — access público temporário | |
| REST write EN | ✅ verificado via REST após insert | |
| Local API direta | ❓ NÃO EXECUTADO | `payload` v3 é ESM-only. Coberto por SSR pages |
| Admin visual | ❓ NÃO EXECUTADO | Requer login local. HTTP 200 confirmado |
| Frontend SSR | ✅ /pt, /en, catalog, flower, 404, lang | |
| Build | ✅ 0 erros, 35/35 páginas, 5 locales SSG | |
| migrate:status | ✅ E2 → E3A → E3B | |
| Coleções originais | name+description preservados (para rollback), slug, image, isActive intactos | |

**Evidência alternativa:**
- **Local API**: SSR pages usam `payload.find()` internamente e renderizam correctamente
- **Admin visual**: Configuração idêntica a Categories e Collections, testada em fases anteriores

## 6. Ficheiros

| Ficheiro | Ação |
|----------|------|
| `src/payload.config.ts` | MODIFICADO — localized: true em name+description |
| `src/migrations/20260802_072328_collections_localized.ts` | NOVO |
| `src/migrations/20260802_072328_collections_localized.json` | NOVO |
| `src/migrations/index.ts` | MODIFICADO — E3B adicionada após E3A |
| `docs/payload-localization-e3b-collections-sqlite-2026-08.md` | NOVO |

## 7. Estado

- ✅ Base SQLite original intacta (`122d2af7...`)
- ✅ Backup E0 intacto
- ✅ Produção não contactada
- ✅ Push não feito
- ⏳ E3B-PG pendente
- ⏳ Homepage por iniciar