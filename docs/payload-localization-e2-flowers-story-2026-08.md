# Fase E2 — Piloto de Localização: Flowers.story

> Data: 1 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Commit base: `0f205b2`
> Commit E2: `40268c6`

---

## 1. Objetivo

Piloto de `localized: true` no campo `story` da collection `Flowers`.

## 2. Schema

### Antes
```
flowers.story → TEXT (único, não localizado)
```

### Depois
```
flowers.story → TEXT (coluna original preservada)
flowers_locales (NOVA)
  ├── story TEXT
  ├── id INTEGER PK
  ├── _locale TEXT NOT NULL
  ├── _parent_id INTEGER FK → flowers.id ON DELETE CASCADE
  └── UNIQUE INDEX (_locale, _parent_id)
```

## 3. Dados

| Indicador | Antes | Depois |
|-----------|-------|--------|
| Flowers | 10 | 10 |
| Stories PT preenchidas | 10 | 10 |
| integrity_check | ok | ok |
| foreign_key_check | 0 | 0 |

## 4. Migration UP

1. `CREATE TABLE IF NOT EXISTS flowers_locales`
2. `CREATE UNIQUE INDEX` on `(_locale, _parent_id)`
3. `INSERT ... SELECT story, 'pt', id FROM flowers WHERE story IS NOT NULL AND story != ''`

✅ 10/10 valores PT preservados

## 5. Migration DOWN (patched após revisão)

- Pre-check: avisa se existem `_locale != 'pt'`
- `COALESCE` para evitar NULL quando registo PT foi apagado
- Restaura PT, drop `flowers_locales`

⚠️ Perde traduções EN/ES/IT/DE — usar backup para rollback com conteúdo multilingue

## 6. REST API

| Locale | Fallback | story | Resultado |
|--------|----------|-------|-----------|
| pt | on (default) | valor original (424 chars) | ✅ |
| en | on (default) | valor PT (424 chars) | ✅ |
| en | off (`none`) | vazio (0 chars) | ✅ |
| es | off | vazio | ✅ |
| it | off | vazio | ✅ |
| de | off | vazio | ✅ |

Campos `namePt..nameDe`, `descriptionPt..descriptionDe` mantidos independentes.

## 7. Escrita EN

PATCH `/api/flowers/1?locale=en` com story EN:
- ✅ EN escrito: "E2 Test: English story..."
- ✅ PT inalterado
- ✅ Preço (89), namePt, image, relações intactos

## 8. Admin

- Seletor de 5 locales presente
- PT: 10 stories originais visíveis
- EN: edição independente
- Campos suffix (namePt..nameEn) preservados
- Preço/stock/imagens partilhados

## 9. Required e Fallback

- `story`: `type: 'textarea'`, **não required** (`required` não definido)
- Fallback `true` na config global → locale vazio mostra PT
- `fallback-locale=none` → campo vazio/null
- Guardar locale vazio é permitido (não required)
- ⚠ `required: true` + `localized: true` validaria por locale; não aplicado aqui

## 10. Tipos

- `story?: string | null` (correto para campo localizado)
- `namePt..nameDe`, `descriptionPt..descriptionDe` inalterados
- Categories, Collections, Homepage inalterados

## 11. Frontend (contra base migrada)

| Rota | Status | lang | Notas |
|------|--------|------|-------|
| /pt | 200 | pt | ✅ |
| /en | 200 | en | ✅ |
| /pt/flower/10 | 200 | pt | ✅ |
| /pt/catalog | 200 | pt | ✅ |
| /pt/rota-inexistente | 404 | — | ✅ |
| /pt/flower/999999 | 404 | — | ✅ |
| /admin | 200 | en | ✅ |

⚠ Story PT visível em todas as línguas (frontend não envia locale — E5)

## 12. Revisão GPT-5.6 Sol

**Classificação: B — SQLite validado, PostgreSQL não testado**

| Critério | Status |
|----------|--------|
| UP data safety | ✅ Correcto |
| DOWN com dados não-PT | ⚠️ Destrutivo — guarda adicionada (warning) |
| PostgreSQL abordagem | ✅ Compatível (ambos usam `_locales`) |
| PostgreSQL SQL portabilidade | ⚠️ Sintaxe difere — usar Drizzle ou E2-PG |
| DOWN com COALESCE | ✅ Implementado após revisão |
| Pre-check DOWN | ✅ Implementado após revisão |

**Recomendações aplicadas:**
1. ✅ Pre-check no DOWN (conta `_locale != 'pt'`)
2. ✅ COALESCE no UPDATE para evitar NULL em boa data
3. ✅ Backup documentado como rollback canónico

## 13. Risco PostgreSQL

A migration usa `sql` de `@payloadcms/db-sqlite`. Ambos os adapters estão instalados.

No VPS Postgres, a migration importaria `sql` do adapter SQLite (instalado) e executaria SQL incompatível — **falharia em runtime**.

**Solução:** E2-PG separada ou integrar a migration via drizzle (geração automática de SQL por adapter).

## 14. Build

| Base | Resultado |
|------|-----------|
| Original (`loja.sqlite` — sem migration) | ❌ `no such table: flowers_locales` (esperado) |
| Migrada (`/tmp/loja-e2-final.sqlite`) | ✅ 0 erros |

⚠ Código E2 requer migration aplicada. Incompatibilidade esperada.

## 15. Ficheiros alterados (6)

| Ficheiro | Ação |
|----------|------|
| `src/payload.config.ts` | `story: localized: true` |
| `src/migrations/20260801_083313.ts` | **NOVO** — UP/DOWN patched |
| `src/migrations/20260801_083313.json` | **NOVO** — metadata |
| `src/migrations/index.ts` | alterado |
| `docs/payload-localization-e2-flowers-story-2026-08.md` | **NOVO** |

## 16. Base original

| Indicador | Valor |
|-----------|-------|
| Checksum | `122d2af7639d...` ✅ inalterado |
| Backup E0 | intacto ✅ |
| PostgreSQL | não contactado ✅ |
| Push | não feito ✅