# Fase E0 — Baseline e Backup (Payload Localization)

> Data: 1 de Agosto de 2026
> Projeto: Eternal Flowers by Mar&Natur
> Branch: `feature/issue-016-payload-localization`
> Commit base: `23debea` (docs(i18n): fecha implementação frontend da ISSUE-016)

---

## 1. Configuração Estrutural

| Item | Valor |
|------|-------|
| Payload | ^3.0.0 |
| Adapter dev | SQLite (`@payloadcms/db-sqlite`) |
| Adapter prod | PostgreSQL (`@payloadcms/db-postgres`) |
| push mode (dev) | `true` (schema automático) |
| prodMigrations | Não configurado |
| localization | **Não configurada** |
| i18n Admin | **Não configurado** |
| Rich text | Não instalado |

## 2. Base de Dados Local

| Atributo | Valor |
|----------|-------|
| Ficheiro | `loja.sqlite` (raiz do projeto) |
| Tamanho | 372,736 bytes |
| Journal mode | `delete` |
| Integrity check | `ok` |
| Foreign key check | 0 erros |
| Tabelas | 18 |
| Migrations aplicadas | 1 (`dev`, batch -1 — push automático) |

## 3. Backup

| Atributo | Valor |
|----------|-------|
| Método | `.backup` do SQLite |
| Localização | `~/backups/eternalflowers/` |
| Ficheiro | `eternalflowers-dev-pre-localization-20260801-090407.sqlite` |
| Tamanho | 372,736 bytes |
| SHA-256 | `a4a053de8a868d092112dc1615559b53436707d904d7afd16c83fa6d8a8ef703` |
| Integrity check | `ok` |
| Foreign key check | 0 erros |

## 4. Contagem de Documentos (Sanitizada)

| Collection/Global | Documentos | Notas |
|-------------------|-----------|-------|
| Flowers | 10 | namePt..nameDe + descriptionPt..descriptionDe |
| Categories | 5 | name/description só PT |
| Collections | 6 | name/description só PT |
| Media | 11 | uploads (público) |
| Coupons | 0 | — |
| Orders | 0 | — |
| Users | 1 | admin |
| Homepage (global) | 1 | ~12 campos text em PT |

## 5. Media Storage

| Atributo | Valor |
|----------|-------|
| Localização | `media/` |
| Ficheiros | 14 |
| Tipo | Uploads locais (filesystem) |

## 6. Baseline Funcional

| Teste | Resultado |
|-------|-----------|
| `npm run build` | ✅ 0 erros |
| `/pt` | 200 |
| `/en` | 200 |
| `/pt/catalog` | 200 |
| `/pt/flower/10` | 200 |
| `/admin` | 200 |
| `GET /api/media?limit=1` | 200, JSON válido |

## 7. Scripts Relevantes

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — servidor de produção
- `npm run payload` — CLI do Payload
- `npm run generate:types` — geração de tipos TypeScript

## 8. Plano Futuro de Backup PostgreSQL (Produção)

Antes da Fase E6 (produção), executar:

```
pg_dump --format=custom --no-owner --no-privileges --file=eternalflowers-prod-$(date +%Y%m%d).dump "$DATABASE_URI"
pg_restore --list eternalflowers-prod-*.dump  # validar
```

Obrigatório:
- pg_dump com formato custom (-Fc)
- pg_restore --list para validação
- backup de uploads (tar czf)
- maintenance window
- teste de restauro em base isolada

## 9. Limitações

- PostgreSQL de produção **não foi contactado** nesta fase
- Nenhuma alteração ao schema, dados ou configuração do Payload
- Nenhuma migration foi criada ou executada
- Nenhum dado foi alterado
- Nenhum push foi feito