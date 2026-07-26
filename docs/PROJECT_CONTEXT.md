# Loja Flores Marina - Project Context

## Objetivo

Criar uma loja online premium para venda de joias artesanais produzidas a partir de orquídeas naturais preservadas.

A aplicação deverá ser simples para a Marina utilizar, rápida, segura, preparada para crescer e totalmente self-hosted.

---

## Stack

Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS

Backend
- Route Handlers Next.js
- Payload CMS 3

Base de Dados
- SQLite (desenvolvimento)
- PostgreSQL (produção)

CMS
- Payload CMS

Deploy
- Docker
- Docker Compose
- VPS Linux

---

## Estado Atual

Implementado

- Homepage
- Catálogo
- Produto
- Carrinho
- Checkout
- Painel Admin
- Cupões
- i18n (5 idiomas)
- Payload CMS
- Docker

Não implementado

- Pagamentos
- Emails
- Área Cliente
- SEO
- Logs
- Reservas
- Deploy Produção

---

## Regras

- TypeScript apenas.
- Sem SQL direto.
- Toda a BD passa pelo Payload.
- Server Components por defeito.
- Client Components apenas quando necessário.
- Código preparado para produção.
- Não criar abstrações sem necessidade.
- Não criar serviços vazios.

---

## Arquitetura

Browser

↓

Next.js

↓

Route Handlers

↓

Services (quando necessários)

↓

Payload CMS

↓

Base de Dados

---

## Objetivo Final

Loja pronta para produção com:

- pagamentos
- emails
- backups
- deploy
- SEO
- administração simples para a Marina
