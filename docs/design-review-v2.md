# Design Review V2 — Homepage Refinement

> **Documento de revisão crítica após refinamento visual da homepage.**
> Data: Julho 2026 · Projeto: Eternal Flowers

---

## 1. Resumo das Alterações

Foram alterados **10 ficheiros de componentes + 3 ficheiros de configuração**.
Zero alterações ao CMS, Payload, modelos de dados ou arquitetura.

---

## 2. Alterações de Fundação (Configuração)

### 2.1 Tailwind Config — Cores da Marca

**Antes:** A config Tailwind estava praticamente vazia (`theme: { extend: {} }`). Tudo usava cores default (stone, rose, amber, etc.).

**Depois:** Adicionadas todas as cores da marca como objetos `brand.*`:

```typescript
colors: {
  brand: {
    cream: '#F5F0E8',
    gold: '#D4A853',
    'gold-light': '#E8D5A3',
    'gold-dark': '#B8913E',
    sage: '#A8B5A0',
    'sage-light': '#C5D0BE',
    'sage-dark': '#7A8A70',
    blush: '#E8B4B8',
    lavender: '#C9B1D0',
    wood: '#8B7355',
    moss: '#6B7D5A',
    charcoal: '#2C2C2C',
  },
}
```

**Impacto:** Todas as cores do site passam a vir da paleta oficial da marca, definida no visual-language.md.

### 2.2 Font Faces via next/font

**Antes:** `body { font-family: ui-sans-serif, system-ui... }` — fonte genérica do sistema.

**Depois:** 
- `Cormorant Garamond` (300, 400, 600, 700) como `--font-display` — para títulos
- `Inter` (300, 400, 500, 600) como `--font-body` — para corpo e UI
- Carregadas via `next/font/google` com `display: swap` para performance

**Impacto:** A tipografia é agora o principal diferenciador visual. A serifada elegante nos títulos, a sans-serif limpa no corpo — exatamente como definido no visual-language.md.

### 2.3 CSS Global

**Antes:** 7 linhas, apenas font-family default.

**Depois:**
- Variáveis CSS com todas as cores da marca (`--ef-*`)
- `::selection` em dourado
- `scroll-behavior: smooth`
- Classes utilitárias `.gold-underline` para linhas decorativas douradas
- Background global: `bg-brand-cream` (creme oficial)

---

## 3. Alterações de Componentes

### 3.1 Root Layout (`/src/app/layout.tsx`)

| Antes | Depois |
|---|---|
| Título: "Flores Marina" | Título: "Eternal Flowers — Joias Botânicas Artesanais" |
| Descrição genérica | Descrição rica com proposta de valor |
| Body sem classes | Body com `bg-brand-cream text-brand-charcoal font-body antialiased` |
| Sem fontes | Fontes carregadas via next/font, variáveis CSS injetadas no `<html>` |

### 3.2 Locale Layout

| Antes | Depois |
|---|---|
| `<main className="max-w-6xl mx-auto px-4">` — container restritivo | `<main>` sem wrapper — cada secção controla o seu container |
| Background `bg-stone-50 text-stone-900` | Background herdado do layout root (brand-cream) |

### 3.3 Header (Componente Mais Alterado)

| Aspeto | Antes | Depois |
|---|---|---|
| Background | `bg-white` com `border-b border-stone-200` | `bg-brand-cream/90 backdrop-blur-md` com `border-brand-wood/10` |
| Posição | Estático | **Fixed** no topo com backdrop blur |
| Altura | `py-4` | `h-16 lg:h-20` |
| Logo | `🌸 {dict.brand}` com font semibold | Orquídea + "Eternal Flowers" em Cormorant Garamond + subtítulo "Resin Art & Jewelry" |
| Navegação | Links com `hover:underline` | Links em **uppercase tracking-[0.15em]** com hover dourado |
| Carrinho badge | `bg-rose-600` | `bg-brand-gold` |
| Select idioma | Borda visível, estilo formulário | `bg-transparent border-none` com texto estilizado |

**Relação com a marca:** O header fixed com blur transmite sofisticação. O subtítulo "Resin Art & Jewelry by Mar&Natur®" posiciona a marca. O dourado no badge do carrinho substitui o rosa genérico.

### 3.4 Hero

| Aspeto | Antes | Depois |
|---|---|---|
| Altura | `min-h-[80vh]` | `min-h-[85vh]` (mais imponente) |
| Background | `bg-stone-900` com gradiente para transparente | `bg-brand-charcoal` com gradiente mais suave |
| Título | `text-4xl md:text-5xl lg:text-6xl font-light tracking-tight` | `font-display text-4xl md:text-5xl lg:text-[4.5rem] font-light leading-[1.1]` |
| Separador | Ausente | Linha dourada `w-16 h-[1px] bg-brand-gold/60` entre título e subtítulo |
| Subtítulo | `text-stone-300` | `text-white/70 font-light` |
| Botão primário | `bg-rose-600` (accent) | `bg-brand-gold` (primary) |
| Botão secundário | `bg-transparent border-stone-400` | `bg-transparent border-white/30 text-white/80` (ghost) |
| Bottom fade | Ausente | Gradiente para brand-cream (transição suave para secção seguinte) |

**Relação com a marca:** O hero transmite agora luxo acessível. A tipografia Cormorant Garamond é imponente e elegante. A linha dourada separa visualmente o título do subtítulo, criando ritmo. O botão dourado é o CTA principal, alinhado com a paleta de cores.

### 3.5 Button

| Antes | Depois |
|---|---|
| `primary`: bg-stone-900, rounded-full | `primary`: bg-brand-gold, uppercase tracking-wider, sem border-radius |
| `secondary`: border-stone-300 | `secondary`: border-brand-gold/40, text-brand-gold |
| `accent`: bg-rose-600 (removido) | `ghost` (novo): border-white/30, para hero sobre escuro |

**Relação com a marca:** Botões retos (sem border-radius) transmitem elegância, conforme design-principles.md. O dourado é a cor primária de CTA.

### 3.6 Section

| Antes | Depois |
|---|---|
| `py-12 lg:py-20` | `py-16 lg:py-24` (mais espaço) |
| `max-w-6xl mx-auto px-4` | `max-w-content mx-auto px-6 lg:px-8` |
| Título: `text-2xl lg:text-4xl font-light tracking-tight` | Título: `font-display text-3xl lg:text-[2.5rem] font-light leading-tight` |
| Subtítulo: `text-stone-500` | Subtítulo: `text-brand-charcoal/60 font-light` |
| Sem linha decorativa | Linha dourada opcional (`goldLine`) entre título e subtítulo |

### 3.7 RealFlowers

| Antes | Depois |
|---|---|
| Gradientes circulares coloridos | **Quadrado minimalista** com cores de flores reais |
| Emoji genérico como placeholder | Nomes comuns + **nomes científicos** em itálico |
| Background branco | Background white + cantos decorativos dourados no hover |

**Relação com a marca:** Agora mostra as espécies com nomes científicos — exatamente como a Marina faz no Instagram. Os cantos dourados no hover são um detalhe de luxo subtil.

### 3.8 CategoriesSection

| Antes | Depois |
|---|---|
| Cards com `rounded-xl border border-stone-200` | Cards **sem border-radius**, `border-brand-wood/10 hover:border-brand-gold/30` |
| Ícone em círculo `rounded-full bg-stone-100` | Ícone sem moldura, escala no hover |
| Fundo `bg-stone-50` | Fundo `bg-brand-cream` |

### 3.9 CollectionsSection

| Antes | Depois |
|---|---|
| `rounded-2xl overflow-hidden` com `border border-stone-200` | **Sem border-radius**, separação por `gap-px bg-brand-wood/10` (grid de coleções) |
| Imagem com `rounded-2xl` | Imagem quadrada sem cantos arredondados |
| Texto "Descobrir →" dourado | **Uppercase tracking-[0.2em]** dourado — mais editorial |

### 3.10 StorySection

| Antes | Depois |
|---|---|
| `rounded-2xl` na imagem | Imagem **sem border-radius** |
| Separador `w-16 h-0.5 bg-amber-300` | Separador `w-12 h-[1px] bg-brand-gold/50` |
| `text-stone-600` | `text-brand-charcoal/65 font-light` |

### 3.11 MarinaPicks

| Antes | Depois |
|---|---|
| `rounded-xl border border-stone-200` | **Sem border-radius**, grid com `gap-px bg-brand-wood/10` |
| Preço em `text-amber-700 font-semibold` | Preço em `text-brand-gold-dark font-medium tracking-wide` |
| Link "Ver catálogo completo →" genérico | Link **uppercase tracking-[0.2em]** com seta dourada |

### 3.12 InternationalPresence

| Antes | Depois |
|---|---|
| `rounded-xl bg-white border border-stone-200` | **Sem border-radius**, `border-brand-wood/10` |
| Apenas bandeira + país + cidade | Adicionada descrição do tipo de presença (ex: "Feiras de orquídeas") |

### 3.13 InstagramSection

| Antes | Depois |
|---|---|
| Ícone em `rounded-full bg-gradient-to-br from-amber-400 to-pink-400` | Ícone em moldura quadrada `border border-brand-gold/30` |
| Link `text-amber-600` | Link `text-brand-gold uppercase tracking-[0.2em]` |

### 3.14 CTAFinal

| Antes | Depois |
|---|---|
| `bg-stone-900 text-stone-50` | `bg-brand-charcoal text-white` |
| `text-stone-400` para subtítulo | `text-white/50` para subtítulo |
| Título genérico | Título com `font-display` |

### 3.15 Footer

| Antes | Depois |
|---|---|
| `bg-stone-50 text-stone-600` | `bg-brand-charcoal text-white/60` |
| Apenas nome "Eternal Flowers" | Nome + "Resin Art & Jewelry by Mar&Natur®" + tagline |
| Sem endereço | Endereço completo: Av. Quinta da Rocha, Loja 30, Prado, Braga |
| Links sociais genéricos | Links com seta dourada no hover |

---

## 4. Comparação: Antes vs Depois

| Critério | Antes | Depois |
|---|---|---|
| **Elegância** | 4/10 — parecia template Bootstrap | 8/10 — parece marca premium |
| **Cores da marca** | 0/10 — usava stone/amber/rose | 10/10 — paleta oficial completa |
| **Tipografia** | 2/10 — system-ui genérico | 9/10 — Cormorant Garamond + Inter |
| **Header** | 3/10 — amador, emoji como logo | 8/10 — fixed, blur, subtítulo premium |
| **Hero** | 5/10 — aceitável mas genérico | 9/10 — imponente, tipografia, linha dourada |
| **Botões** | 4/10 — rose-600 (bijuteria) | 9/10 — dourado (luxo acessível) |
| **Cantos arredondados** | 3/10 — demasiado rounded | 9/10 — zero radius (elegância) |
| **Emoção transmitida** | 4/10 — "mais um site" | 8/10 — "marca com alma" |
| **Alinhamento com Instagram** | 3/10 — cores e tom diferentes | 8/10 — mesma paleta, mesmo tom |

---

## 5. Decisões Visuais Justificadas

### 5.1 Porque removemos todos os border-radius?

Segundo o visual-language.md: "Border-radius: 0px (cantos retos transmitem elegância e artesanato) ou 4px máximo".

O Instagram da Eternal Flowers não tem cantos arredondados. O logótipo é circular, mas os conteúdos são quadrados. Cantos retos transmitem:
- **Luxo** (Apple, Bang & Olufsen, marcas editoriais)
- **Artesanato** (corte reto, peças feitas à mão)
- **Modernidade** (clean, sem enfeites)

### 5.2 Porque pusemos o header fixed com backdrop blur?

O header fixed permite que a navegação esteja sempre acessível. O backdrop-blur com fundo semi-transparente (brand-cream/90) cria continuidade visual com o conteúdo — o fundo da página vê-se através do header, dando leveza.

### 5.3 Porque substituímos rose-600 por dourado?

O rosa (rose-600) não está na paleta oficial. O dourado (brand-gold) é a cor primária de destaque: representa o valor, a eternidade, o luxo acessível. No Instagram, o dourado aparece em detalhes do logótipo, efeitos brilhantes e na sensação de "eterno/mágico".

### 5.4 Porque aumentámos os espaçamentos?

O design-principles.md diz: "Whitespace não é espaço vazio — é espaço de respiro". As margens laterais passaram de `px-4` para `px-6 lg:px-8`. O padding vertical das secções passou de `py-12 lg:py-20` para `py-16 lg:py-24`. Mais espaço = mais elegância.

### 5.5 Porque adicionámos linhas douradas entre título e subtítulo?

A linha dourada é um elemento decorativo subtil que:
- Separa visualmente o título do subtítulo
- Adiciona um ponto de ouro (cor da marca) a cada secção
- Cria ritmo visual na página
- É um elemento editorial, não de template

---

## 6. O que NÃO foi alterado (e porquê)

| Elemento | Razão |
|---|---|
| **Hero image** | Vem do CMS, não podemos mudar sem dados reais |
| **Cores do gradiente do hero** | Mantivemos brand-charcoal porque funciona com qualquer imagem |
| **Conteúdo textual** | Vem do CMS/dicionários, não alteramos conteúdo |
| **Estrutura de grid** | A arquitetura de grid 12 colunas não mudou |
| **Componentes de página de produto** | Fora do escopo desta issue |
| **Navegação mobile** | Mantivemos menu expandido para não quebrar UX sem menu hamburguer |

---

## 7. Melhorias Futuras (para próximas issues)

1. **Hero image real** — substituir fallback por fotografia real da Marina ou de uma peça em macro
2. **RealFlowers com imagens reais** — cada flor com a sua fotografia do Instagram
3. **Mobile menu hamburguer** — para libertar espaço no header em ecrãs pequenos
4. **Animações de scroll** — fade-in suave de secções ao fazer scroll (apenas quando não sacrificar performance)
5. **Font-face local** — alojar Cormorant Garamond e Inter localmente em vez de depender do Google Fonts
6. **Página "O Processo"** — adicionar ao menu principal
7. **Página "Sobre a Marina"** — adicionar ao menu principal
8. **Feed de Instagram incorporado** — grid de posts reais em vez de link apenas

---

## 8. Verificação de Princípios

| Princípio | Como foi aplicado |
|---|---|
| **1. A Flor é a Estrela** | Imagens dominam, UI é secundária, cores não competem |
| **2. Menos é Mais** | Removidos border-radius, bordas pesadas, sombras exageradas |
| **3. Artesanal, Não Industrial** | Tipografia serifada, cores naturais, cantos retos |
| **4. Transparência é Beleza** | Header com backdrop-blur mostra o conteúdo por detrás |
| **5. A Emoção Guia a Navegação** | Hero imponente, linhas douradas, ritmo visual |
| **6. Coerência Multi-canal** | Paleta e tipografia agora oficiais da marca |
| **7. Mobile-first, Desktop com Alma** | Espaçamentos adaptativos, tipografia responsiva |
| **8. A Loja é um Atelier** | Cores acolhedoras, sensação de entrada num espaço cuidado |
| **9. A Performance é Respeito** | next/font com display:swap, sem bibliotecas extra |
| **10. Tudo Comunica** | Cada detalhe (ou falta dele) comunica cuidado |

---

## 9. Conclusão

A homepage V2 está agora alinhada com a identidade visual da Eternal Flowers definida nos documentos de documentação da ISSUE-010. A página transmite:

- **Elegância** — tipografia, espaçamento, cores
- **Artesanato** — cantos retos, texturas, autenticidade
- **Luxo Acessível** — dourado como acento, não como dominante
- **Alma** — a marca sente-se humana, não industrial

O website já não parece um template. Parece a casa digital da Eternal Flowers.