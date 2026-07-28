# Visual Language — Eternal Flowers

> **Guia de identidade visual para designers e developers. Define a paleta, tipografia, texturas, iconografia e atmosfera visual da marca.**

---

## 1. Paleta de Cores Oficial

### 1.1 Cores Primárias

| Nome | Token | Hex | Aplicação |
|---|---|---|---|
| **Off-white / Creme** | `--ef-cream` | `#F5F0E8` | Fundo de página, secções de storytelling, backgrounds de produto |
| **Branco** | `--ef-white` | `#FFFFFF` | Fundo de produto, fichas de produto, cartões |
| **Preto Suave** | `--ef-charcoal` | `#2C2C2C` | Texto principal, headings, nav |
| **Dourado** | `--ef-gold` | `#D4A853` | CTAs, badges, ícones, detalhes, hover states |

### 1.2 Cores Secundárias

| Nome | Token | Hex | Aplicação |
|---|---|---|---|
| **Verde-sálvia** | `--ef-sage` | `#A8B5A0` | Badges, tags de categoria, detalhes botânicos, estado "em stock" |
| **Rosa Pêssego** | `--ef-blush` | `#E8B4B8` | Destaques suaves, hover de links, Glow de anúncios |
| **Lavanda** | `--ef-lavender` | `#C9B1D0` | Detalhes de coleções especiais, badges de edição limitada |
| **Castanho Madeira** | `--ef-wood` | `#8B7355` | Elementos de suporte (linhas, separadores, subtítulo) |
| **Verde Musgo** | `--ef-moss` | `#6B7D5A` | Texto de sucesso, confirmações, elementos de "natureza" |

### 1.3 Cores de Acento (para coleções específicas)

| Coleção | Cor | Hex |
|---|---|---|
| **Blue Orchid** | Azul profundo | `#4A6FA5` |
| **Coleção Brincos (lilás/violeta)** | Violeta | `#7B5EA7` |
| **Cambria 'Africana'** | Coral/terracota | `#C97B6B` |
| **Dia da Mãe** | Rosa suave | `#F0A0A0` |

### 1.4 Gradiente da Marca

O gradiente do logótipo (roxo → laranja/ouro) pode ser usado como acento em:
- Bordas de cards de coleção especial
- Backgrounds de hero sections
- Elementos decorativos subtis (nunca em texto)

`linear-gradient(135deg, #C9B1D0, #D4A853, #E8B4B8)`

---

## 2. Tipografia

### 2.1 Títulos e Display

**Família:** Cormorant Garamond

Família serifada elegante, com carácter clássico mas não datado. Ideal para títulos, hero, naming de coleções.

| Uso | Weight | Size (exemplo) | Tracking |
|---|---|---|---|
| Hero (H1) | Light 300 | 3.5rem–4.5rem | -0.02em |
| Título de secção (H2) | Regular 400 | 2rem–2.5rem | -0.01em |
| Nome de coleção | SemiBold 600 | 1.5rem | 0.02em |
| Nome de produto | Light 300 | 1.25rem | 0.01em |

### 2.2 Corpo e UI

**Família:** Inter (ou sistema sans-serif)

Limpa, legível, moderna. Contraste com a serifada dos títulos.

| Uso | Weight | Size |
|---|---|---|
| Corpo de texto | Regular 400 | 1rem |
| Preço | Medium 500 | 1.1rem |
| Navegação | Medium 500 | 0.9rem |
| Etiquetas / Badges | SemiBold 600 | 0.75rem |
| Notas / Legenda | Light 300 | 0.85rem |
| Depoimentos | Italic 400 | 1rem |

### 2.3 Hierarquia Visual

```
Cormorant Garamond Light — "Joias que Eternizam a Natureza" (H1)
Cormorant Garamond Regular — "Coleção Blue Orchid" (H2)
Inter Regular — "Cada peça é feita à mão, com flores reais cultivadas e cuidadas..." (body)
Inter Medium — "€45,00" (preço)
Inter SemiBold — "ESGOTADO" / "EDIÇÃO LIMITADA" (badge)
```

---

## 3. Texturas e Elementos Gráficos

### 3.1 Texturas de Fundo

- **Papel texturado** — subtil, como papel de aguarela ou kraft (aplicado em hero sections, modais, cartões de agradecimento)
- **Grão fino** — overlay de textura de papel para fotografia de produto e backgrounds
- **Aquarela lavada** — manchas suaves de cor nos cantos de secções especiais

### 3.2 Elementos Decorativos

- **Folhas de louro / ramos** — ilustrações vetoriais minimalistas, traço fino, para separadores e molduras
- **Linhas finas douradas** — separadores entre secções (1px, cor dourada)
- **Círculos concêntricos** — inspirados no logótipo, como elemento decorativo subtil
- **Brilho / Glitter** — efeito de partículas brilhantes muito subtil (apenas em hero principal ou páginas de coleção; não usar em UI funcional)

### 3.3 Iconografia

- **Ícones de linha fina** (stroke 1.5px), nunca filled
- **Dourados ou pretos**, nunca coloridos (a menos que a coleção específica o justifique)
- **Inspiração botânica** quando possível: flor para "novidades", folha para "sustentabilidade", gota para "cuidados"

---

## 4. Espaço e Composição

### 4.1 Princípios de Layout

- **Respirar** — whitespace generoso em todos os elementos. Uma página nunca deve parecer cheia.
- **A fotografia manda** — imagens de produto devem ocupar pelo menos 50% da largura do ecrã na visualização de produto.
- **Simetria com assimetria controlada** — layouts maioritariamente simétricos, com assimetrias pontuais para criar dinamismo (ex: texto à esquerda, imagem à direita, mas com a imagem a sair ligeiramente da grelha).

### 4.2 Margens e Grelha

- **Grelha de 12 colunas** (web)
- **Margem lateral:** 2rem (mobile) → 4rem (desktop)
- **Max-width de conteúdo:** 1280px
- **Gutter:** 1.5rem

### 4.3 Cartões e Cards

- **Border-radius:** 0px (cantos retos transmitem elegância e artesanato) ou 4px máximo
- **Sombra:** Sombras muito subtis (box-shadow: 0 1px 3px rgba(0,0,0,0.06))
- **Hover:** Elevação ligeira + transição suave (0.3s ease)

---

## 5. Atmosfera Visual

A Eternal Flowers deve evocar, visualmente:

| Sensação | Como se consegue |
|---|---|
| **Leveza** | Fundos claros, tipografia leve, espaços amplos, imagens com profundidade de campo |
| **Eternidade** | Dourados subtis, brilhos suaves, gradientes que lembram o nascer do sol |
| **Natureza** | Verde-sálvia, texturas orgânicas, fotografia com luz natural, madeira |
| **Artesanato** | Textura de papel, tipografia serifada, fotografias de bastidores, imperfeições controladas |
| **Delicadeza** | Cores pastel, traços finos, lettering manual (quando usado), flores como elemento central |
| **Luxo Acessível** | Dourado como acento, não como cor dominante; materiais nobres mas não ostensivos |

---

## 6. Logótipo

### 6.1 Versões

| Versão | Uso |
|---|---|
| **Principal** (círculo, orquídea central, texto "ETERNAL FLOWERS / RESIN ART & JEWELS / by MAR&NATUR") | Header, footer, favicon |
| **Simplificado** (apenas círculo com orquídea, sem texto) | Ícone de app, watermark, avatar |
| **Vertical** (logótipo completo empilhado) | Página "Sobre", cartões de agradecimento |
| **Monocromático** (preto ou branco) | Condições de baixa cor, cartões de visita |

### 6.2 Regras de Uso

- **Não redesenhar** — o logótipo existente define a identidade
- **Não distorcer** — manter proporções originais
- **Não recolocar** — a orquídea central é o elemento definidor
- **Área de segurança:** 1x o tamanho do logótipo em todas as direções
- **Fundo mínimo:** nunca colocar sobre fundo que reduza a legibilidade do texto