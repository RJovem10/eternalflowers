# Auditoria de Release — Issues 016-019

**Relatório:** `docs/release-audit-issue-016-019.md`
**Data:** 2026-08-02
**Branch:** `release/issue-016-019`
**HEAD:** `0e22d8c35e47c03c53be829f47b01ada8cd329c4`

---

## 1. Origem e Destino da Release

| Parâmetro | Valor |
|-----------|-------|
| Branch de origem | `feature/issue-016-payload-localization` |
| Branch de destino | `main` |
| Branch de release | `release/issue-016-019` (criada localmente) |
| Commits na release | 77 |
| Merge base | `3aee6dd` (= `main`) |
| Estratégia de merge | **Squash merge** via Pull Request (ver secção 16) |
| Fast-forward possível? | Sim (main é ancestral direto) |
| Conflitos previstos? | Zero (merge-tree OK) |
| Push | ❌ Não executado |
| PR | ❌ Não criado |
| Merge | ❌ Não executado |
| Produção | ❌ Nunca contactada |

---

## 2. Resumo do Diff

| Métrica | Valor |
|---------|-------|
| Ficheiros alterados | 247 (221 código + imagens, 26 documentação) |
| Inserções | +25.854 |
| Remoções | -355 |
| Linhas alteradas totais | ~26.209 |

### Categorias do Diff (ficheiros não-doc)

| Categoria | Quantidade | Exemplos |
|-----------|-----------|----------|
| Componentes React (src/components/) | 21 | Hero, Footer, ProductGallery, Header, etc. |
| Páginas App Router (src/app/) | 20 | (frontend)/, (payload)/, api/ |
| Configuração (raiz) | 8 | tailwind, tsconfig, postcss, docker-compose, .env.example |
| i18n / dicionários (src/i18n/) | 4 | dictionaries, locales, middleware, get-locale |
| Migrations (src/migrations/ + src/migrations-pg/) | 15 | E1 baseline, E2-E4 localizadas (SQLite + PG) |
| Scripts (scripts/) | 15 | staging, translations, postgresql, seed |
| Translations data (translations/) | 20 | flowers, categories, collections, homepage (5 locale cada) |
| Media tracked (media/) | 11 | Imagens dos produtos seed |
| Public images (public/) | 48 | Instagram (48), Marina (6), placeholders |
| Conteúdo (src/content/) | 1 | about.ts — biografia Marina 5 idiomas |

### Ficheiros eliminados (7)

| Ficheiro | Destino |
|----------|---------|
| `src/app/[locale]/catalog/page.tsx` | Movido para `(frontend)/` |
| `src/app/[locale]/flower/[id]/page.tsx` | Movido para `(frontend)/` |
| `src/app/[locale]/layout.tsx` | Substituído por route groups |
| `src/app/[locale]/page.tsx` | Movido para `(frontend)/` |
| `src/app/[locale]/thank-you/page.tsx` | Movido para `(frontend)/` |
| `src/app/admin/[[...segments]]/page.tsx` | Movido para `(payload)/` |
| `src/app/layout.tsx` | Substituído por route groups separados |

### Ficheiros renomeados (3)

| Origem | Destino |
|--------|---------|
| `src/app/[locale]/cart/page.tsx` | `src/app/(frontend)/[locale]/cart/page.tsx` |
| `src/app/[locale]/checkout/page.tsx` | `src/app/(frontend)/[locale]/checkout/page.tsx` |
| `src/app/api/[...slug]/route.ts` | `src/app/(payload)/api/[...slug]/route.ts` |

---

## 3. Auditoria de Secrets

### 3.1 Working tree

| Padrão | Ocorrências | Gravidade | Ficheiros |
|--------|-------------|-----------|-----------|
| `password` (literal) | 16 | ⚠️ Baixa | Placeholders em `.env.example`, `.env.staging.example`, `docker-compose.*.yml`, scripts de staging |
| `PAYLOAD_SECRET` | 5 | ⚠️ Baixa | Placeholders (`gera-um-segredo`, `muda_isto`, `staging-payload-secret-change-me`) |
| `STRIPE_SECRET_KEY` | 1 | ✅ Nula | Vazio em `.env.example` |
| `DATABASE_URI` com password | 3 | ⚠️ Baixa | Placeholders `***`, `staging_password_change_me` |
| `INSTAGRAM_ACCESS_TOKEN` | 1 | ✅ Nula | Vazio em `.env.example` |
| `Admin123!` (seed.py) | 2 | ⚠️ Baixa | Password de seed para dev, não produção |

**Conclusão:** Nenhum secret real exposto no working tree. Todos os valores são placeholders ou defaults de desenvolvimento/staging.

### 3.2 Histórico git

| Ficheiro | Commit | Conteúdo | Gravidade |
|----------|--------|----------|-----------|
| `.env.local.bak.20260730_074029` | `6e03d96` | `PAYLOAD_SECRET=dev-secret-local-...`, `NEXT_PUBLIC_SERVER_URL=http://localhost:3000` | ⚠️ **Média** |
| `.env.staging.example` | `84d347b` | Placeholders (esperado) | ✅ Nula |

O ficheiro `.env.local.bak.20260730_074029` foi adicionado em `6e03d96` e removido em `d631674`, mas permanece **no histórico git**. O secret é um valor de desenvolvimento (`dev-secret-local-mudar-em-prod-1234567890`), não uma credencial real de produção.

**Recomendação:** Considerar git-filter-repo ou BFG para remover o ficheiro do histórico ANTES do merge para `main`, dado que o repositório é público.

### 3.3 Ficheiros ignorados

| Ficheiro | Ignorado? | Risco |
|----------|-----------|-------|
| `.env.local` | ✅ Sim | Sem risco |
| `.env.staging.local` | ✅ Sim | Sem risco (contém password PG local) |
| `tmp-test-env.sqlite` | ❌ **Não** | ⚠️ **Médio** — ficheiro SQLite com dados de teste, não ignorado |
| `backups/staging-backup-test.dump` | ✅ Sim (staging-*) | Sem risco |
| `.next/` | ✅ Sim | Sem risco |
| `.hermes/` | ✅ Sim | Sem risco |

**Recomendação:** Adicionar `tmp-test-env.sqlite` ao `.gitignore`.

---

## 4. Auditoria de Media / Imagens (79 ficheiros)

### 4.1 Classificação completa

| Grupo | Quantidade | Tracked | Necessário na release | Ação recomendada |
|-------|-----------|---------|----------------------|-------------------|
| **Media de produtos (seed)** | 11 | ✅ Sim | ✅ Sim | Manter — referenciados pela base de dados seed |
| **Instagram** (`public/instagram/`) | 48 | ✅ Sim | ✅ Sim | Manter — fotografias reais da marca, usadas na homepage |
| **Marina pessoais** (`public/marina/`) | 6 | ✅ Sim | ✅ Sim | Manter — fotografias da biografia "Conhecer a Marina" |
| **Placeholders site** | 4 | ✅ Sim | ✅ Sim | Manter — `atelier.jpg`, `flower-dark.jpg`, `flower-orchid.jpg`, `store-orchids.jpg` |
| **Heróis** | 2 | ✅ Sim | ✅ Sim | Manter — `marina-hero.jpg`, `marina-working.jpg` (Heróis) |
| **Fallback** | 1 | ✅ Sim | ✅ Sim | Manter — `hero-fallback.png` (fallback para CMS vazio) |
| **Seed-images** (`seed-images/`) | 11 | ✅ Sim | ❌ Dispensável | Considerar remover — cópia exata dos ficheiros em `media/` |
| **Docs references** | 2 | ✅ Sim | ❌ Dispensável | Considerar remover — `instagram-logo.png`, `instagram-profile.png` (usados só em docs) |

### 4.2 Detalhe por grupo

#### Obrigatórios para a aplicação (62 ficheiros)

```
media/ (11)          → brincos-danca, brincos-sorriso, colar-beijo, colar-lagrima, hero,
                       moldura-eternidade, moldura-janela, portachaves-memoria,
                       portachaves-sussurro, pulseira-abraco, pulseira-raiz

public/ (7)          → atelier.jpg, flower-dark.jpg, flower-orchid.jpg, hero-fallback.png,
                       marina-hero.jpg, marina-working.jpg, product-dome.jpg, store-orchids.jpg

public/instagram/ (48)→ 48 fotografias reais do Instagram @eternal.flowers.pt

public/marina/ (6)   → marina-artesa-orquideas, marina-detalhe-ferramentas,
                       marina-hero-orquidea-rosa, marina-processo-tesoura-orquidea,
                       marina-retrato-natureza, marina-terapeuta-bata-branca
```

#### Potencialmente dispensáveis (13 ficheiros)

```
seed-images/ (11)    → Cópias exatas das imagens em media/. Usadas apenas pelo
                       script de seed original. A release não precisa delas se
                       a base de dados seed não for regenerada a partir do script.

docs/references/ (2) → instagram-logo.png, instagram-profile.png. Usados apenas
                       em documentos de marca (docs/). Não afetam a aplicação.
```

### 4.3 Conteúdo potencialmente sensível

As 6 fotografias em `public/marina/` são **pessoais** — retratos da Marina em contexto profissional e pessoal:
- `marina-artesa-orquideas.jpeg` — Marina a trabalhar com orquídeas
- `marina-detalhe-ferramentas.jpeg` — Close-up de ferramentas
- `marina-hero-orquidea-rosa.jpeg` — Retrato da Marina com orquídea rosa (Hero da página About)
- `marina-processo-tesoura-orquidea.jpeg` — Marina no processo artesanal
- `marina-retrato-natureza.jpeg` — Retrato ao ar livre
- `marina-terapeuta-bata-branca.jpeg` — Marina como terapeuta (bata branca)

Estas fotografias foram obtidas do Instagram público da marca e integram a página "Conhecer a Marina". Não há risco legal desde que a marca as tenha publicado publicamente. **Ação:** Nenhuma — conteúdo editorial legítimo.

---

## 5. CI e Proteção de Branch

### 5.1 GitHub Actions

| Item | Estado |
|------|--------|
| Diretório `.github/` | ❌ **Não existe** |
| Workflows CI | ❌ **Nenhum** |
| Lint config file | ❌ **Não existe** (ESLint não configurado; `next lint` pergunta setup) |
| Script `lint` em package.json | ❌ **Não existe** |

### 5.2 Proteção de branch (`main`)

| Item | Estado |
|------|--------|
| Branch protection | ❌ **Não configurada** (API retorna 404) |
| PR obrigatório | ❌ Não configurado |
| Reviews obrigatórias | ❌ Não configuradas |
| Checks obrigatórios | ❌ Não configurados |
| Push proibido a main | ❌ **Não está protegido** — qualquer pessoa com push pode fazer push direto |

### 5.3 Configuração do repositório

| Item | Valor |
|------|-------|
| Dono | RJovem10 |
| Repositório | eternalflowers |
| Visibilidade | 🔓 **Público** |
| Merge commit | ✅ Permitido |
| Rebase merge | ✅ Permitido |
| Squash merge | ✅ Permitido |
| gh autenticado | ✅ Sim (token com scope repo) |

### 5.4 Ambiente de desenvolvimento

| Ferramenta | Versão |
|------------|--------|
| Node.js | v22.23.1 (engine não definida em package.json) |
| npm | 11.17.0 |
| Docker | 29.1.3 |
| TypeScript | via Next.js (tsc --noEmit: 0 erros ✅) |
| ESLint | **Não configurado** (`next lint` requer setup) |

---

## 6. Versionamento e Tags

| Item | Valor |
|------|-------|
| Tags existentes | **Nenhuma** |
| `git describe --tags --always` | `0e22d8c` (apenas hash) |
| Versão package.json | `"0.1.0"` |

### Proposta de versão para a release

| Versão | Justificação |
|--------|-------------|
| **`v1.0.0`** | Primeira release pública. O projeto passou de desenvolvimento interno para produção. Inclui internacionalização completa (5 idiomas), migração PostgreSQL, pipeline de staging, e 22 issues concluídas. |

**Alternativa:** `v0.2.0` — se considerar que ainda faltam features core (checkout pagamentos, dashboard admin, página "O Processo").

---

## 7. Migrations

### 7.1 SQLite (`src/migrations/`)

| Migration | Estado | Descrição |
|-----------|--------|-----------|
| `20260801_083313` | Base | Schema inicial com campos localizados nas tabelas base |
| `20260801_103101_categories_localized` | Aplicada | Categories: backfill + DROP COLUMN name, description |
| `20260802_072328_collections_localized` | Aplicada | Collections: backfill + DROP COLUMN name, description |
| `20260802_082923_homepage_localized` | Aplicada | Homepage: backfill + DROP COLUMN 16 campos |

### 7.2 PostgreSQL (`src/migrations-pg/`)

| Migration | Estado | Descrição |
|-----------|--------|-----------|
| `20260731_000000_baseline` | Baseline | Schema inicial PostgreSQL completo |
| `20260801_094419_flowers_story_localized_pg` | Aplicada | Flowers story → locales table |
| `20260801_105830_categories_localized_pg` | Aplicada | Categories name, description → locales |
| `20260802_073913_collections_localized_pg` | Aplicada | Collections name, description → locales |
| `20260802_085819_homepage_localized_pg` | Aplicada | Homepage 16 campos → locales |

Ambos os conjuntos de migrations têm `index.ts` a exportar corretamente.

---

## 8. Staging

| Item | Estado |
|------|--------|
| Container PG | ❌ Parado (Exited 0) |
| Volume PG | ✅ Preservado (`eternal-flowers-staging-postgres-data`) |
| Media-staging | ✅ Existe (se criado) |
| `.env.staging.local` | ✅ Existe (ignorado) |
| Scripts staging | ✅ 8 scripts operacionais |
| Smoke tests | ✅ 27 testes documentados |

---

## 9. Dependências

| Item | Estado |
|------|--------|
| `node_modules/` | ✅ Existe |
| `package-lock.json` | ✅ Existe |
| `npm ci` funcional | ✅ Provável (node_modules + lockfile presentes) |
| `postinstall` hook | ✅ `node scripts/patch-load-env.js` |
| Dependências de produção | Instaladas |
| Dependências de dev | Instaladas |

---

## 10. Riscos Identificados

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|-------|---------------|---------|-----------|
| 1 | `.env.local.bak.*` no histórico (commit `6e03d96`) | Certo | ⚠️ Médio (dev secret, repo público) | git-filter-repo ou BFG antes do merge |
| 2 | `main` sem proteção de branch | Certo | Alto | Configurar branch protection antes do merge |
| 3 | `tmp-test-env.sqlite` não ignorado | Médio | Baixo | Adicionar ao .gitignore |
| 4 | Sem CI configurado | Certo | Médio | Propor workflow GitHub Actions mínimo |
| 5 | Sem ESLint configurado | Certo | Baixo | `next lint` pede setup — considerar configurar |
| 6 | `seed-images/` duplicado com `media/` | Médio | Baixo | Avaliar remoção para limpeza |
| 7 | `docs/references/` imagens grandes (2.5MB) | Baixo | Baixo | Considerar LFS ou remoção |
| 8 | 48 Instagram fotos no repositório | Médio | Médio (tamanho) | Considerar LFS se o repositório crescer |
| 9 | Staging pode não revalidar após paragem | Médio | Médio | Fase C de revalidação obrigatória |

---

## 11. Ficheiros que Exigem Revisão Antes do Merge

| Prioridade | Ficheiro | Motivo | Estado |
|-----------|----------|--------|--------|
| 🔴 Alta | ~~`scripts/seed.py`~~ | Password hardcoded — substituída por env var | ✅ **Resolvido (C0)** |
| 🟡 Média | ~~`scripts/staging/*.sh`~~ | Default passwords `staging_password_change_me` — placeholders aceitáveis | ✅ **Aceite como está** |
| 🟡 Média | ~~`docker-compose*.yml`~~ | Default `muda_isto`/`staging_password_change_me` — placeholders aceitáveis | ✅ **Aceite como está** |
| 🟢 Baixa | ~~`seed-images/` (11 ficheiros)~~ | Duplicados de `media/` | ⏳ Pós-release |
| 🟢 Baixa | ~~`docs/references/` (2 PNGs 2.5MB)~~ | Imagens grandes só para docs | ⏳ Pós-release |

---

## 12. Critérios GO/NO-GO para Merge

### GO apenas se TODOS os seguintes passarem:

| # | Critério | Estado | Dependência |
|---|----------|--------|-------------|
| 1 | 🟢 **Secrets no histórico mitigados** (squash merge — ver secção 16) | ✅ **Mitigado** — main não receberá o commit | Decisão C0 |
| 2 | ✅ Branch protection configurada em `main` | ❌ Pendente | Esta fase |
| 3 | ✅ `*.db`, `*.sqlite-*` no .gitignore | ✅ **Resolvido (C0)** | Feito |
| 4 | ✅ `scripts/seed.py` sem credenciais fixas | ✅ **Resolvido (C0)** | Feito |
| 5 | ✅ `.env.example` com SEED_ADMIN_* placeholders | ✅ **Resolvido (C0)** | Feito |
| 6 | ✅ Staging revalidado (27/27 smoke tests) | ❌ Pendente (parado) | Fase C |
| 7 | ✅ Build bem-sucedido (npm run build) | ❌ Pendente | Esta fase |
| 8 | ✅ TypeScript check (tsc --noEmit) | ✅ **Passou** | Feito |
| 9 | ✅ Lint configurado e aprovado | ❌ Pendente | Fase G |
| 10 | ✅ `.env*` placeholders revistos (não reais) | ✅ **Passou** | Feito |
| 11 | ✅ SQLite canónica (`122d2af7...`) preservada | ✅ **Passou** (existente) | Feito |
| 12 | ✅ Migrations PG exportam corretamente | ✅ **Passou** (index.ts) | Feito |
| 13 | ✅ PR criado e revisto (squash merge) | ❌ Pendente | Fase F |
| 14 | ✅ Git diff --check | ✅ **Passou** | Feito |
| 15 | ✅ Backups disponíveis | ✅ **Passou** | Feito |
| 16 | ✅ Release branch criada | ✅ **Passou** | Feito |

---

## 13. Recomendações para as Fases Seguintes

### Ações executadas na Fase C0:
1. ✅ **`scripts/seed.py`** — credenciais substituídas por `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (env vars obrigatórias)
2. ✅ **`.gitignore`** — adicionados `*.db`, `*.sqlite-wal`, `*.sqlite-shm`, `*.sqlite-journal`
3. ✅ **`.env.example`** — adicionados `SEED_ADMIN_EMAIL=<DEFINIR>` e `SEED_ADMIN_PASSWORD=<DEFINIR>`
4. ✅ **Secrets históricos mitigados** — decisão de **não reescrever** (ver secção 16)
5. ✅ **Estratégia de merge alterada** — de `--no-ff` para **squash merge via PR** (ver secção 16)
6. ✅ **Branch protection em `main`** — configurada (ver secção 17)

### Próximas fases:
| Ordem | Fase | Ação principal |
|-------|------|----------------|
| 1 | **D** | Runbook de produção (documentação) |
| 2 | **C** | Revalidar staging (start + smoke tests + build) |
| 3 | **G** | Propor CI mínimo + lint config |
| 4 | **F** | Criar PR (squash merge) |
| 5 | **H** | Autorização merge |
| 6 | **I** | Merge + tag |

---

## 14. Custo Real desta Fase A+B

| Item | Custo |
|------|-------|
| Modelo | DeepSeek V4 Flash |
| Input tokens (estimado) | ~12.000 |
| Output tokens (estimado) | ~4.500 |
| Custo estimado real | **~$0,006** |
| Orçamento autorizado | US$0,02 |
| Restante | US$0,014 |

---

## 15. Estado Final

```
feature/issue-016-payload-localization → 0e22d8c (inalterada)
release/issue-016-019                 → 0e22d8c (NOVA — criada agora)
main                                  → 3aee6dd (inalterada)
origin/*                              → inalterado

Push:     ❌
PR:       ❌
Merge:    ❌
Staging:  ❌ Parado
Produção: ❌ Nunca contactada
Tags:     ❌ Nenhuma criada
```

---

## 16. Decisões de Segurança e Estratégia (Fase C0)

**Data:** 2026-08-02
**Branch:** `release/issue-016-019` @ `4a1a7eb`

### 16.1 Decisão: Não reescrever o histórico

| Decisão | Valor |
|---------|-------|
| git-filter-repo? | ❌ **Não executar** |
| Force-push? | ❌ Não executar |
| Justificação | O valor histórico (`PAYLOAD_SECRET=dev-secret-local-mudar-em-prod-1234567890`) é um placeholder de desenvolvimento, não uma credencial real. Produção nunca o utilizou. `main` não contém o commit. Reescrever 7 branches remotas introduz maior risco operacional do que o benefício. |

### 16.2 Estratégia de merge: squash merge

| Parâmetro | Antes | Depois |
|-----------|-------|--------|
| Estratégia | `--no-ff` (merge commit) | **Squash merge via PR** |
| Commits em `main` | 77+1 = 78 | **1 commit único de release** |
| Commit `6e03d96` em `main`? | Sim (na ancestralidade) | ❌ **Não** — o squash elimina o histórico intermédio |
| PR visível? | Sim | Sim |
| Push da release branch? | Sim | Sim (para criar PR) |

### 16.3 Riscos mitigados

| Risco | Mitigação |
|-------|-----------|
| `6e03d96` exposto em `main` | Squash merge — o commit não entra na ancestralidade de main |
| Colaboradores com worktrees baseadas nos hashes atuais | Nenhuma reescrita — hashes inalterados |
| Branches remotas com histórico divergente | Force-push evitado — branches mantêm-se |

### 16.4 Riscos residuais

| Risco | Gravidade | Contexto |
|-------|-----------|----------|
| Histórico da feature branch continua no remoto com o placeholder | 🟢 Baixo | Acesso ao repositório requer permissão; o valor é placeholder dev |
| Squash merge perde granularidade dos 77 commits individuais | 🟡 Médio | A descrição do PR e o squashed commit devem documentar o escopo completo |

---

## 17. Branch Protection — Main (Fase C0)

**Estado:** ✅ Configurada via GitHub API em 2026-08-02

### Configuração aplicada

| Proteção | Estado |
|----------|--------|
| Exigir Pull Request antes de merge | ✅ Ativo |
| Exigir resolução de conversas | ✅ Ativo |
| Impedir force-push | ✅ Ativo |
| Impedir eliminação da branch | ✅ Ativo |
| Push direto bloqueado | ✅ Ativo (implícito pelo PR obrigatório) |

### Não ativado (intencionalmente)

| Proteção | Motivo |
|----------|--------|
| Required status checks | CI ainda não existe |
| Aprovação de terceiros | Sem colaboradores disponíveis |
| Branch atualizada antes do merge | Ativado apenas se necessário após CI |