# Catalog Assistant API — Eternal Flowers

## 1. Objetivo

Esta API permite que um assistente externo (ChatGPT Actions, da Marina) consulte,
crie e edite o catálogo da Eternal Flowers de forma segura e restrita.

A Marina usa o ChatGPT para preparar conteúdo do catálogo.
Depois revê e ativa manualmente no Payload Admin.

**Regra fundamental:** nada do que é criado/editado por esta API fica visível no site
sem aprovação manual da Marina.

## 2. Arquitetura

```
ChatGPT (Marina)
    |
    | HTTPS + Bearer Token
    v
Catalog Assistant API  (/api/catalog-assistant/*)
    |
    | Payload Local API
    v
Payload CMS (flowers, categories, collections, media)
```

O ChatGPT **nunca** recebe acesso direto ao Payload Admin ou à REST API genérica do Payload.
A Catalog Assistant API é uma camada intermediária com:

- Autenticação própria (Bearer token)
- Allowlists de campos por recurso
- Forçar isPublic=false / isActive=false no servidor
- Rejeição de campos desconhecidos
- Sem exposição de outros recursos (orders, payments, users, etc.)

## 3. Autenticação

A API usa autenticação via Bearer token.

**Header HTTP:**
```
Authorization: Bearer <CATALOG_ASSISTANT_API_KEY>
```

**Variável de ambiente:**
```
CATALOG_ASSISTANT_API_KEY=<chave>
```

**Gerar chave segura:**
```bash
openssl rand -hex 32
```

A chave gera 64 caracteres hexadecimais (256 bits de entropia).

**Segurança:**
- Token nunca é devolvido em respostas de erro
- Token nunca é escrito nos logs
- Comparação constant-time para evitar timing attacks
- Ausência de token → 401
- Token inválido → 401
- API funciona apenas por HTTPS em produção
- Sem autenticação por query string

## 4. Variáveis de ambiente

Adicionar ao `.env` (desenvolvimento) ou `.env.production` (produção):

```bash
# Catalog Assistant API Key
# Gerar com: openssl rand -hex 32
CATALOG_ASSISTANT_API_KEY=<gerar_chave_aqui>
```

## 5. Endpoints

Namespace base: `/api/catalog-assistant`

### Products (Flowers)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/catalog-assistant/products | Listar produtos (paginado, pesquisa por nome/SKU) |
| GET | /api/catalog-assistant/products/:id | Obter produto |
| POST | /api/catalog-assistant/products | Criar produto |
| PATCH | /api/catalog-assistant/products/:id | Atualizar produto |

### Categories

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/catalog-assistant/categories | Listar categorias (paginado) |
| GET | /api/catalog-assistant/categories/:id | Obter categoria |
| POST | /api/catalog-assistant/categories | Criar categoria (com traduções) |
| PATCH | /api/catalog-assistant/categories/:id | Atualizar categoria |

### Collections

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/catalog-assistant/collections | Listar coleções (paginado) |
| GET | /api/catalog-assistant/collections/:id | Obter coleção |
| POST | /api/catalog-assistant/collections | Criar coleção (com traduções) |
| PATCH | /api/catalog-assistant/collections/:id | Atualizar coleção |

### Media

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/catalog-assistant/media | Listar media (paginado) |
| GET | /api/catalog-assistant/media/:id | Obter media |
| POST | /api/catalog-assistant/media | Upload de fotografia (multipart/form-data) |

### Não implementados

- DELETE (qualquer recurso) → 405
- PUT → 405
- Qualquer rota fora de products/categories/collections/media → 404

## 6. Regra de Visibilidade

### Produtos (isPublic)

**Qualquer CREATE ou UPDATE pela API:** `isPublic = false`

Mesmo que o body contenha `isPublic: true`, o servidor força `false`.
Se um produto público for editado, o servidor coloca-o imediatamente como `isPublic = false`.

A Marina reativa manualmente no Payload Admin com 1 clique.

### Categorias (isActive)

**Qualquer CREATE ou UPDATE pela API:** `isActive = false`

Mesmo que o body contenha `isActive: true`, o servidor força `false`.

### Coleções (isActive)

**Qualquer CREATE ou UPDATE pela API:** `isActive = false`

Mesmo que o body contenha `isActive: true`, o servidor força `false`.

## 7. Formatos de dados

### Traduções (categorias e coleções)

Categorias e coleções usam campos localizados do Payload.
A API aceita o formato `translations`:

```json
{
  "translations": {
    "pt": { "name": "Nome PT", "description": "Descrição PT" },
    "en": { "name": "Name EN", "description": "Description EN" },
    "es": { "name": "Nombre ES", "description": "Descripción ES" },
    "it": { "name": "Nome IT", "description": "Descrizione IT" },
    "de": { "name": "Name DE", "description": "Beschreibung DE" }
  },
  "slug": "nome-unico"
}
```

Locais suportados: `pt` (obrigatório), `en`, `es`, `it`, `de`.

### Image (categorias e coleções)

Categorias e coleções suportam uma imagem de capa opcional.

```json
{
  "image": 1,
  "translations": { ... },
  "slug": "exemplo"
}
```

O valor deve ser um ID de Media válido (criado via upload em `/api/catalog-assistant/media`).

### Story (produtos) — texto localizado

O campo `story` (História da Peça) aceita dois formatos:

**String simples** (equivale ao locale PT, o default):

```json
{
  "story": "A história em português..."
}
```

**Objeto com locales** (suporta todos os 5 idiomas):

```json
{
  "story": {
    "pt": "A história em português...",
    "en": "The story in English...",
    "es": "La historia en español...",
    "it": "La storia in italiano...",
    "de": "Die Geschichte auf Deutsch..."
  }
}
```

Podes enviar apenas os locales que pretendes — os restantes mantêm-se inalterados ou ficam vazios.

### Media Upload

**Formato:** `multipart/form-data`

Campo obrigatório: `file` (ficheiro de imagem)

**MIME types aceites:**
- `image/jpeg`
- `image/png`
- `image/webp`

**Tamanho máximo:** 10 MB

## 8. Respostas

### Sucesso (200/201)

```json
{
  "success": true,
  "data": { ... }
}
```

### Erro (400/401/404/409/413/415/500)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_FIELD",
    "message": "Campos inválidos: Campo desconhecido: \"corFavorita\""
  }
}
```

### Códigos de erro

| HTTP | Code | Descrição |
|------|------|-----------|
| 400 | INVALID_FIELD | Campo desconhecido ou proibido |
| 400 | VALIDATION_ERROR | Erro de validação do Payload |
| 401 | UNAUTHORIZED | Token ausente ou inválido |
| 404 | NOT_FOUND | Recurso não encontrado |
| 405 | — | Método HTTP não permitido |
| 409 | CONFLICT | Registo duplicado (slug/nome único) |
| 413 | FILE_TOO_LARGE | Upload excede 10 MB |
| 415 | INVALID_MIME_TYPE | Tipo de ficheiro não aceite |
| 500 | INTERNAL_ERROR | Erro interno do servidor |

## 9. Exemplos curl

### Listar produtos
```bash
curl -H "Authorization: Bearer <CHAVE>" \
  "https://eternalflowers.pt/api/catalog-assistant/products?page=1&limit=10"
```

### Pesquisar produtos
```bash
curl -H "Authorization: Bearer <CHAVE>" \
  "https://eternalflowers.pt/api/catalog-assistant/products?search=rosa"
```

### Criar produto
```bash
curl -X POST \
  -H "Authorization: Bearer <CHAVE>" \
  -H "Content-Type: application/json" \
  -d '{
    "namePt": "Rosa Vermelha Preservada",
    "nameEn": "Preserved Red Rose",
    "price": 45.00,
    "scientificName": "Rosa gallica",
    "productType": "permanente",
    "productionMode": "unique",
    "stockQuantity": 1
  }' \
  "https://eternalflowers.pt/api/catalog-assistant/products"
```

### Atualizar produto
```bash
curl -X PATCH \
  -H "Authorization: Bearer <CHAVE>" \
  -H "Content-Type: application/json" \
  -d '{"price": 55.00}' \
  "https://eternalflowers.pt/api/catalog-assistant/products/1"
```

### Criar categoria com traduções
```bash
curl -X POST \
  -H "Authorization: Bearer <CHAVE>" \
  -H "Content-Type: application/json" \
  -d '{
    "translations": {
      "pt": {"name": "Colares", "description": "Coleção de colares"},
      "en": {"name": "Necklaces", "description": "Necklace collection"}
    },
    "slug": "colares"
  }' \
  "https://eternalflowers.pt/api/catalog-assistant/categories"
```

### Upload de imagem
```bash
curl -X POST \
  -H "Authorization: Bearer <CHAVE>" \
  -F "file=@foto.jpg" \
  "https://eternalflowers.pt/api/catalog-assistant/media"
```

## 10. ChatGPT Action — Configuração Futura

Para ligar esta API ao ChatGPT da Marina:

1. Ir a https://chat.openai.com/gpts/editor
2. Criar ou editar o GPT da Marina
3. Em "Actions", colar o conteúdo de `docs/catalog-assistant-openapi.yaml`
4. Em "Authentication", selecionar "API Key" → "Bearer"
5. Inserir a chave real (gerada com `openssl rand -hex 32`)
6. Nota: ChatGPT Actions têm limite de ~5 MB para uploads, que é compatível com o limite de 10 MB da API.

## 11. Revogar/Rodar a Chave

Para revogar ou rodar a chave:

1. Gerar nova chave: `openssl rand -hex 32`
2. Atualizar a variável `CATALOG_ASSISTANT_API_KEY` no ambiente de produção
3. Reiniciar o container Next.js
4. Atualizar a chave na configuração da ChatGPT Action

A chave antiga deixa de funcionar imediatamente após o reinício.

## 12. Limitações

- **Sem hard DELETE:** A API não permite apagar produtos, categorias, coleções ou media.
  A eliminação definitiva é feita pela Marina no Payload Admin.
- **Sem acesso a stocks/reservas/orders/payments/cupões.**
- **Apenas JSON** (exceto media upload que é multipart/form-data).
- **Rate limiting:** Não implementado nesta versão (a implementar no proxy/reverse proxy).
- **Campos desconhecidos são rejeitados com 400**, não ignorados silenciosamente.
- **isPublic/isActive são controlados exclusivamente pelo servidor.**
- As validações existentes do modelo de produto (validateProductModel) continuam a ser aplicadas.

## 13. Manutenção

### Ficheiros do projeto

| Ficheiro | Descrição |
|----------|-----------|
| `src/services/catalog-assistant.ts` | Lógica core: auth, allowlists, CRUD, força visibilidade |
| `src/app/api/catalog-assistant/[...slug]/route.ts` | Route handler Next.js |
| `src/app/api/catalog-assistant/[...slug]/route.test.ts` | Testes (50 testes) |
| `docs/catalog-assistant-openapi.yaml` | OpenAPI 3.0 para ChatGPT Actions |
| `docs/catalog-assistant-api.md` | Esta documentação |
| `.env.example` | Variável CATALOG_ASSISTANT_API_KEY adicionada |
| `.env.production.example` | Variável CATALOG_ASSISTANT_API_KEY adicionada |

### Adicionar novos campos permitidos

Se novos campos forem adicionados ao schema de products/categories/collections,
atualizar as allowlists em `src/services/catalog-assistant.ts`:

- `FLOWER_ALLOWLIST` — campos de produto
- `CATEGORY_ALLOWLIST` / `CATEGORY_BLOCKED` — campos de categoria
- `COLLECTION_ALLOWLIST` / `COLLECTION_BLOCKED` — campos de coleção
- `LOCALIZED_ALLOWLIST` — sub-campos de tradução (name, description)

E atualizar o OpenAPI em `docs/catalog-assistant-openapi.yaml`.