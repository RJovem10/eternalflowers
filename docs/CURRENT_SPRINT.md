# CURRENT SPRINT

## Sprint

Sprint 1

## Estado

🟢 Em progresso

---

## Issues concluídas

✅ ISSUE-001

Infraestrutura do projeto

Docker
Ambiente de desenvolvimento
Payload CMS operacional

Estado: Concluída

✅ ISSUE-002

Sistema de Cupões

Arquitetura revista
Validação centralizada

Estado: Concluída

✅ ISSUE-003

Modelo de Domínio

Durante esta issue definimos praticamente todo o negócio da Eternal Flowers:

Tipos de produto
Ciclo de vida dos produtos
Ciclo de vida das encomendas
Regras de stock
Fotografias modelo vs fotografia real
Produtos únicos
Produtos permanentes
Produtos sazonais
Produtos exclusivos
Filosofia da marca
Regras futuras

Estado: Concluída

✅ ISSUE-004
Evolução do Schema Payload
Passo 1

✅ productType

Passo 2

✅ scientificName

✅ creationName

Passo 3

✅ Nova coleção Categories

✅ Relationship Flowers → Category

Decisões arquiteturais

Também ficaram decididas (embora ainda não implementadas):

Collections será uma coleção própria
Uma peça pertence a uma categoria
Uma peça pode pertencer a várias coleções
"Conjuntos" é uma categoria, não um bundle
A Marina pode criar e eliminar categorias
As coleções também serão totalmente configuráveis

Estado: Parcialmente concluída (falta implementar Collections)

✅ ISSUE-006
Homepage CMS
Passo 1

Global:

Homepage

com:

Hero
Hero Image
Hero Title
Hero Subtitle
Botões
Passo 2

Frontend

✅ Hero ligado ao Global Homepage

Passo 3

Componentes reutilizáveis

✅ <Button />

✅ <Section />Estado: Em progresso

🟡 ISSUE-005

Na prática acabou por ser uma issue de UX / Descoberta, não de código.

Tomámos decisões muito importantes:

Identidade
luxo artesanal
humano
acessível
elegante
natureza
exclusividade
Homepage

Definimos:

Hero
ordem das secções
experiência emocional
CTA
papel da Marina
percurso da cliente
Customer Journey

Também ficou praticamente fechada.

Estado: Concluída (documentação)

ISSUE-004
✓ Passo 4 concluído
- Nova coleção Collections
- Relação Flowers ↔ Collections (many-to-many)
- Build validado

ISSUE-007
✓ Componentes reutilizáveis
- Button
- Section
- Arquitetura aprovada

Estado:
Concluída


Criar:

Collections

Relacionamento:

Flowers

↓

Collections (many)
ISSUE-006

Continuar Homepage.

As próximas secções deverão ser:

São flores verdadeiras?
Categorias
Coleções
História da Marina
Novidades
Testemunhos
Instagram
Footer



## Issue atual

Nenhuma

---

## Próxima Issue



---

## Objetivo do Sprint

Preparar a infraestrutura do projeto para produção e reduzir dívida técnica sem alterar funcionalidades.

---

## Próximas prioridades

### P0 (Obrigatório)

- Backup
- Deploy VPS
- Gateway de pagamento

### P1

- Emails
- SEO

### P2

- Área cliente
- Dashboard
- IA
- QR Code

---

## Estado do projeto

Arquitetura: ✅

Docker: ✅

Cupões: ✅

Pagamentos: ⏳

Emails: ⏳

SEO: ⏳

Deploy: ⏳

Branding: ⏳

Frontend Premium: ⏳
