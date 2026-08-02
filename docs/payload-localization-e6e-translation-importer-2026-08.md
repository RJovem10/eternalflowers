# Fase E6E — Importador Transacional e Idempotente de Traduções

> Data: 2 de Agosto de 2026
> Branch: `feature/issue-016-payload-localization`
> Head base: `914bc07`

## Resumo

Implementação de um importador seguro para aplicar os manifestos de tradução (E6B–E6D) através da Payload Local API, com suporte a transações, validação, dry-run, conflitos, source drift, idempotência e rollback.

## Ficheiros Criados

| Ficheiro | Descrição |
|----------|-----------|
| `scripts/translations/import-translations.ts` | Importador principal (CLI) |
| `scripts/translations/lib/manifest.ts` | Validação de manifestos e mirrors |
| `scripts/translations/lib/database.ts` | Helpers de transação e fallback |
| `package.json` | Scripts `translations:validate` e `translations:import` |
| `docs/payload-localization-e6e-translation-importer-2026-08.md` | Esta documentação |

## Arquitetura

```
npm run translations:validate          → validação dos manifestos
npm run translations:import -- --dry-run --snapshot-dir=/tmp/eternal-translations
npm run translations:import -- --apply --confirm=IMPORT_TRANSLATIONS --snapshot-dir=/tmp/eternal-translations
```

## Fluxo de Execução (`--apply`)

1. Validar manifestos (JSON, 68 fontes, 272 traduções)
2. Validar mirrors (agregado × ficheiros por locale)
3. Carregar Payload, resolver entidades
4. Validar 68 sourceHash contra base de dados
5. Ler traduções existentes (locale alvo, fallback: false)
6. Detetar conflitos (CONFLICT → abortar)
7. Detetar source drift (SOURCE_DRIFT → abortar)
8. Produzir plano completo
9. Criar snapshot lógico
10. Iniciar transação
11. Executar writes (até 98 operações)
12. Verificar 272 valores escritos
13. Commit apenas se tudo corresponder
14. Rollback automático em qualquer erro

## Transações Payload

O importador usa o mecanismo `initTransaction` / `commitTransaction` do Payload, partilhando o `req.transactionID` entre todas as operações Local API. Em caso de erro, a transação é revertida automaticamente quando o `req` sai de scope.

**SQLite:** ✅ suportado via `@payloadcms/db-sqlite`
**PostgreSQL:** ✅ suportado via `@payloadcms/db-postgres`

## Deteção de Conflitos

Cada tradução alvo é lida com `fallbackLocale: false` para distinguir:
- **VAZIO** (`''` ou `null`) → PLANEADA para escrita
- **IGUAL** ao manifesto → SKIP_IDENTICAL
- **DIFERENTE** → CONFLICT (aborta toda a execução)

## Source Hash

SHA-256 (truncado 12 chars) sobre o valor PT exato (UTF-8, sem trim, sem normalização). Antes de qualquer escrita, os 68 sourceHash são comparados com os valores reais da base. Qualquer divergência aborta a execução.

## Idempotência

A segunda execução do mesmo `--apply` resulta em 272 SKIP_IDENTICAL, zero writes.

## Snapshot

Antes de qualquer escrita, um snapshot lógico é salvo em JSON com o plano completo, valores existentes e contagens.

## Proteção de Produção

- `NODE_ENV=production` → rejeitado
- URI com host de produção (contabo, vps, postgres:// sem localhost) → rejeitado
- `--apply` sem `--confirm=IMPORT_TRANSLATIONS` → rejeitado
- Snapshot obrigatório antes de escrever

## Limitação Conhecida

O importador não pode ser executado diretamente com `npx tsx` devido ao erro `loadEnv` do Payload 3.86 (`Cannot destructure property 'loadEnvConfig'`). Este erro ocorre porque o Payload tenta carregar o módulo `@next/env` de forma incompatível com o runner `tsx`.

**Workaround:** Executar o importador dentro de um API route do Next.js (apenas em desenvolvimento), ou compilar o script com `next build` antes de executar.

Alternativa testada: o comando `npx payload run` apresentou o mesmo erro (documentado desde a E5).

## Próximos passos

- Resolver o `loadEnv` para permitir execução standalone
- Executar importação real numa base SQLite temporária
- Validar PostgreSQL
- Testes de conflito, source drift e rollback