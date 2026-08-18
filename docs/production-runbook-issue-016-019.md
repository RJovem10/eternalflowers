# Eternal Flowers — Runbook de Produção (Issues 016-019)

**Documento:** `docs/production-runbook-issue-016-019.md`
**Data:** 2026-08-02
**Branch:** `release/issue-016-019`
**HEAD:** `65f761a`

> ⚠️ **Nenhum passo deste runbook foi executado.**
> Produção nunca foi contactada. Este documento é um plano.
> Sempre que um passo exige decisão do operador, está assinalado com `<DECISÃO PENDENTE>`.

---

## 0. Estado de Partida

| Parâmetro | Valor |
|-----------|-------|
| Release branch | `release/issue-016-019` @ `65f761a` |
| Feature branch | `feature/issue-016-payload-localization` @ `0e22d8c` |
| `main` | `3aee6dd` (inalterada) |
| Origin | Feature branches pushed; release branch **não pushed** |
| Staging | Parado (volumes preservados) |
| Produção | Nunca contactada |
| Repositório | 🔓 Público |

---

## 1. Arquitetura Proposta

### 1.1 Diagrama conceptual

```
                    Internet
                       │
                   [Caddy]
               TLS (Let's Encrypt)
                       │
               ┌───────┴───────┐
               │  Rede Docker  │
               │  (bridge)     │
               │               │
          ┌────┴────┐    ┌────┴────┐
          │  App    │    │  PG 16  │
          │ :3000   │    │ :5432   │
          └─────────┘    └─────────┘
               │               │
          ┌────┴────┐    ┌────┴────┐
          │  Media  │    │  Dados  │
          │ Volume  │    │ Volume  │
          └─────────┘    └─────────┘
```

### 1.2 Componentes

| Componente | Função | Container | Público? |
|------------|--------|-----------|----------|
| **Caddy v2** | Reverse proxy + TLS automático (Let's Encrypt) | Sim (Docker) | ✅ :80 + :443 |
| **Next.js / Payload** | Aplicação web + CMS headless | Sim (Docker) | ❌ Rede interna |
| **PostgreSQL 16** | Base de dados | Sim (Docker) | ❌ Rede interna |
| **Volume `postgres_data`** | Dados persistentes da BD | — | ❌ |
| **Volume `media_data`** | Ficheiros de upload (imagens) | — | ❌ |
| **Volume `caddy_data`** | Certificados TLS (Let's Encrypt) | — | ❌ |
| **Volume `caddy_config`** | Configuração interna do Caddy | — | ❌ |

### 1.3 Reverse Proxy Recomendado: Caddy

| Critério | Caddy | Nginx | Traefik |
|----------|-------|-------|---------|
| TLS automático (Let's Encrypt) | ✅ Nativo | ❌ Necessita certbot | ✅ Nativo |
| Configuração | 1 ficheiro (Caddyfile) | ~3 ficheiros (nginx.conf, site, SSL) | Labels Docker + ficheiro dinâmico |
| Complexidade | Muito baixa | Média | Média-alta |
| Manutenção | Mínima | Moderada | Moderada |
| Peso | ~50 MB | ~25 MB (OTEL) | ~100 MB |
| Docker native | ✅ Sim | ✅ Sim | ✅ Sim |

**Recomendação: Caddy v2** — para um projeto de loja com 1 domínio e TLS obrigatório, o Caddy oferece a configuração mais simples e segura. Não precisa de certbot, renovação manual, ou configuração complexa de upstream.

### 1.4 Stack tecnológica (VPS)

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| SO | Debian 12 / Ubuntu 22.04+ | — |
| Runtime | Node.js | 22+ (via imagem Docker) |
| Container | Docker + Compose plugin | 24+ |
| BD | PostgreSQL | 16-alpine (Docker) |
| Proxy | Caddy | 2-alpine (Docker) |
| TLS | Let's Encrypt (automático Caddy) | — |

---

## 2. Templates de Produção

### Ficheiros criados

| Ficheiro | Propósito |
|----------|-----------|
| `docker-compose.production.yml` | Compose para VPS (4 serviços: postgres, app, caddy) |
| `Caddyfile` | Reverse proxy com TLS automático, encoding, redirecionamento www |
| `.env.production.example` | Variáveis de ambiente (placeholders apenas) |
| `configs/production/Caddyfile.example` | Reverse proxy template (obsoleto — usar Caddyfile root) |
| `scripts/production/preflight.sh` | Validação read-only antes do cutover |
| `scripts/production/backup.sh` | Backup PostgreSQL + Media com manifesto SHA-256 |
| `scripts/production/restore.sh` | Restore com confirmação explícita |
| `scripts/production/smoke-test.sh` | Testes HTTP (18+ verificações) |

### Como usar

```bash
# 1. Copiar templates
# docker-compose.production.yml e Caddyfile já estão versionados no repositório
cp .env.production.example .env.production

# 2. Preencher .env.production (NUNCA versionar)
#    Gerar PAYLOAD_SECRET: openssl rand -hex 32
#    Gerar POSTGRES_PASSWORD: openssl rand -hex 16

# 3. Garantir que DNS aponta para o VPS antes de arrancar
#    Digite os seus registos A:
#    eternalflowers.pt  →  <IP_VPS>
#    www.eternalflowers.pt  →  <IP_VPS>
#    Verificar: dig eternalflowers.pt +short

# 4. Garantir que as portas 80 e 443 estão abertas no firewall do VPS
#    (ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp)

# 5. Preflight
./scripts/production/preflight.sh

# 6. Arrancar
docker compose -f docker-compose.production.yml --env-file .env.production up -d

# 7. Verificar certificados TLS (Caddy obtém Let's Encrypt automaticamente)
docker compose -f docker-compose.production.yml logs caddy

# 8. Smoke tests
BASE_URL=https://<DOMINIO> ./scripts/production/smoke-test.sh
```

### Segurança dos templates

| Requisito | Estado |
|-----------|--------|
| Sem passwords default | ✅ `!reset` nas portas (vazias) |
| Sem credenciais hardcoded | ✅ Placeholders `<DEFINIR>`, `<GERAR_SECRET>`, `<DOMINIO>` |
| Sem localhost incompatível | ✅ Nomes de container Docker internos |
| PG sem porta pública | ✅ `expose` apenas, `ports: []` |
| App sem porta pública | ✅ Só o Caddy expõe portas |
| Volumes persistentes | ✅ Nomeados, prefixo `eternal-flowers-*` |
| Healthchecks | ✅ PG (`pg_isready`), app (`depends_on`) |
| Restart policy | ✅ `unless-stopped` |
| Limites de recursos | ✅ Memória documentada |

---

## 3. Preflight

O script `scripts/production/preflight.sh` valida, sem modificar o sistema:

| Categoria | Verificações |
|-----------|-------------|
| Variáveis | `NODE_ENV=production`, `DATABASE_URI` PostgreSQL, `PAYLOAD_SECRET` >= 20 chars sem placeholder, `NEXT_PUBLIC_SITE_URL` real |
| Docker | Docker instalado, Docker Compose disponível |
| Ficheiros | Templates existem, Media >= 11 ficheiros |
| Segurança | Portas públicas no compose, passwords default em ficheiros versionados |
| Git | Branch e commit atuais |

**Saída:** `GO` (exit 0), `GO CONDICIONAL` (exit 0, com avisos), `NO-GO` (exit 1)

```bash
# Executar no diretório do projeto (VPS ou local)
./scripts/production/preflight.sh
```

---

## 4. Backup e Restore

### 4.1 Scripts

| Script | Função |
|--------|--------|
| `scripts/production/backup.sh` | pg_dump + tar.gz dos Media + manifesto SHA-256 |
| `scripts/production/restore.sh` | pg_restore + extrair Media (com confirmação explícita) |

### 4.2 Tipos de backup

| Tipo | Quando | Conteúdo | Comando |
|------|--------|----------|---------|
| **Pré-cutover** | Antes de qualquer alteração | SQLite final + Media | `./scripts/production/backup.sh` |
| **Pós-migração** | Após dados no PG | PostgreSQL dump + Media | `./scripts/production/backup.sh` |
| **Recorrente** | Diário (cron) | PostgreSQL dump apenas | `./scripts/production/backup.sh --pg-only` |

### 4.3 Backup pré-cutover (SQLite + Media)

```bash
# Backup da SQLite original (fora do Docker)
cp loja.sqlite "backups/pre-cutover-$(date +%Y%m%d_%H%M%S).sqlite"
sha256sum loja.sqlite > "backups/pre-cutover-manifest.txt"

# Backup dos Media
tar czf "backups/media-pre-cutover-$(date +%Y%m%d_%H%M%S).tar.gz" media/
sha256sum media/* >> "backups/pre-cutover-manifest.txt"
```

### 4.4 Backup pós-migração

```bash
DATABASE_URI="postgresql://loja:***@localhost:5432/loja_flores" \
  ./scripts/production/backup.sh
```

### 4.5 Segurança de restore

O restore exige confirmação explícita (`CONFIRMAR`). Protege contra:

- Restore contra produção por engano
- Ficheiro de dump corrompido
- Destino não verificado

---

## 5. Plano de Cutover

### Fase A — Preparação (dias antes)

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| A1 | Auditoria de segurança (Fase C0) | Concluído | Release audit OK | — | — |
| A2 | Staging: smoke tests 27/27 | 30 min | `npm run staging:test` | Falha → diagnosticar | N/A |
| A3 | Preflight no VPS | 5 min | `./scripts/production/preflight.sh` → GO | NO-GO → corrigir | N/A |
| A4 | Configurar DNS | <DECISÃO PENDENTE> | `dig <DOMINIO>` aponta para VPS | DNS não propagado | Reverter DNS |
| A5 | Configurar Caddyfile com domínio real | 5 min | `caddy validate` | Erro de sintaxe | Reverter Caddyfile |
| A6 | Backup pré-cutover (SQLite + Media) | 2 min | SHA-256 verificado | Hash diferente | — |

### Fase B — Freeze de escrita (início da janela)

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| B1 | Colocar site em modo de manutenção | <DECISÃO PENDENTE> | Página 503 visível | — | Remover modo manutenção |
| B2 | Parar aplicação SQLite em produção | <DECISÃO PENDENTE> | Porta 3000 livre | — | Reverter |

### Fase C — Backup final

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| C1 | Backup SQLite final | 1 min | SHA-256 registado | Falha de disco | N/A |
| C2 | Backup Media final | 2 min | SHA-256 registado | Falha de disco | N/A |
| C3 | Verificar hash SQLite canónica | 30s | `122d2af7...` | Hash diferente | Parar e investigar |

### Fase D — Provisionamento PostgreSQL (Docker)

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| D1 | Copiar `docker-compose.production.yml` e `.env.production` para VPS | 1 min | Ficheiros existem | — | `docker compose down` |
| D2 | Arrancar PostgreSQL | 30s | `docker ps` → healthy | PG não arranca | `docker compose down -v` |
| D3 | Criar base de dados | 10s | `psql -c '\l'` | — | `docker compose down` |

### Fase E — Migração de dados (52 registos)

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| E1 | Aplicar baseline E1 | 30s | `payload_migrations` regista E1 | Erro SQL | `DROP DATABASE; CREATE DATABASE` |
| E2 | Migrar 52 registos (media → cats → cols → flowers → hp → rels) | 2 min | Contagens: hp=1, cat=5, col=6, fl=10, rels=19, media=11 | Contagem errada | Restaurar baseline |
| E3 | Registo da baseline em payload_migrations | 10s | `SELECT * FROM payload_migrations` | — | Remover registo |

**Ferramenta de migração:** `scripts/postgresql/migrate-from-sqlite.ts`

### Fase F — E2–E4 (localização do schema)

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| F1 | Aplicar E2–E4 | 2 min | 4 locales tables existem | Erro de migration | `payload migrate:down` ou restore baseline |
| F2 | Verificar colunas removidas | 30s | `story` removida de flowers | Coluna residual | Reaplicar migration |
| F3 | Verificar locales PT preenchidos | 30s | fl=10, cat=5, col=6, hp=1 | Dados vazios | Re-importar |

### Fase G — Importação das traduções (272)

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| G1 | Validar manifestos | 30s | `npm run translations:validate` → 0 erros | Erro de validação | Corrigir manifestos |
| G2 | Dry-run | 30s | 272 PLANNED_WRITE | Writes inesperados | Investigar |
| G3 | Apply | 1 min | 272/272 verified | Falha de commit | Restore baseline |
| G4 | Idempotência | 30s | 0 WRITES, 272 SKIP | Writes repetidos | Investigar |

### Fase H — Criação do Admin

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| H1 | Definir `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` | 1 min | Variáveis definidas | — | — |
| H2 | Criar admin via Payload | 30s | Login funcional em `/admin` | Erro de criação | Remover user via SQL |

### Fase I — Cópia e validação dos Media

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| I1 | Copiar 11 ficheiros para `./media/` | 30s | 11 ficheiros presentes | Ficheiro em falta | Re-copiar |
| I2 | Verificar hashes | 30s | SHA-256 igual à origem | Hash diferente | Re-copiar |

### Fase J — Build e arranque (Docker)

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| J1 | Build da imagem | 5 min | `docker compose build` → exit 0 | Build error | Corrigir e rebuild |
| J2 | Arranque completo | 1 min | `docker compose up -d` → healthy | PG ou app não healthy | Ver logs |
| J3 | Verificar logs | 1 min | Sem erros fatais | Erro | `docker compose logs` |

### Fase K — Smoke tests

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| K1 | Smoke tests via Caddy | 2 min | `BASE_URL=https://<DOMINIO> ./scripts/production/smoke-test.sh` → 0 fails | Falha | Diagnosticar |
| K2 | Verificar Admin | 1 min | Login funcional | Não acessível | Ver logs |

### Fase L — Mudança de proxy/DNS

| Passo | Comando / Ação | Duração | Validação | Aborto | Rollback |
|-------|---------------|---------|-----------|--------|----------|
| L1 | Apontar DNS para VPS | <DECISÃO PENDENTE> | `dig <DOMINIO>` → IP VPS | DNS não propaga | Reverter DNS |
| L2 | Caddy obtém certificado TLS | 30s | HTTPS funcional | Certificado falha | Ver logs Caddy |
| L3 | Remover modo manutenção | 10s | Site acessível publicamente | — | Recolocar manutenção |

### Fase M — Monitorização pós-cutover

| Passo | Ação | Duração | Critério |
|-------|------|---------|----------|
| M1 | Verificar logs de erro | 15 min após cutover | Zero erros 5xx |
| M2 | Verificar tráfego | 1h após cutover | Tráfego normal |
| M3 | Backup pós-migração | 30 min após cutover | SHA-256 registado |

### Fase N — Encerramento da janela

| Passo | Ação | Validação |
|-------|------|-----------|
| N1 | Remover modo manutenção (se ainda ativo) | Site público |
| N2 | Documentar hashes finais | SHA-256 do dump pós-migração |
| N3 | Notificar equipa | — |

---

## 6. Rollback

### 6.1 Falha antes da migração (Fase D)

Se o PostgreSQL não arrancar ou a baseline falhar:

```bash
docker compose -f docker-compose.production.yml down -v
# Corrigir configuração e recomeçar da Fase D
```

### 6.2 Falha durante a migração (Fase E)

Se o script de migração falhar a meio:

```bash
# 1. Parar script
Ctrl+C

# 2. Descartar base PostgreSQL
# (via docker exec ou DROP DATABASE)

# 3. Recriar base vazia + baseline
# Recomeçar da Fase E

# 4. Nenhum dado perdido — SQLite original intacta
```

### 6.3 Falha após migração, antes do tráfego (Fases F-G-H-I-J-K)

Se E2–E4 falharem ou as traduções não forem importadas:

```bash
# Opção A: restaurar dump pós-migração (se existir)
./scripts/production/restore.sh --pg backups/pg-pre-e2.dump

# Opção B: recomeçar do zero
docker compose down -v
# Recomeçar da Fase D
```

### 6.4 Falha após tráfego mudar (Fase L)

Se o site estiver público e algo falhar:

```bash
# 1. Reverter DNS para apontar para a aplicação SQLite antiga
#    (TTL anterior determina a velocidade)
#
# 2. Se o problema for na aplicação (não na BD):
docker compose -f docker-compose.production.yml down app
docker compose -f docker-compose.production.yml up -d --build app

# 3. Se o problema for na BD:
#    a) Parar app
#    b) Restaurar PostgreSQL do dump
#    c) Reconstruir app

# 4. Se o problema for no proxy:
docker compose -f docker-compose.production.yml restart caddy
```

### 6.5 Media incompletos

```bash
# Restaurar do backup
./scripts/production/restore.sh --media backups/media-<timestamp>.tar.gz
```

### 6.6 Admin inacessível

```bash
# Verificar logs da app
docker compose -f docker-compose.production.yml logs app

# Recriar admin via seed se necessário
cd /opt/loja-flores
docker compose -f docker-compose.production.yml exec app \
  npx tsx scripts/seed.py
# (requer SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD definidos)
```

### 6.7 Split-brain prevention

Nunca ter a aplicação SQLite e PostgreSQL a receber tráfego simultaneamente:

1. Reverter DNS primeiro (esperar propagação)
2. Só depois parar a aplicação nova (ou vice-versa)
3. Verificar logs de acesso para confirmar que não há escritas concorrentes

---

## 7. Smoke Tests de Produção

### Uso

```bash
BASE_URL=https://floresmarina.pt ./scripts/production/smoke-test.sh
```

### O que testa

| Categoria | Testes |
|-----------|--------|
| Homepage (5 locales) | HTTP 200 |
| html lang | PT, EN, ES, IT, DE |
| Rotas principais | Catálogo, About, Cart, Checkout, Thank-you |
| 404 | Rota inexistente → 404 |
| API | Flowers (pública), Users (protegida → 403) |
| Admin | Login page → 200 |
| Media | hero.jpg → 200 |
| Conteúdo localizado | "Eternal" presente em todos os locales |
| Performance | < 5s por página |

---

## 8. Segurança

### 8.1 Checklist de segurança

| Item | Aplicado |
|------|----------|
| 🔑 PostgreSQL: utilizador não-superuser | ✅ `POSTGRES_USER != postgres` |
| 🔑 PostgreSQL: sem exposição pública | ✅ `ports: []` + `expose` |
| 🔑 TLS automático (Let's Encrypt) | ✅ Caddy gere |
| 🔑 HSTS (6 meses, preload) | ✅ Caddyfile |
| 🔑 X-Frame-Options: DENY | ✅ |
| 🔑 X-XSS-Protection | ✅ |
| 🔑 Content-Type: nosniff | ✅ |
| 🔑 Referrer-Policy | ✅ |
| 🔑 Permissions-Policy restrita | ✅ |
| 🔑 Content-Security-Policy básica | ✅ |
| 🔑 Backups com SHA-256 | ✅ |
| 🔑 Logs sem dados sensíveis | ✅ (passwords via env vars) |
| 🔑 Restore com confirmação explícita | ✅ (`CONFIRMAR`) |

### 8.2 Criação segura do Admin

O Admin de produção é criado pelo script `scripts/seed.py` (corrigido na Fase C0) com variáveis de ambiente obrigatórias. A password nunca aparece nos logs nem no Git.

### 8.3 Riscos residuais

| Risco | Mitigação |
|-------|-----------|
| Secrets de desenvolvimento no histórico (commit `6e03d96`) | Squash merge — não entram em `main` |
| Placeholders nos templates | Preflight valida antes do cutover |
| Staging com dados reais | Staging usa cópia isolada da SQLite canónica |

---

## 9. Critérios GO/NO-GO

### GO apenas se TODOS os seguintes passarem:

| # | Critério | Como verificar |
|---|----------|----------------|
| 1 | ✅ Backup SQLite verificado | SHA-256 registado |
| 2 | ✅ Backup Media verificado | 11 ficheiros, SHA-256 |
| 3 | ✅ Preflight aprovado | `./scripts/production/preflight.sh` → GO |
| 4 | ✅ Secrets configurados fora do Git | `.env.production` não versionado |
| 5 | ✅ PostgreSQL saudável | `docker ps` + healthcheck |
| 6 | ✅ Baseline E1 aplicada | `SELECT * FROM payload_migrations` |
| 7 | ✅ 52 registos migrados | hp=1, cat=5, col=6, fl=10, rels=19, media=11 |
| 8 | ✅ E2–E4 aplicadas | 4 locales tables existem |
| 9 | ✅ 68/68 sourceHash | `npm run translations:validate` |
| 10 | ✅ 272/272 traduções | dry-run → 0 writes |
| 11 | ✅ Admin criado | Login funcional em `/admin` |
| 12 | ✅ 11/11 Media copiados | SHA-256 igual à origem |
| 13 | ✅ Build aprovado | `docker compose build` → exit 0 |
| 14 | ✅ Smoke tests aprovados | `smoke-test.sh` → 0 fails |
| 15 | ✅ Rollback disponível | Dump SQLite + Media prontos |
| 16 | ✅ Responsável e janela definidos | <DECISÃO PENDENTE> |
| 17 | ✅ Monitorização disponível | <DECISÃO PENDENTE> |

**Qualquer falha crítica implica NO-GO.** Corrigir e revalidar antes de prosseguir.

---

## 10. Decisões Pendentes

As seguintes decisões precisam de si antes de qualquer acesso ao VPS:

| # | Decisão | Opções | Recomendação |
|---|---------|--------|-------------|
| 1 | **Domínio final** | `floresmarina.pt` (atual) ou outro | Manter `floresmarina.pt` |
| 2 | **Reverse proxy** | Nginx / Caddy / Traefik | **Caddy** (mais simples, TLS automático) |
| 3 | **Email para TLS (Let's Encrypt)** | Qual email usar? | `casaferreira1950@gmail.com` ou outro |
| 4 | **Localização dos volumes** | `/opt/loja-flores/` ou outro | `<DECISÃO PENDENTE>` |
| 5 | **Política de backup** | Diário com retenção de X dias | Proposta: diário, 30 dias de retenção |
| 6 | **Janela de manutenção** | Quando executar o cutover? | `<DECISÃO PENDENTE>` |
| 7 | **Indisponibilidade máxima aceitável** | 1h / 4h / 24h? | `<DECISÃO PENDENTE>` |
| 8 | **Método de atualização** | Build no VPS ou registry Docker | Build no VPS (sem registry) |
| 9 | **Monitorização** | Uptime Kuma / Healthchecks.io / Nenhum | Proposta: Healthchecks.io (gratuito, simples) |
| 10 | **Admin email** | Qual email para o Admin Payload? | `casaferreira1950@gmail.com` ou próprio |
| 11 | **SQLite antiga** | Remover ou preservar? | Preservar como read-only para rollback |
| 12 | **Estratégia DNS** | Apenas A record ou Cloudflare proxy? | `<DECISÃO PENDENTE>` |
| 13 | **Acesso SSH** | Qual utilizador de deployment? | `<DECISÃO PENDENTE>` |

---

## 11. Referências

| Documento | Conteúdo |
|-----------|----------|
| `docs/release-audit-issue-016-019.md` | Auditoria completa da release (secrets, media, CI, risks) |
| `docs/postgresql-migration-and-deployment-runbook-issue-018.md` | Migração SQLite → PostgreSQL detalhada |
| `docs/staging-guide-issue-019.md` | Ambiente de staging isolado |
| `docker-compose.production.yml` | Compose versionado para produção |
| `.env.production.example` | Env template (placeholders) |
| `configs/production/Caddyfile.example` | Reverse proxy template |
| `scripts/production/preflight.sh` | Preflight checklist |
| `scripts/production/backup.sh` | Backup PostgreSQL + Media |
| `scripts/production/restore.sh` | Restore com confirmação |
| `scripts/production/smoke-test.sh` | Smoke tests de produção |