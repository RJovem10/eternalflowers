# Eternal Flowers by Mar&Natur — Registo de Issues

> Documento central de acompanhamento do desenvolvimento.
> Actualizado em: 28 de Julho de 2026

---

## ⚪ Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Concluída |
| 🟡 | Em progresso |
| ⚪ | Planeada |

---

# Issues Concluídas

---

## ✅ ISSUE-001 — Infraestrutura do Projecto

### Objectivo
Estabelecer a base técnica do projecto: ambiente de desenvolvimento, framework, CMS e base de dados.

### Trabalho realizado
- Setup do projecto Next.js 15 com App Router
- Instalação e configuração do Payload CMS 3
- Configuração do Tailwind CSS v3.4
- Configuração Docker + Docker Compose
- Integração SQLite (desenvolvimento) / PostgreSQL (produção)
- Configuração de i18n com 5 idiomas (pt, en, es, it, de)

### Principais decisões técnicas
- **Stack:** Next.js 15 + Payload CMS 3 + Tailwind CSS + SQLite/Postgres
- **i18n:** Dicionários locais sem bibliotecas externas (dictionaries.ts + middleware)
- **Dev:** SQLite com `push: true` para migrações automáticas
- **Produção:** PostgreSQL via Docker Compose

### Estado
✅ Concluída

---

## ✅ ISSUE-002 — Sistema de Cupões

### Objectivo
Implementar descontos por código promocional.

### Trabalho realizado
- Criada colecção `Coupons` no Payload
- Tipos de desconto: percentagem e valor fixo
- Validação de validade, usos máximos, valor mínimo
- Suporte para "apenas primeira compra"
- Integração com checkout e cálculo de totais

### Principais decisões técnicas
- Validação centralizada no servidor (Route Handler `/api/coupon`)
- Sem dependências externas — lógica própria

### Estado
✅ Concluída

---

## ✅ ISSUE-003 — Modelo de Domínio

### Objectivo
Definir o funcionamento do negócio da Eternal Flowers como base para todas as decisões técnicas.

### Trabalho realizado
- Definição dos tipos de produto (Permanente, Sazonal, Exclusivo)
- Ciclo de vida dos produtos e encomendas
- Regras de stock: "Em stock" vs "Produzido por encomenda"
- Filosofia da marca: tecnologia ao serviço da artesã
- Perfil do cliente ideal (mulher, 40-55 anos)
- Customer journey e experiência esperada
- Categorias de produto (Colares, Brincos, Pulseiras, Porta-chaves, Molduras, Conjuntos)
- Perguntas que o website deve responder antes do contacto

### Principais decisões técnicas
- A tecnologia nunca substitui a relação humana
- Cada peça pode pertencer a uma categoria e a várias colecções
- Conjuntos são uma categoria, não um bundle técnico
- Fotografia de modelo vs fotografia real da peça
- WhatsApp como extensão natural da experiência

### Documentos produzidos
- `docs/DOMAIN_MODEL.md`

### Estado
✅ Concluída

---

## ✅ ISSUE-004 — Evolução do Schema Payload

### Objectivo
Implementar os campos e colecções necessários para representar o modelo de domínio no CMS.

### Trabalho realizado
**Passo 1:** Campo `productType` (select: permanente, sazonal, exclusivo)
**Passo 2:** Campos `scientificName` e `creationName`
**Passo 3:** Nova colecção `Categories` + relationship `Flowers → Category`
**Passo 4:** Nova colecção `Collections` + relationship `Flowers ↔ Collections` (many-to-many)

### Principais decisões técnicas
- Categories: relação one-to-one com Flowers
- Collections: relação many-to-many com Flowers
- Categories e Collections são totalmente configuráveis pela Marina no CMS
- Types actualizados com `payload generate:types`

### Estado
✅ Concluída

---

## ✅ ISSUE-005 — UX / Descoberta da Marca

### Objectivo
Definir a identidade visual, tom e experiência emocional da marca.

### Trabalho realizado
- Definição da identidade: luxo artesanal, humano, acessível, elegante, natureza, exclusividade
- Estrutura da homepage definida secção a secção
- Experiência emocional e percurso da cliente mapeados
- Customer Journey documentado
- Papel da Marina na experiência do cliente

### Principais decisões
- Hero com fotografia de fundo + título + subtítulo + 2 CTAs
- Secções da homepage: Hero → Flores Verdadeiras → Categorias → Colecções → História → Escolhas da Marina → Presença Internacional → Instagram → CTA Final → Footer
- Tom: delicado, artesanal, emocional, premium

### Estado
✅ Concluída (documentação)

---

## ✅ ISSUE-006 — Homepage CMS-Driven

### Objectivo
Tornar todo o conteúdo da homepage gerível pela Marina através do Payload CMS.

### Trabalho realizado
**Passo 1:** Criado Global `homepage` no Payload com grupos:
  - `hero` (imagem, título, subtítulo, botões)
  - `realFlowers` (título, subtítulo)
  - `story` (título, texto, imagem)
  - `international` (título, subtítulo)
  - `instagram` (título, handle, texto)
  - `cta` (título, subtítulo, botão)
  - `footer` (descrição, email, telefone, URLs sociais)

**Passo 2:** Frontend da homepage ligado ao Global
**Passo 3:** Componentes reutilizáveis: Hero, Section, RealFlowers, CategoriesSection, CollectionsSection, StorySection, MarinaPicks, InternationalPresence, InstagramSection, CTAFinal, Footer

### Principais decisões técnicas
- CMS-driven: todos os textos e imagens vêm do Payload
- Fallbacks inline quando o CMS ainda não tem conteúdo
- Componentes puros (dados por props, sem lógica de dados)

### Estado
✅ Concluída

---

## ✅ ISSUE-007 — Componentes Reutilizáveis

### Objectivo
Criar uma biblioteca de componentes base para todo o frontend.

### Trabalho realizado
- `Button`: suporta variantes primary, secondary, accent; funciona como `<button>` ou `<Link>`
- `Section`: container com título, subtítulo, fundo, controlo de largura
- `FlowerCard`: cartão de produto no catálogo e relacionados
- `AddToCartButton`: botão de adicionar ao carrinho (client component)
- `CartProvider`: contexto do carrinho (React Context + localStorage)
- `Header`: navegação com selector de idioma
- `Footer`: redes sociais, contactos

### Principais decisões técnicas
- Server Components por defeito; apenas interactividade vai para Client Components
- Props tipadas para todos os componentes
- Tailwind exclusivamente (sem CSS separado)

### Estado
✅ Concluída

---

## ✅ ISSUE-008 — Catálogo & Checkout

### Objectivo
Implementar a navegação do catálogo e o fluxo de checkout.

### Trabalho realizado
- Página de catálogo (`/[locale]/catalog`) com listagem de produtos
- Filtros por categoria e colecção via URL params
- Página de carrinho (`/[locale]/cart`) com items, quantidades e total
- Página de checkout (`/[locale]/checkout`) com formulário de cliente e resumo
- Página de agradecimento (`/[locale]/thank-you`)
- API routes: `api/checkout` (criar encomenda), `api/coupon` (validar cupão)
- Criação da colecção `Orders` no Payload

### Principais decisões técnicas
- Carrinho gerido no cliente (localStorage) via CartProvider
- Encomenda só é persistida no Payload após submissão do checkout
- Dados do cliente recolhidos no checkout antes da persistência

### Estado
✅ Concluída

---

## ✅ ISSUE-009 — Product Experience (Passo 1)

### Objectivo
Criar a página de produto com experiência premium, inspirada em Apple, Tiffany & Co. e Bang & Olufsen.

### Trabalho realizado
- **ProductGallery:** galeria com imagem principal + miniaturas, preparada para múltiplas imagens
- **ProductInfo:** nome da criação, nome científico, categoria, colecções, tipo, preço, disponibilidade, botão AddToCart
- **ProductStory:** secção de história com conteúdo do CMS ou placeholder
- **ProductAttributes:** 4 blocos com ícones SVG (Flor Verdadeira, Feito à Mão em Portugal, Peça Única, Embalagem Premium)
- **RelatedProducts:** grelha de peças relacionadas da mesma categoria

### Alterações ao CMS
- Campo `images` (array de uploads) na colecção Flowers — para galeria
- Campo `story` (textarea) na colecção Flowers — para história da peça

### Design
- Muito espaço branco, tipografia leve, fotografia como elemento principal
- Tailwind exclusivamente (sem CSS separado)
- Todos os dados vindos do Payload

### Ficheiros criados
- `src/components/ProductGallery.tsx`
- `src/components/ProductInfo.tsx`
- `src/components/ProductStory.tsx`
- `src/components/ProductAttributes.tsx`
- `src/components/RelatedProducts.tsx`

### Estado
✅ Concluída

---

## ✅ ISSUE-009A — Robustez dos Componentes

### Objectivo
Garantir que o frontend não apresenta "undefined", "null" ou links quebrados quando faltam dados do CMS.

### Problemas encontrados e corrigidos

1. **Hero — fallback image (404)**
   - Causa: `backgroundImage: url('/hero-fallback.png')` em CSS inline era resolvido relativo ao path da página (`/pt/`)
   - Correção: substituído por `<img>` tag nativo

2. **Hero — link `/ptundefined`**
   - Causa: `href=/${locale}${primaryButtonLink}` com `primaryButtonLink = undefined`
   - Correção: função `safeLink()` com fallback para `/`

3. **CTAFinal — mesmo padrão de link inseguro**
   - Correção: `safeLink()` aplicada ao `buttonLink`

4. **FlowerCard — texto "undefined" no alt/name**
   - Correção: `displayName = flower.name || '—'`

5. **InstagramSection — URL `instagram.com/undefined`**
   - Correção: função `safeHandle()` com fallback

### Ficheiros alterados
- `src/components/Hero.tsx`
- `src/components/CTAFinal.tsx`
- `src/components/FlowerCard.tsx`
- `src/components/InstagramSection.tsx`
- `src/app/[locale]/page.tsx`

### Estado
✅ Concluída

---

## ✅ ISSUE-009B — Seed Data Premium

### Objectivo
Criar dados de demonstração completos para que a Eternal Flowers possa ser avaliada como uma marca real.

### Trabalho realizado
- **11 imagens placeholder** geradas com Pillow (gradientes com ícones florais)
- **5 categorias:** Colares, Brincos, Pulseiras, Porta-chaves, Molduras
- **6 colecções:** Casamentos, Dia da Mãe, Primavera, Memórias, Natureza, Edição Limitada
- **10 produtos** com nome, nome científico, história, descrição, preço e disponibilidade
- **Homepage completa** com Hero, Story, RealFlowers, Internacional, Instagram, CTA, Footer
- Script Python (`scripts/seed.py`) que popula via REST API do Payload

### Produtos criados
| # | Nome | Categoria | Preço |
|---|------|-----------|-------|
| 1 | Lágrima de Orvalho | Colares | 89€ |
| 2 | Sorriso da Manhã | Brincos | 54€ |
| 3 | Abraço Eterno | Pulseiras | 69€ |
| 4 | Memória Doce | Porta-chaves | 39€ |
| 5 | Janela para o Jardim | Molduras | 79€ |
| 6 | Beijo de Luz | Colares | 129€ |
| 7 | Dança das Pétalas | Brincos | 49€ |
| 8 | Raiz do Amor | Pulseiras | 74€ |
| 9 | Sussurro da Natureza | Porta-chaves | 34€ |
| 10 | Eternidade em Flor | Molduras | 99€ |

### Estado
✅ Concluída

---

# Issues em Progresso

🟡 Nenhuma neste momento.

---

# Próximas Issues

Ordenadas por prioridade estimada.

---

## 🟡 ISSUE-010 — Brand Intelligence & Design Knowledge Base

### Objectivo
Consolidar toda a informação visual e de design num sistema de conhecimento que alimente o desenvolvimento futuro. Inclui a análise aprofundada do Instagram da marca e a extracção de guidelines visuais para referência contínua.

### Trabalho previsto
- Análise detalhada das 171 publicações do Instagram `@eternal.flowers.pt`
- Extracção de paleta de cores, estilos fotográficos, tipos de produto mais frequentes
- Criação de um Design Knowledge Base documentado
- Definição de princípios de fotografia de produto (enquadramento, fundo, luz)
- Referências visuais para o desenvolvimento frontend
- Download de imagens de referência para o disco (flores, processos, produtos)

### Estado
🟡 Em progresso

---

## ⚪ Design Review

Revisão visual completa de todas as páginas implementadas:
- Homepage
- Página de Produto
- Catálogo
- Carrinho
- Checkout

### Critérios
- Consistência com a identidade da marca
- Qualidade do espaçamento e tipografia
- Experiência mobile
- Micro-interacções e animações
- Estado de carregamento e vazio

---

## ⚪ Refinamento Visual da Homepage

Ajustes finos na homepage com base no Design Review e nos dados reais do Instagram.

### Possíveis melhorias
- Hero com tipografia mais refinada ou animação subtil
- Secção de categorias com ícones personalizados
- Galeria de destaques do Instagram
- Micro-interacções nos CTAs
- Transições suaves entre secções

---

## ⚪ Refinamento Visual da Página de Produto

Ajustes finos na página de produto com base no feedback e nos dados reais.

### Possíveis melhorias
- Galeria com zoom ou lightbox
- Indicador de "apenas X unidades disponíveis"
- Secção de "perguntas frequentes" específicas do produto
- Botão de "falar com a Marina" (WhatsApp)

---

## ⚪ Catálogo — Filtros e Pesquisa

Melhorias na página de catálogo para facilitar a descoberta de produtos.

### Possíveis funcionalidades
- Filtros combinados (categoria + colecção + tipo + preço)
- Pesquisa por nome ou palavra-chave
- Ordenação (preço, data, nome)
- Vista em grelha / lista
- Paginação ou scroll infinito

---

## ⚪ Checkout — Pagamentos

Integração de gateway de pagamento para concluir o fluxo de compra.

### Possíveis abordagens
- Stripe (já incluído nas dependências)
- PayPal
- MB WAY (Portugal)

### Necessário
- Tabela de portes de envio
- Confirmação por email
- Página de estado da encomenda

---

## ⚪ Área da Marina (Admin)

Dashboard personalizado para a Marina gerir o negócio.

### Possíveis funcionalidades
- Gestão de encomendas (pendentes, pagas, enviadas)
- Notificações de novas encomendas
- Estatísticas de vendas
- Gestão de stock
- Contacto directo com clientes

---

# Anexo — Decisões Técnicas Importantes

### Arquitectura Payload
- CMS headless integrado no Next.js (App Router)
- Colecções: Flowers, Categories, Collections, Media, Coupons, Orders, Users
- Globals: homepage
- `push: true` em desenvolvimento para schema automático
- Migrações manuais para produção

### Homepage CMS-driven
- Todo o conteúdo da homepage vem do Global `homepage`
- Componentes recebem dados por props — a página faz as queries Payload
- Fallbacks inline para quando o CMS está vazio

### Componentes Reutilizáveis
- Button: polimórfico (button + link) com 3 variantes visuais
- Section: container standard com título, subtítulo, fundo configuráveis
- Server Components por defeito; Client Components só com `'use client'`

### Página de Produto
- Layout: galeria (esq) + info (dir) no desktop, empilhado no mobile
- Abaixo: história → atributos → relacionados
- Dados enriquecidos com `depth: 2` para resolver relações

### i18n
- 5 idiomas: português, inglês, espanhol, italiano, alemão
- Dicionários tipados em `dictionaries.ts`
- Idioma detectado por cookie `NEXT_LOCALE` + middleware

### Estilo
- Tailwind CSS exclusivamente (sem ficheiros CSS separados)
- Paleta: stone (neutro), rose/amber (acento)
- Design inspirado em Apple, Tiffany & Co., Bang & Olufsen