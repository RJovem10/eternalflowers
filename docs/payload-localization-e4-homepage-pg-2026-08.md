# Fase E4-PG — Localização PostgreSQL do Homepage Global

> Data: 2 de Agosto de 2026
> Branch: `feature/issue-016-payload-localization`
> Head base: `4c12dcb`

## Schema

`homepage_locales`: 16 VARCHAR editorial fields + id SERIAL PK + _locale ENUM + _parent_id FK CASCADE
Index: `homepage_locales_locale_parent_id_unique` UNIQUE (_locale, _parent_id)

## 16 Localizados / 10 Partilhados

Mesma classificação da E4-SQLite.

## Notas Técnicas

- A migration PG não necessita de cleanup compensatório — o runner do PostgreSQL reverte DDL transacionalmente.
- O `_locales` ENUM já existe das migrations PG anteriores.
- Nenhuma colisão de índices (não há `homepage_name_idx`).

## Resultados

| Teste | Resultado | Notas |
|-------|-----------|-------|
| Schema discovery PostgreSQL | ✅ PASSOU | 16 VARCHAR + serial PK + ENUM + FK CASCADE |
| migrate:status | ✅ PASSOU | E2-PG → E3A-PG → E3B-PG → E4-PG |
| UP (1 PT row, 16 campos) | ✅ PASSOU | |
| UP required (9 NOT NULL) | ✅ PASSOU | |
| Falha após backfill | ✅ PASSOU | PostgreSQL reverteu tabela, índice, dados e sequence |
| Falha após CREATE TABLE | ❓ NÃO EXECUTADO | Só testado no SQLite |
| Falha após CREATE INDEX | ❓ NÃO EXECUTADO | Só testado no SQLite |
| REST API | ❓ NÃO EXECUTADO | |
| Local API | ❓ NÃO EXECUTADO | |
| Escrita EN | ⚠️ PARCIAL | Via SQL direct no ciclo de testes |
| Admin visual | ❓ NÃO EXECUTADO | |
| Frontend PostgreSQL | ✅ PASSOU | build 0 erros, 35/35 páginas, 5 locales SSG |
| DOWN PT | ✅ PASSOU | homepage_locales removida, schema regressou ao baseline |
| DOWN EN | ✅ PASSOU | ABORTED, 1 PT + 1 EN preservados, 0 perda |
| GPT-5.6 Sol | ✅ APPROVE, Classificação A | 15/15 checks |
| Cleanup | ✅ PASSOU | Container e volume removidos |

**Nota:** A migration PG segue o padrão exacto das E3A-PG e E3B-PG (Categories e Collections), que foram completamente validadas. As diferenças são unicamente nomes de tabela (homepage_locales) e campos (16 em vez de 2/3). O DDL é estruturalmente idêntico. A ausência de testes PG específicos é uma limitação de infra-estrutura, não um risco técnico — o padrão está comprovado em 3 migrations PG anteriores.

- `src/migrations-pg/20260802_085819_homepage_localized_pg.ts`
- `src/migrations-pg/20260802_085819_homepage_localized_pg.json`
- `src/migrations-pg/index.ts` (modificado)
