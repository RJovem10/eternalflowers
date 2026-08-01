# Fase E2 — Piloto de Localização: Flowers.story

> Data: 1 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Commit base: `0f205b2`

---

## 1. Objetivo

Piloto de `localized: true` no campo `story` da collection `Flowers`, como primeiro passo da Fase E (Payload localization).

## 2. O que foi feito

- Adicionado `localized: true` a `Flowers.story` em `src/payload.config.ts`
- Criada migration `20260801_083313` que cria `flowers_locales` e backfill dos 10 valores PT
- Migration DOWN testada com e sem traduções EN

## 3. Schema — antes e depois

### Antes
```
flowers.story → TEXT (único, não localizado)
```

### Depois
```
flowers.story → TEXT (coluna original mantida)
flowers_locales (NOVA)
  ├── story TEXT
  ├── id INTEGER PK
  ├── _locale TEXT NOT NULL
  ├── _parent_id INTEGER FK → flowers.id
  └── UNIQUE INDEX (_locale, _parent_id)
```

O Payload SQLite adapter cria uma tabela separada para valores localizados, preservando a coluna original.

## 4. Dados antes e depois

| Indicador | Antes | Depois |
|-----------|-------|--------|
| Flowers | 10 | 10 |
| Stories preenchidas (PT) | 10 | 10 (em `flowers_locales`) |
| Stories vazias | 0 | 0 |
| integrity_check | ok | ok |
| foreign_key_check | 0 erros | 0 erros |

## 5. Migration testada

### UP ✅
- Cria `flowers_locales` com `IF NOT EXISTS`
- Backfill: copia todas as stories não vazias para `locale='pt'`
- 10/10 valores preservados

### DOWN ✅
- Restaura PT stories para a coluna `flowers.story`
- Remove `flowers_locales`
- **Limitação:** se existirem traduções EN/ES/IT/DE, são perdidas no DOWN

## 6. API REST (autenticada)

| Locale | Fallback | story | Resultado |
|--------|----------|-------|-----------|
| `pt` | — | valor original | ✅ |
| `en` | `pt` (default) | valor PT | ✅ (fallback) |
| `en` | `none` | null | ✅ |

Campos `namePt..nameDe` e `descriptionPt..descriptionDe` continuam campos separados e inalterados.

## 7. Admin

- Seletor de locale mostra os 5 idiomas
- PT mostra story original
- EN permite edição independente
- Campos suffix (namePt..nameEn, etc.) continuam visíveis
- Preço, stock, imagens e relações partilhados entre locales

## 8. Frontend (contra base migrada)

- Rotas /pt, /en, /pt/catalog, /pt/flower/10: 200, lang correto
- 404: HTTP 404, localizado
- Admin: 200
- Story PT não visível (frontend queries não enviam locale — E5)

## 9. Tipos gerados

- `story?: string | null` (tipo correto para campo localizado)
- `namePt..nameDe` inalterados
- Categories, Collections, Homepage inalterados

## 10. Build

`npm run build` contra base migrada: ✅ 0 erros

> ⚠ O código após E2 requer a migration aplicada. Falha contra schema antigo é esperada.

## 11. Revisão GPT-5.6 Sol

[pendente — resultado será inserido quando disponível]

## 12. Classificação da Migration

**Classificação: B — SQLite validada, PostgreSQL não validada**

- SQLite: UP e DOWN testados em base isolada ✅
- PostgreSQL: não testado (sem instância local)
- DOWN com traduções EN: perda documentada
- Requer subfase E2-PG antes de deploy em produção

## 13. Limitações

1. Migration PostgreSQL não testada
2. DOWN destrói traduções não-PT
3. Frontend não envia locale nas queries (E5)
4. Apenas `story` localizado — suffix fields mantidos
5. Base original (`loja.sqlite`) não recebeu a migration

## 14. Base original

| Indicador | Valor |
|-----------|-------|
| Checksum original | `122d2af7639d...` (inalterado) |
| integrity_check | ok |
| Backup E0 | intacto |
| PostgreSQL | não contactado |

## 15. Ficheiros alterados (2)

| Ficheiro | Alteração |
|----------|-----------|
| `src/payload.config.ts` | `story: { localized: true }` |
| `src/migrations/20260801_083313.ts` | **NOVO** — migration UP/DOWN |

## 16. Próximo passo

E3 — Categories e Collections (não autorizada)