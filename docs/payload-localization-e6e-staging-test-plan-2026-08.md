══════════════════════════════════════════════
  E6E — PLANO DE TESTES EM STAGING
══════════════════════════════════════════════

## ESTADO ATUAL

| Branch | HEAD | Conteúdo |
|--------|------|----------|
| `feature/issue-016-payload-localization` | `914bc07` | E6D (traduções de produtos) |
| `spike/issue-016-translation-importer` | `5c2f646` | + E6E (importador) |

`loja.sqlite` intacta: SHA-256 `122d2af7…`

## O QUE A SPIKE CONTÉM

- `scripts/translations/import-translations.ts` — importador completo
- `scripts/translations/lib/manifest.ts` — validação de manifestos e mirrors
- `scripts/translations/lib/database.ts` — helpers de transação
- `scripts/translations/run-import.sh` — wrapper bash
- `src/payload.config.ts` — env var `PAYLOAD_SQLITE_PUSH`
- `package.json` — scripts `translations:validate` e `translations:import`
- `docs/payload-localization-e6e-translation-importer-2026-08.md`
- 4 ficheiros de mirror corrigidos

## ESTRUTURADO E VALIDADO

✅ TypeScript: 0 erros
✅ Manifestos: 68 fontes, 272 traduções
✅ Mirrors: 16 ficheiros × agregados
✅ rollback explícito: killTransaction
✅ Proteção produção: 3 níveis
✅ PAYLOAD_SQLITE_PUSH: implementado
❌ Execução real: NÃO TESTADA

## PLANO DE TESTES EM STAGING

### Ambiente

```
PostgreSQL 16 descartável (Docker)
Configuração Payload independente
Schema E1–E4-PG aplicado
Dados PT de teste com sourceHash verificados
Zero contacto com produção
```

### Testes

1. **Dry-run** — 68 sourceHash, 272 PLANNED_WRITE, 0 conflitos
2. **Apply** — 272 valores, transação, commit após verificação
3. **Idempotência** — 0 writes, 272 SKIP_IDENTICAL
4. **Conflito** — alterar 1 tradução, bloquear antes de escrever
5. **Source drift** — alterar 1 fonte PT, bloquear antes de escrever
6. **Rollback** — killTransaction em falhas nas operações 1, meio, fim e verificação
7. **pg_dump + restore** — backup funcional
8. **HTTP** — /pt /en /es /it /de com traduções reais
9. **Build** — tsc + next build contra DB importada

### Como usar a spike

```bash
git checkout spike/issue-016-translation-importer
npm ci
# Aplicar patch loadEnv.js (1 linha: import * as...)
PAYLOAD_SQLITE_PUSH=false npm run translations:validate
PAYLOAD_SQLITE_PUSH=false npm run translations:import -- --dry-run --snapshot-dir=/tmp/eternal
PAYLOAD_SQLITE_PUSH=false npm run translations:import -- --apply --confirm=IMPORT_TRANSLATIONS --snapshot-dir=/tmp/eternal
```

### Decisões para retomar

- [ ] Resolver loadEnv para `npx payload migrate` (bin script)
- [ ] OU: criar DB de teste via script que inicializa Payload em subprocesso
- [ ] Validar PostgreSQL
- [ ] Merge da spike para feature branch
- [ ] Push
- [ ] Iniciar E6F (QA visual)
