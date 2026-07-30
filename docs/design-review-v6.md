# Design Review V6 — The Founder Story

> **Documento de direção criativa: a nova página "Conhecer a Marina".**
> Data: Julho 2026 · Projeto: Eternal Flowers
> ISSUE-015 — The Founder Story

---

## Narrativa da Página

A página "Conhecer a Marina" é uma experiência editorial em 10 secções que apresenta a fundadora da Eternal Flowers — Marina — como engenheira agronómica, naturopata e artesã.

**Estrutura narrativa (ordem linear):**

| # | Secção | Formato | Imagem |
|---|--------|---------|--------|
| 1 | Hero editorial | Split 50/50 texto + fotografia | `marina-hero-orquidea-rosa.jpeg` |
| 2 | Percurso entre ciência e cuidado | Grid 2 colunas (texto + imagem) | `marina-terapeuta-bata-branca.jpeg` |
| 3 | Formação e mudança para naturopatia e osteopatia | Texto centrado (sem imagem) | — |
| 4 | Criação da Mar&Natur | Texto centrado (sem imagem) | — |
| 5 | Origem da Eternal Flowers | Grid 2 colunas (imagem + texto) | `marina-artesa-orquideas.jpeg` |
| 6 | Aprendizagem e processo artesanal | Grid 2 colunas (texto + imagem) | `marina-processo-tesoura-orquidea.jpeg` |
| — | Ritmo visual (opcional) | Banda larga editorial | `marina-detalhe-ferramentas.jpeg` |
| 7 | Exposições em Portugal e Espanha | Texto centrado (sem imagem) | — |
| 8 | A pessoa por detrás de cada peça | Grid 2 colunas (imagem + texto) | `marina-retrato-natureza.jpeg` |
| 9 | Citação final | Fundo escuro, blockquote | — |
| 10 | CTA "Descobrir as peças" | Texto centrado + botão | — |

### Padrão de alternância visual

A página alterna entre:
- **Fundo branco** (`bg-white`) e **fundo creme** (`bg-brand-cream`)
- **Grid 2 colunas** (texto + imagem ou imagem + texto) e **texto centrado** (para pausas narrativas)
- A alternância das imagens entre lado esquerdo e direito evita monotonia visual

---

## Função Narrativa de Cada Fotografia

### 1. `marina-hero-orquidea-rosa.jpeg`
**Função:** Apresentar a Marina como fundadora e estabelecer a ligação à marca.
**Razão:** O retrato próximo com orquídea rosa ao peito e tranças cria uma identidade visual forte e memorável. A orquídea liga visualmente ao produto da marca.
**Uso:** Hero full-height com split editorial 50/50. Preserva rosto, tranças e orquídea.
**object-position:** `50% 30%` (desktop e mobile) — centra o rosto no terço superior.

### 2. `marina-terapeuta-bata-branca.jpeg`
**Função:** Representar o percurso profissional na terapia e naturopatia.
**Razão:** Fotografia limpa, profissional, intemporal. A bata branca comunica credibilidade na área da saúde.
**Uso:** Imagem secundária na secção 2. Não compete com o Hero.
**object-position:** `50% 30%` (desktop e mobile) — centra o rosto profissional.

### 3. `marina-artesa-orquideas.jpeg`
**Função:** Mostrar a Marina em contexto real de trabalho com as orquídeas.
**Razão:** A mão com tesoura, o tabuleiro e as flores transmitem o processo artesanal de forma autêntica.
**Uso:** Na secção 5, ao lado da história de como a Eternal Flowers nasceu.
**object-position:** `60% 50%` (desktop), `50% 50%` (mobile) — preserva o rosto em perfil e a mão com a tesoura.

### 4. `marina-processo-tesoura-orquidea.jpeg`
**Função:** Imagem editorial de detalhe, transmitindo precisão e delicadeza.
**Razão:** Close extremo da mão e tesoura a cortar a orquídea mostra a minúcia do trabalho manual.
**Uso:** Na secção 6, sobre aprendizagem e aperfeiçoamento artesanal.
**object-position:** `50% 40%` (desktop), `50% 50%` (mobile) — prioriza a ação de corte.

### 5. `marina-retrato-natureza.jpeg`
**Função:** Apresentar a Marina de forma humana, serena e próxima.
**Razão:** Retrato ao ar livre transmite a ligação à natureza de forma descontraída e autêntica.
**Uso:** Na secção 8, "A pessoa por detrás de cada peça" — encerramento pessoal.
**object-position:** `50% 35%` (desktop), `50% 25%` (mobile) — centra o rosto sereno.
**Nota:** Resolução mais baixa (768×1024 — 0.8 MP). Suficiente para o formato, mas não para fullscreen.

### 6. `marina-detalhe-ferramentas.jpeg` (opcional — USADA)
**Função:** Criar ritmo visual entre blocos, reforçar o detalhe do processo.
**Razão pela qual foi usada:** Imagem distinta da imagem 4 (que mostra mão em ação). Esta mostra as ferramentas em repouso sobre a bandeja de bambu — complementa a narrativa sem repetir.
**Uso:** Banda larga editorial entre as secções 6 e 7. Funciona como pausa visual.
**object-position:** `50% 55%` (desktop), `50% 50%` (mobile) — centra as tesouras na bandeja.

---

## Decisões de Composição Visual

### Cores
- Fundo alternado: branco (`#FFFFFF`) / creme (`#F5F0E8`)
- Fundo escuro da citação: `#2C2C2C` (brand-charcoal)
- Dourado (`#D4A853`) usado apenas como acento (linhas, badges, botão CTA)
- Texto: `#2C2C2C` com opacidade 60% para leveza

### Tipografia
- Títulos (h1, h2): Cormorant Garamond (font-display), weight 300 (light)
- Corpo: Inter (font-body), weight 300 (light)
- Tracking generoso em uppercase nas labels das secções

### Espaçamento
- Secções: `py-20 lg:py-28` (80px / 112px vertical)
- Padding lateral: `px-6 lg:px-8` no container `max-w-content` (1280px)
- Grid 2 colunas com `gap-12 lg:gap-20`

### Hierarquia de headings
- h1: Hero — `Conhecer a Marina` (único h1 na página)
- h2: Cada secção tem o seu h2
- Não há h3 nem h4 — a página é propositadamente plana na hierarquia

---

## Diferenças Desktop/Mobile

| Secção | Desktop | Mobile |
|--------|---------|--------|
| Hero | Split 50/50 horizontal | Stack vertical (texto → imagem) |
| Secções grid | 2 colunas lado a lado | Stack vertical |
| Secções texto | Largura `max-w-prose` (~65ch), padding lateral | Largura total com `px-6` |
| Imagem de ritmo | `aspect-[3/1]` | `aspect-[16/9]` |
| Citação | `text-[2rem]` | `text-2xl` |

---

## Limitações das Imagens Atuais

1. **`marina-retrato-natureza.jpeg` tem baixa resolução** (768×1024). Recomenda-se substituição futura por versão de maior resolução com enquadramento semelhante.
2. **Profundidade de cor:** Todas as imagens são JPEG standard. Para uma marca premium, sessão fotográfica profissional com RAW e correção de cor faria diferença significativa.
3. **Iluminação inconsistente:** As fotografias foram tiradas em condições diferentes (luz natural, artificial, atelier, exterior). Uma sessão profissional unificaria o estilo.
4. **`marina-hero-orquidea-rosa.jpeg`** tem fundo de interior (possivelmente shopping/aeroporto) com bokeh. Idealmente seria no atelier com luz natural.

---

## Traduções

- **5 idiomas implementados:** pt, en, es, it, de
- **Nota:** As traduções foram feitas com IA, preservando significado e tom elegante.
- **⚠️ Necessitam de revisão humana antes da produção.**
- **Não verificadas por falante nativo de es, it, de.**

---

## Fotografias Futuras Que Poderiam Melhorar a Página

1. **Retrato profissional no atelier** — Marina sentada à mesa de trabalho, com orquídeas, luz natural (substituiria ou complementaria a imagem do Hero)
2. **Fotografia do atelier em ambiente alargado** — para a secção sobre Braga e o espaço de trabalho
3. **Sessão de processo em passo-a-passo** — 3-4 imagens do processo completo para uma futura página "O Processo"
4. **Fotografia de equipamento/ferramentas em estilo editorial** — de maior resolução e com styling cuidado

---

## Atualização Editorial (Jul 2026)

O conteúdo biográfico foi revisto e atualizado para incluir factos confirmados:

- **Infância em São Paulo** — nascida em São Paulo, Brasil, filha de pais portugueses, veio para Portugal aos 4 anos
- **Romãzeira** — aos ~4 anos, uma romãzeira era a sua melhor amiga, revelando uma ligação precoce à natureza
- **Engenheira Agrónoma** — formação académica explícita, exerceu como engenheira
- **Quiropraxia Oriental e Medicina Chinesa** — substituiu osteopatia, com métodos não invasivos
- **Mar&Natur** — clínica em Vila de Prado, Braga, ~16 anos de experiência, formações em PT e estrangeiro
- **Tailândia** — viagem à Tailândia, visita a um orquidário, origem da paixão por orquídeas
- **Eternal Flowers** — experimentação em resina epóxi, cursos, aperfeiçoamento técnico
- **Exposições** — Estepona, Córdoba, Lisboa (Jardim Zoológico), Coimbra e outros locais
- **Personalidade** — amiga, divertida, prestável, dedicada, exigente com a qualidade

### Referências removidas
- Avós (todas as referências em 5 idiomas)
- Osteopatia e osteopata (10 referências em 5 idiomas)
- "Feira de orquídeas" como origem da paixão
- Detalhes não confirmados (descrições, localizações, diálogos, sentimentos)

### Tom narrativo
- Terceira pessoa (exceto citação direta)
- Factual, sem alegações médicas absolutas
- Sem invenções biográficas

---

## Métricas

| Indicador | Valor |
|-----------|-------|
| Secções totais | 10 (9 obrigatórias + 1 opcional) |
| Fotografias usadas | 6 de 6 (incluindo a opcional) |
| Fotografia opcional | USADA — acrescenta valor real, distinta da imagem 4 |
| Idiomas | 5 (pt, en, es, it, de) |
| Imagens não usadas | Nenhuma |
| Build | ✅ 0 erros |
| Consola browser | ✅ 0 erros |
| 404/403 | ✅ 0 |
| Hydration errors | ✅ 0 |

---

*Documento criado para registar as decisões criativas da ISSUE-015.*