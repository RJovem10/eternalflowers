# Fase E1 — Configuração Base de Localization

> Data: 1 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Commit base: `4111aeb`
> Commit E1: em criação

---

## 1. O que foi feito

### 1.1 Fonte única de locales
Criado `src/i18n/locales.ts` com:
- `locales = ['pt', 'en', 'es', 'it', 'de'] as const`
- `type Locale = (typeof locales)[number]`
- `defaultLocale: Locale = 'pt'`
- `function isLocale(value: unknown): value is Locale`

Importável em servidor e cliente. Sem dependências Node, sem efeitos laterais, compatível com Edge/middleware.

### 1.2 Localization no Payload
Adicionado ao `buildConfig()` em `src/payload.config.ts`:
```ts
localization: {
  locales: [
    { code: 'pt', label: 'Português' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'it', label: 'Italiano' },
    { code: 'de', label: 'Deutsch' },
  ],
  defaultLocale: 'pt',
  fallback: true,
}
```

### 1.3 Types regenerados
`npx payload generate:types` executado contra base temporária.
Tipos agora incluem `locale: 'pt' | 'en' | 'es' | 'it' | 'de'` no Config.

## 2. O que NÃO foi feito

- ❌ Nenhum campo recebeu `localized: true`
- ❌ Nenhuma collection/global alterada
- ❌ Nenhuma migration criada ou executada
- ❌ Nenhum dado alterado
- ❌ Não foi configurado `i18n` do Admin
- ❌ PostgreSQL não contactado

## 3. Base de dados

| Item | Resultado |
|------|-----------|
| Base temporária | `~/backups/eternalflowers/testing/e1-localization-test.sqlite` |
| Schema antes vs depois | ✅ idêntico (diff 0) |
| Contagens | ✅ intactas (10 flowers, 5 categories, 6 collections, etc.) |
| Original DB checksum | ✅ `122d2af7639d...` (inalterado) |
| Backup E0 | ✅ intacto |

## 4. Testes

### Frontend
| Rota | Status | lang |
|------|--------|------|
| /pt | 200 | pt |
| /en | 200 | en |
| /es | 200 | es |
| /it | 200 | it |
| /de | 200 | de |
| /pt/catalog | 200 | pt |
| /en/catalog | 200 | en |
| /pt/flower/10 | 200 | pt |
| /admin | 200 | en |

### API
| Endpoint | Status | Nota |
|----------|--------|------|
| `/api/media?limit=1` | 200 | Público, 1 doc |
| `/api/flowers?locale=pt` | 403 | Requer auth (esperado) |

### Build
`npm run build` — ✅ 0 erros

## 5. Ficheiros alterados (3)

| Ficheiro | Alteração |
|----------|-----------|
| `src/i18n/locales.ts` | **NOVO** — fonte única de locales |
| `src/payload.config.ts` | + localization: 5 locales, defaultLocale pt, fallback true |
| `src/payload-types.ts` | Regenerado, inclui `locale: 'pt' \| 'en' \| 'es' \| 'it' \| 'de'` |

## 6. Próximo passo
Fase E2 — adicionar `localized: true` a campos selecionados (não autorizada).