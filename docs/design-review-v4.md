# Design Review V4 — The Founder Hero

> **Documento de direção criativa: o novo Hero da Eternal Flowers centrado na fundadora.**
> Data: Julho 2026 · Projeto: Eternal Flowers
> Papel: Creative Director · Art Director

---

## 1. As Três Propostas

### Proposta A — Editorial Split (VENCEDORA)

**Composição:**
- Split 50/50: texto à esquerda, fotografia à direita
- Texto: headline emocional em duas linhas, subtítulo em três linhas, dois CTAs
- Fotografia: full-height, ocupando metade do ecrã
- Scroll indicator na base
- Assinatura "Eternal Flowers by Mar&Natur®" na base do texto

**Porque venceu:**
- A composição mais versátil — funciona com ou sem fotografia real
- O split 50/50 é o formato editorial mais reconhecido (Vogue, Architectural Digest)
- A fotografia da Marina à direita tem o protagonismo que merece
- O texto à esquerda respira com whitespace generoso
- Funciona em mobile (stack vertical) e desktop (split horizontal)

### Proposta B — Full-screen (REJEITADA)

**Composição:**
- Fotografia full-bleed a ocupar 100% do ecrã
- Texto minimalista sobreposto (apenas headline + CTA)
- Elementos com fundo semi-transparente

**Porque foi rejeitada:**
- Depende exclusivamente de uma fotografia de altíssima qualidade — sem ela, o hero parece vazio
- O texto sobreposto à imagem reduz a leitura e o impacto da foto
- A Marina merece um enquadramento que a mostre como artesã, não como modelo de stock
- Funciona para Bang & Olufsen (produto como objeto de desejo), não para uma marca artesanal (pessoa como centro da marca)

### Proposta C — Assimétrica (REJEITADA)

**Composição:**
- Fotografia descentrada, a ocupar 2/3 do ecrã
- Texto num canto, como numa campanha de moda
- Elementos visuais a "sair" da grelha

**Porque foi rejeitada:**
- A assimetria exige uma curadoria fotográfica diária — incompatível com um CMS
- Arriscado como primeira impressão permanente da marca
- Melhor para campanhas sazonais (temporárias) do que para a identidade fixa da homepage
- A Marina merece uma apresentação estável e confiante, não experimental

---

## 2. A Composição Vencedora em Detalhe

### Estrutura Visual

```
┌──────────────────────┬──────────────────────┐
│                      │                      │
│   badge localização  │                      │
│                      │                      │
│   HEADLINE           │                      │
│   EMOCIONAL          │   FOTOGRAFIA DA      │
│   2 LINHAS           │   MARINA             │
│                      │                      │
│   ── linha dourada   │   Full-height        │
│                      │                      │
│   subtítulo          │   [placeholder       │
│   (max 3 linhas)     │    para imagem       │
│                      │    real]             │
│   [CTA] [CTA]        │                      │
│                      │                      │
│   assinatura         │                      │
│                      │                      │
├──────────────────────┴──────────────────────┤
│                 scroll indicator             │
└──────────────────────────────────────────────┘
```

### Headline

```
Joias Botânicas
Feitas à Mão
```

**Porquê:** Emocional, direta, em duas linhas. Não vende "produtos" — vende o processo e a autenticidade. A quebra de linha em "Feitas à Mão" dá ênfase ao artesanal.

### Subtítulo

```
Cada peça é uma história que o tempo não apaga.
Flores verdadeiras, eternizadas em resina pela Marina,
em Braga.
```

**Porquê:** Três linhas. A primeira é a promessa. A segunda explica como. A terceira onde — e quem. A palavra "Marina" aparece no subtítulo: a marca é uma pessoa.

### CTAs

| Botão | Texto | Link | Estilo |
|---|---|---|---|
| Primário | Descobrir Coleções | `/catalog` | `bg-brand-gold` — dourado, CTA principal |
| Secundário | Conhecer a Marina | `/about` | `border-brand-gold/40` — ghost dourado |

**Porquê desta ordem:** O primário leva ao catálogo (conversão). O secundário leva à história da Marina (conexão). Juntos servem os dois tipos de visitante: quem quer comprar e quem quer conhecer.

### Assinatura Visual

Na base do texto:
```
ETERNAL FLOWERS —— by MAR&NATUR®
```

**Porquê:** A assinatura ancora a marca no final da secção de texto, como um colofão editorial. É subtil (25% opacidade) mas presente.

---

## 3. A Fotografia da Marina

### A Imagem que o Hero Espera

O placeholder desenhado (moldura com cantos dourados) foi criado para ser substituído por:

**Uma fotografia da Marina no atelier, com:**
- Iluminação natural difusa (luz de janela, sem flash)
- Ela a segurar uma peça ou a trabalhar numa orquídea
- Fundo: bancada de trabalho, frascos de sílica, orquídeas
- Roupa neutra (branco, creme, tons naturais)
- Mãos visíveis — as mãos da artesã são a assinatura do trabalho manual
- Expressão: concentrada mas serena — o momento de criação
- Formato: vertical (retrato 3:4 ou 9:16)
- Resolução: mínimo 1200×1600px (para ocupar metade do ecrã)

### Onde Encontrar Esta Foto

No Instagram @eternal.flowers.pt, nos destaques "Produção" e "Colheita" e nos Reels onde a Marina aparece a trabalhar. A foto ideal existe — precisa apenas de ser capturada com qualidade e colocada no hero.

### Impacto da Fotografia Real

Quando a fotografia real for adicionada:
- O hero passará de um design "bom" para uma experiência "transformadora"
- A Marina passará de um nome no texto a uma presença real
- A confiança na marca aumentará instantaneamente
- A homepage passará de "site de marca" a "portefólio de agência de branding"

---

## 4. Micro-detalhes Implementados

| Detalhe | Descrição |
|---|---|
| **Badge localização** | "Artesanato · Braga · Portugal" — ancora geograficamente a marca |
| **Linha dourada** | `w-12 h-[1px] bg-brand-gold/60` entre headline e subtítulo |
| **Cantos dourados** | Na moldura do placeholder: `w-16 h-16 border-t border-l border-brand-gold/20` — nos 4 cantos |
| **Gradiente da imagem** | Três camadas: base creme + `radial-gradient` dourado + `radial-gradient` lavanda — evoca as cores das orquídeas |
| **Scroll indicator** | "Scroll" em uppercase 9px + linha vertical descendente de 40px |
| **Assinatura base** | "Eternal Flowers — by Mar&Natur®" com linha decorativa |
| **Mobile adaptativo** | Em mobile (< lg): texto em cima, imagem em baixo (stack vertical) com fade gradient na transição |

---

## 5. Relação com a Identidade da Marca

| Dimensão | Como o Hero Reflete |
|---|---|
| **Personalidade** | Acolhedora, sábia, artesanal — a Marina é apresentada como pessoa real, não como personagem |
| **Posicionamento** | Luxo acessível — a composição editorial (split 50/50) é o formato de luxo mais clássico |
| **Proposta de valor** | "Joias Botânicas Feitas à Mão" — o processo é o produto |
| **Diferenciação** | A Marina é o rosto. Nenhuma concorrente anónima mostra a artesã como centro |
| **Tom** | "pela Marina, em Braga" — pessoal, local, autêntico |
| **Fotografia** | A imagem está desenhada para ser o elemento dominante. Quando chegar a foto real, o hero estará completo |

---

## 6. Auto-Avaliação

Após 5 segundos a olhar para o Hero, um visitante percebe:

| Pergunta | Resposta |
|---|---|
| Existe uma pessoa real por detrás da marca? | ✅ Sim — a composição é desenhada à volta de um retrato |
| As peças são feitas manualmente? | ✅ "Feitas à Mão" está na headline. O badge diz "Artesanato" |
| Trata-se de uma marca premium? | ✅ Split editorial + dourado + tipografia serifada + espaçamento generoso |
| Não é uma loja online genérica? | ✅ Absolutamente — não há grid de produtos, carrosséis, banners |

---

## 7. Melhorias Futuras

1. **A fotografia real da Marina** — a melhoria mais importante de todo o projeto. Sem ela, o hero está incompleto.
2. **Página /about** — o botão "Conhecer a Marina" precisa de uma página de destino à altura
3. **Header adaptado** — o header fixed pode ser mais transparente neste hero (a fotografia deve ser prioridade)
4. **Animação subtil de entrada** — fade-in do texto, loading da imagem com transição suave
5. **Variação sazonal** — trocar a fotografia por estação (Marina com orquídeas diferentes)

---

> "Este Hero não vende produtos. Apresenta a pessoa que os cria. E é isso que transforma um website numa marca."