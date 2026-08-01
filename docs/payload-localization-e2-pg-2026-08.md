# Fase E2-PG — Migration PostgreSQL para Flowers.story

> Data: 1 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Head inicial: `7c7176e`

## 1. Ambiente de Teste

| Item | Valor |
|------|-------|
| PostgreSQL | 16.14 (Alpine, Docker) |
| Container | `eternalflowers-e2pg-pg` |
| Project name | `eternalflowers-e2pg` |
| Porta | 15432 (não pública) |
| Docker | `docker.io` 29.1.3, Compose v2.40.3 |
| Isolamento | Compose em `/tmp/`, volume próprio |
| Worktree E1 | `/tmp/eternalflowers-e1-pg` (commit 0f205b2) |
| Dados | 100% fictícios, sem dados de produção |

### Databases de teste

- `eternalflowers_e2_before` — schema E1 baseline (sem localized)
- `eternalflowers_e2_after_push` — schema E2 gerado por Payload
- `eternalflowers_e2_migration` — clone do before que recebeu a migration

## 2. Schema Observado (Payload 3.86 + Postgres)

### Baseline E1 (flowers)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | `serial PRIMARY KEY` | sequence `flowers_id_seq` |
| `story` | `varchar` | não localizado |
| `name_pt`..`name_de` | `varchar` | suffix fields |
| `price` | `numeric` | |
| (demais) | | intactos |

### E2 com localized: true

| Elemento | Tipo |
|----------|------|
| `flowers.story` | mantida (varchar, para rollback) |
| `flowers_locales.story` | `varchar` |
| `flowers_locales.id` | `serial PRIMARY KEY` (sequence `flowers_locales_id_seq`) |
| `flowers_locales._locale` | `"_locales"` (ENUM: 'pt','en','es','it','de') NOT NULL |
| `flowers_locales._parent_id` | `integer` NOT NULL, FK → flowers(id) ON DELETE CASCADE |
| `flowers_locales_locale_parent_id_unique` | UNIQUE btree index on (`_locale`, `_parent_id`) |
| `flowers_locales_parent_id_fk` | FK constraint |

Nota: a PK é `serial` (integer + auto-sequence), não `integer PRIMARY KEY` simples.
O tipo `_locale` usa o ENUM `_locales` já existente (criado pela configuração global de localization em E1).
`flowers.story` não foi removida — preservada para rollback seguro.

## 3. migrationDir por Adapter

| Adapter | Diretório | Ficheiros |
|---------|-----------|-----------|
| SQLite (dev) | `src/migrations/` | `20260801_083313.ts` + `.json` |
| PostgreSQL (VPS) | `src/migrations-pg/` | `20260801_094419_flowers_story_localized_pg.ts` + `.json` |

**Não adicionado:** `prodMigrations` — a decisão sobre deployment (migration manual, CI ou startup) fica pendente.

## 4. Migration PostgreSQL

### Ficheiros criados

- `src/migrations-pg/index.ts`
- `src/migrations-pg/20260801_094419_flowers_story_localized_pg.ts`
- `src/migrations-pg/20260801_094419_flowers_story_localized_pg.json`

### UP

1. Verifica que `flowers` existe
2. Verifica que `flowers.story` existe
3. Verifica que `flowers_locales` NÃO existe (aborta se já existir)
4. Cria `flowers_locales` com `serial` PK, `_locale` ENUM, FK CASCADE
5. Cria UNIQUE INDEX em (`_locale`, `_parent_id`)
6. Backfill: insere `story` das flores com `IS NOT NULL AND != ''` para locale `pt`
7. Reporta contagem — aborta se 0 registos

### DOWN (PT-only)

1. Conta registos com `_locale != 'pt'`
2. Se > 0: ABORTA com erro (transação rollback, 0 perda)
3. Restaura `flowers.story` com `COALESCE` da locale PT
4. Remove UNIQUE INDEX, FK constraint, e `flowers_locales`

### Resultados

| Teste | Resultado |
|-------|-----------|
| UP — 10 flores, 7 stories PT backfilled | ✅ 7/7, hashes intactos |
| UP — empty string (ID 4) não backfilled | ✅ correcto |
| UP — NULL (IDs 5, 10) não backfilled | ✅ correcto |
| DOWN PT-only — 10 stories restauradas | ✅ hashes originais |
| DOWN com EN — aborta | ✅ erro, 0 perda, schema intacto |

## 5. Transações

Teste de falha deliberada pós-criação da tabela + backfill:

- Tabela, índices, FK e dados **totalmente removidos** após rollback
- Nenhum vestígio de `flowers_locales`
- Nenhuma migration marcada como aplicada
- E1 baseline intacto

✅ A migration corre dentro de transação PostgreSQL gerida pelo runner do Payload.

## 6. Local API

Testado via endpoint temporário (removido) contra o servidor Next.js:

### Locale / Fallback

| Teste | Story | Resultado |
|-------|-------|-----------|
| `locale=pt` (no fallback) | 131 chars | ✅ |
| `locale=en` (fallback default) | 131 chars (PT) | ✅ |
| `locale=en` (fallback none) | vazio | ✅ |
| `locale=es` (fallback none) | vazio | ✅ |
| `locale=en` (fallback=pt) | 131 chars (PT) | ✅ |
| `locale=it` (fallback none) | vazio | ✅ |
| `locale=it` (fallback=pt) | story PT | ✅ |

### Escrita EN

| Operação | Resultado |
|----------|-----------|
| PATCH story EN via Local API | ✅ escrita |
| PT inalterado após escrita | ✅ |
| EN legível com fallback none | ✅ |
| IT com fallback PT (não EN) | ✅ PT |

### Campos intactos

| Campo | Estado |
|-------|--------|
| `namePt`..`nameDe` | ✅ intactos |
| `price` (numeric) | ✅ 45.00 |
| `sku` | ✅ ROS-001 |
| Relações | ✅ não alteradas |

## 7. Frontend (SSR contra PostgreSQL migrado)

| Rota | Status | lang |
|------|--------|------|
| `/pt` | 200 | `pt` ✅ |
| `/en` | 200 | `en` ✅ |
| `/pt/catalog` | 200 | ✅ |
| `/en/catalog` | 200 | ✅ |
| `/pt/flower/1` | 200 | ✅ |
| `/en/flower/1` | 200 | ✅ |
| `/admin` | 200 | ✅ |
| `/pt/flower/999999` | 404 | ✅ |

## 8. Build

```bash
npm run generate:types  → ✅  story?: string | null
npm run build           → ✅  0 erros, 5 locales SSG
npm run start           → ✅  Ready in ~300ms
```

## 9. Revisão GPT-5.6 Sol

**Veredito: APROVADO** — sem bloqueios.

1 problema crítico reportado (template literal com single quotes) já estava correcto no ficheiro real — a transmissão para a revisão perdeu as backticks.
O código fonte usa backticks e `${nonPtCount}` interpola correctamente.

| Categoria | Encontrados | Aplicados |
|-----------|-------------|-----------|
| 🔴 Críticos | 1 (falso positivo) | 0 |
| 🟡 Médios | 4 | 0 (melhorias opcionais) |
| 🔵 Opcionais | 7 | 0 |

Nenhuma correção foi necessária.

## 10. REST API (com access público temporário)

| Teste | story | Resultado |
|-------|-------|-----------|
| `locale=pt` | 69 chars | ✅ |
| `locale=en` (fallback default) | 69 chars (PT) | ✅ |
| `locale=en&fallback-locale=none` | ausente | ✅ |
| `locale=es&fallback-locale=none` | ausente | ✅ |
| `locale=en&fallback-locale=pt` | 69 chars (PT) | ✅ |

Escrita EN via REST bloqueada por access control (payload default). Testada via Local API ✅.

## 11. Local API

| Teste | story | Resultado |
|-------|-------|-----------|
| PT locale (no fallback) | 69 chars | ✅ |
| EN locale (fallback default) | 69 chars (PT) | ✅ |
| EN locale (fallback none) | ausente | ✅ |
| ES locale (fallback none) | ausente | ✅ |
| EN locale (fallback=pt) | 69 chars (PT) | ✅ |
| Escrita EN via Local API | ✅ | ✅ |
| PT inalterado após escrita EN | ✅ | ✅ |
| Suffix fields intactos | namePt, price, sku | ✅ |

## 12. Admin

| Teste | Resultado |
|-------|-----------|
| `/admin` abre | ✅ HTTP 200 |
| Seletor PT/EN/ES/IT/DE | ✅ (verificado) |
| Login | ❌ Não testado (requer criação de user) |
| UI visual | Não testado (restrição de iterações) |

## 13. Build e Frontend

| Teste | Resultado |
|-------|-----------|
| `npm run build` — 0 erros, 5 locales SSG | ✅ |
| `/pt` → 200, `lang="pt"` | ✅ |
| `/en` → 200, `lang="en"` | ✅ |
| `/pt/catalog` → 200 | ✅ |
| `/en/catalog` → 200 | ✅ |
| `/pt/flower/1` → 200 | ✅ |
| `/en/flower/1` → 200 | ✅ |
| `/pt/flower/999999` → 404 | ✅ |
| Frontend usa story PT (defaultLocale) | ✅ |
| Tradução EN ainda não no frontend | ✅ (E5) |

## 10. Ficheiros Alterados (E2-PG)

| Ficheiro | Ação |
|----------|------|
| `src/migrations-pg/index.ts` | NOVO |
| `src/migrations-pg/20260801_094419_flowers_story_localized_pg.ts` | NOVO |
| `src/migrations-pg/20260801_094419_flowers_story_localized_pg.json` | NOVO |
| `src/payload.config.ts` | MODIFICADO — `migrationDir: './src/migrations-pg'` no postgresAdapter |
| `src/migrations/index.ts` | CORRIGIDO — apontava para migration inexistente |
| `docs/payload-localization-e2-pg-2026-08.md` | NOVO (este ficheiro) |

## 11. Produção Não Contactada

- ❌ Nenhum acesso ao PostgreSQL de produção
- ❌ Nenhuma credencial de produção usada
- ❌ Nenhum push feito
- ❌ Nenhum merge para develop
- ❌ Nenhuma migration aplicada à base original SQLite
- ✅ Backup E0 intacto (`~/backups/eternalflowers/`)
- ✅ `loja.sqlite` checksum inalterado

## 12. Proibições Ativas

- ❌ Sem push
- ❌ Sem merge para develop
- ❌ Sem E3
- ❌ Sem prodMigrations
- ❌ Sem alterar suffix fields

## 13. Estratégia de Deployment (Pendente)

A decidir antes do merge para develop:

- [ ] Migration manual via SSH + `npm run payload migrate`
- [ ] Migration em CI (antes do build)
- [ ] Migration no startup via `prodMigrations`
- [ ] SQLite migration para dev, PostgreSQL para produção
- [ ] Duas migrations separadas por adapter (estrutura atual)