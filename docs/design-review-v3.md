# Design Review V3 — Art Direction & Visual Storytelling

> **Documento de direção criativa para a homepage Eternal Flowers.**
> Data: Julho 2026 · Projeto: Eternal Flowers
> Papel: Diretor Criativo

---

## 1. Referências de Luxo — O que inspirou cada decisão

Cada marca de referência influenciou um aspeto específico do design. Não se trata de copiar — trata-se de compreender o _princípio_ que torna cada uma delas icónica e aplicá-lo à identidade da Eternal Flowers.

| Referência | Princípio Inspirador | Como se aplica à Eternal Flowers |
|---|---|---|
| **Apple** | Espaço branco como linguagem de luxo. Cada elemento tem uma razão de existir. O que não está presente é tão importante como o que está. | Whitespace generoso em todas as secções. Remoção de elementos redundantes. A página respira. |
| **Tiffany & Co.** | Elegância através da tipografia e do tom. A cor não precisa de gritar para ser reconhecida. O dourado é acento, não dominante. | Cormorant Garamond nos títulos. Dourado apenas em detalhes (linhas, hover states, badges). Fundo creme (brand-cream) como base. |
| **Bang & Olufsen** | A fotografia como protagonista absoluta. A composição é pensada ao pixel. O produto é mostrado, não descrito. | Hero redesenhado: a imagem ocupa todo o ecrã, o texto é mínimo e elegantemente posicionado. A venda acontece pela imagem, não pelas palavras. |
| **Eternal Flowers** | Emoção, autenticidade, processo artesanal. A marca é humana, não industrial. Cada detalhe comunica cuidado. | Nomes científicos nas flores. Texto em tom pessoal. Secções com história. O processo é parte da experiência. |

---

## 2. Alterações Realizadas

### 2.1 Hero — O Momento de Impacto

**Antes (V2):**
- `min-h-[85vh]` — herói alto mas não espetacular
- Gradiente lateral: `from-brand-charcoal/85 via-brand-charcoal/50 to-transparent`
- Título: `text-4xl md:text-5xl lg:text-[4.5rem]`
- Linha dourada entre título e subtítulo
- Fallback: imagem com `opacity-60`

**Depois (V3):**
- `min-h-screen` — ocupa o ecrã inteiro, como um poster de cinema
- Gradiente vertical: `from-brand-charcoal/70 via-brand-charcoal/30 to-brand-charcoal/10` — sobreposição mais suave, a imagem respira mais
- Título: `text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem]` com `leading-[0.95]` — mais dramático
- **Badge de entrada** novo: "Joias Botânicas Artesanais" com bolinha dourada, estilo Tiffany & Co.
- **Scroll indicator** novo: "Scroll" com linha vertical descendente, inspirado em Bang & Olufsen — convida a explorar
- **Fallback**: gradiente sofisticado `from-brand-charcoal via-brand-charcoal to-[#3D2E2A]` em vez de imagem quebrada
- **Bottom fade**: removido (o scroll indicator substitui a função de sugerir continuidade)
- Conteúdo alinhado ao fundo em mobile (`pb-16 lg:pb-24`) e centro em desktop (`lg:items-center`)

**Referência Bang & Olufsen:** O hero é agora um ecrã completo onde a imagem é a atração principal. O texto não compete — contextualiza.

### 2.2 Section — Tipos de Secção

**Novo:** Sistema de `size` para secções:
- `size="default"` — `py-16 lg:py-24`
- `size="large"` — `py-20 lg:py-28` (StorySection, CTA)
- `size="compact"` — `py-12 lg:py-16` (RealFlowers, Instagram)

**Isto cria ritmo.** Secções grandes dão profundidade à narrativa. Secções compactas mantêm o ritmo sem cansar. A alternância de tamanhos evita a monotonia.

### 2.3 RealFlowers — Círculos Botânicos

**Antes (V2):** Cards quadrados com cantos decorativos dourados no hover.

**Depois (V3):** **Círculos** — evocam uma flor vista de cima, uma lente macro, uma pétala. Cada círculo tem:
- `w-24 h-24 lg:w-28 lg:h-28` — tamanho generoso
- `rounded-full` — círculo perfeito
- Gradiente de cor específico da flor
- `ring-1 ring-brand-wood/10` — anel subtil que se torna dourado no hover
- Emoji representativo da cor
- Nome científico em itálico

**Referência Apple:** Cada círculo é isolado com espaçamento generoso. A grelha `gap-x-8 gap-y-12` dá a cada flor o seu próprio palco.

### 2.4 StorySection — O Coração Narrativo

**Antes (V2):** Layout split simples, linha dourada genérica.

**Depois (V3):**
- **Label "O Processo"** — pequeno, uppercase, dourado — posiciona a história
- Imagem `aspect-[3/4] lg:aspect-[4/5]` — formato editorial de revista
- **Espaçamento entre parágrafos** — `space-y-4` com `leading-[1.8]` — leitura confortável e generosa
- Linha dourada entre label e corpo

**Referência Tiffany & Co.:** A tipografia do título em Cormorant Garamond Light, o dourado como acento, o espaçamento generoso — tudo evoca uma página de revista de luxo.

### 2.5 MarinaPicks — Molduras Douradas

**Novo:** Cada produto ganha uma moldura dourada no hover (`border-brand-gold/20`) - um toque subtil que só aparece quando o utilizador interage. O CTA "Ver catálogo completo" ganhou uma linha horizontal decorativa que se torna dourada no hover.

### 2.6 CTAFinal — Textura de Fundo

**Novo:** Padrão de pontos sutis em `radial-gradient` com opacidade 3% — cria textura sem distrair. Label "Eternize uma Memória" em dourado antes do título.

### 2.7 Footer — Consistência Total

Alinhado visualmente com o resto da página: tracking consistente, hovers com transições `duration-300`, setas douradas nos links sociais.

---

## 3. Ritmo Visual da Homepage (A Estrutura Narrativa)

A página segue um arco de 7 atos, cada um com um ritmo diferente:

```
ATO 1 ─── Hero ───────────────────── Full screen · imagem · mínimo texto
ATO 2 ─── RealFlowers ────────────── Compacto · círculos · 6 colunas
ATO 3 ─── CategoriesSection ──────── Default · grelha · funcional
ATO 4 ─── CollectionsSection ─────── Default · imagens · editorial
ATO 5 ─── StorySection ───────────── Grande · split · narrativa
ATO 5.5 ─ MarinaPicks ────────────── Default · grelha · produto
ATO 6 ─── InternationalPresence ──── Default · credibilidade
ATO 6.5 ─ InstagramSection ───────── Compacto · comunidade
ATO 7 ─── CTAFinal ───────────────── Grande · escuro · emocional
```

**Alternância de fundos:** branco → creme → branco → creme → branco → creme → branco → escuro
**Alternância de intensidade:** imagem → ícones → cards → imagens → texto → produto → ícones → texto → emoção

---

## 4. Micro-detalhes Refinados

| Aspeto | V2 | V3 |
|---|---|---|
| Transições | `transition-all duration-500` | `duration-300` (mais rápidas, mais responsivas) + `duration-700` (imagens, para sensação cinematográfica) |
| Hover categories | Mudança de cor | Mudança de cor + escala do ícone (`scale-110`) + borda dourada |
| Hover collections | Border genérico | Overlay `bg-brand-charcoal/5` subtil |
| Hover marina picks | Scale imagem | Scale imagem + **moldura dourada** `border-brand-gold/20` |
| Hover instagram | Link color | Círculo com `border-brand-gold/30` + opacidade do ícone |
| Hover footer | Cor do link | **Seta dourada** animada + cor do link |
| Separadores | W-16 h-0.5 bg-amber-300 | W-12 h-[1px] bg-brand-gold/[50-80] |
| Scroll indicator | Ausente | "Scroll" em uppercase + linha vertical descendente |
| Badge hero | Ausente | Badge "Joias Botânicas Artesanais" com bolinha dourada |

---

## 5. Tipografia — Estado Final

| Elemento | Fonte | Peso | Tamanho (desktop) | Letter-spacing | Line-height |
|---|---|---|---|---|---|
| H1 (Hero) | Cormorant Garamond | Light 300 | 5.5rem | -0.02em | 0.95 |
| H2 (Section) | Cormorant Garamond | Light 300 | 2.5rem ou 3rem | -0.01em | 1.1 |
| H3 (Card title) | Cormorant Garamond | Light 300 | 1rem–1.125rem | normal | 1.3 |
| Body | Inter | Light 300 | 1rem–1.125rem | normal | 1.8 |
| Preço | Inter | Medium 500 | 0.875rem | 0.02em | normal |
| Navegação | Inter | Medium 500 | 0.75rem | 0.15em | normal |
| Uppercase labels | Inter | Medium 500 | 0.625rem–0.6875rem | 0.2–0.3em | normal |
| Nome científico | Inter | Light 300 italic | 0.6875rem | normal | normal |

---

## 6. O que ainda pode evoluir (para próximas issues)

1. **Hero image real** — o elemento mais crítico. Quando a Marina fornecer uma fotografia macro de altíssima qualidade (de preferência uma orquídea em resina com luz natural difusa), o hero passará de "bom" a "extraordinário". A sugestão é uma foto vertical de uma peça segurada por mãos femininas, com profundidade de campo reduzida.

2. **RealFlowers com fotografias reais** — substituir os círculos com gradiente por fotografias macro reais de cada espécie.

3. **Transições de scroll** — animações de fade-in/up muito subtis ao fazer scroll (apenas se não comprometerem performance).

4. **Tipografia local** — alojar Cormorant Garamond e Inter localmente via next/font com download estático em vez de Google Fonts CDN.

5. **Feed Instagram real** — incorporar grid de posts reais em vez de link apenas.

---

## 7. Auto-Avaliação

| Critério | Pontuação | Observação |
|---|---|---|
| **Elegância** | 8/10 | A tipografia e o espaço estão certos, mas a hero image placeholder impede o salto para 10 |
| **Ritmo** | 9/10 | A alternância de fundos e tamanhos de secção cria uma leitura dinâmica |
| **Storytelling** | 9/10 | O arco narrativo em 7 atos está claro até no código |
| **Tipografia** | 9/10 | Cormorant Garamond + Inter é uma combinação vencedora |
| **Micro-detalhes** | 8/10 | Hovers e transições refinados, mas ainda sem animações de scroll |
| **Alinhamento com Instagram** | 8/10 | Paleta e tom alinhados; falta a fotografia real |
| **Sensação de marca (não template)** | 9/10 | A página já não parece um template — parece uma marca |

---

## 8. Conclusão

A homepage V3 está mais próxima do nível de uma marca de luxo artesanal. As referências Apple (espaço), Tiffany & Co. (elegância) e Bang & Olufsen (imagem) foram aplicadas respeitando a identidade única da Eternal Flowers.

O que separa esta homepage de uma página de portefólio de agência de branding é **a fotografia**. O design está pronto para receber imagens reais de altíssima qualidade — quando isso acontecer, a homepage estará ao nível de qualquer marca premium.

> "Não é um template. É uma marca."