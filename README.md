# 🌸 Loja Flores Marina

Site e-commerce 100% custom (Next.js 14 App Router + Payload CMS 3), em **Português, Inglês, Espanhol, Italiano e Alemão**.

## Arquitetura
- **Frontend/Backend:** Next.js 14 (App Router, TypeScript) + Tailwind
- **CMS:** Payload CMS 3 (painel da Marina em `/admin`)
- **Base de dados:** SQLite em dev local · PostgreSQL na VPS (Docker)
- **Pagamentos:** Stripe PT (MB WAY + Multibanco) — *a confirmar; encomenda fica registada mesmo sem Stripe*
- **i18n:** 5 línguas via middleware + `[locale]`
- **Cupões:** tabela própria (validade, usos máximos, 1ª compra, valor mínimo, únicos)
- **Imagens:** upload local (sem S3)

## Desenvolvimento local (sem Docker, sem Postgres)
Pré-requisitos: Node 22+, npm.

```bash
npm install
cp .env.example .env.local   # (já existe um .env.local de dev)
npm run dev
```
Abrir:
- Loja: http://localhost:3000  → redireciona para /pt
- Painel (Marina): http://localhost:3000/admin
- Criar conta admin: primeira visita ao /admin pede registo

A BD é um ficheiro SQLite local (`loja-flores-marina.sqlite`), criado automaticamente.

## Deploy na VPS (Contabo)
1. Instalar Docker + docker-compose na VPS.
2. Criar ficheiro `.env` com `DATABASE_URI` (Postgres), `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL=https://floresmarina.pt`.
3. `docker compose up -d` (sobe Postgres + app).
4. Nginx + Cloudflare SSL à frente (ver arquitetura acordada).

## Estrutura
```
src/
  payload.config.ts      # CMS: flowers, media, coupons, orders
  app/
    [locale]/            # loja (home, catalog, flower, cart, checkout, thank-you)
    admin/               # painel da Marina (Payload)
    api/coupon           # valida cupão
    api/checkout         # cria encomenda + aplica cupão
  components/            # Header, CartProvider, FlowerCard, AddToCartButton
  i18n/dictionaries.ts   # PT/EN/ES/IT/DE
```

## Fluxo da Marina
1. Entra em /admin → cria conta (primeira vez).
2. "Flowers" → "Add" → foto + nome (PT/EN/ES/IT/DE) + preço + disponibilidade.
3. Publica → aparece na loja automaticamente.
4. Quando vende → muda "Disponibilidade" para "Vendido" (NÃO apaga).

## Pendente / fase 2
- Confirmar Stripe PT (MB WAY + Multibanco) e ligar pagamento real no checkout.
- Coleções visíveis na loja, QR code com SKU, área de cliente (Auth.js) — adiados.
