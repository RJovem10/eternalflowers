# Product Taxonomy — Eternal Flowers

> **Estrutura taxonómica dos produtos para o CMS (Payload) e website.**
> Define categorias, coleções, tipos de peça, espécies botânicas e metadados.
> Qualquer produto no sistema deve poder ser classificado segundo esta árvore.

---

## 1. Categorias de Navegação Primária

Estas categorias organizam a navegação principal do site e correspondem a **como a cliente pensa na compra:**

| Categoria | Slug | Descrição |
|---|---|---|
| Brincos | `/brincos` | Brincos de todos os tipos (argola, gancho, cravo) |
| Anéis | `/aneis` | Anéis ajustáveis ou de tamanho fixo |
| Pingentes | `/pingentes` | Pingentes para colar, medalhas |
| Colares | `/colares` | Colares completos com corrente |
| Pulseiras | `/pulseiras` | Pulseiras botânicas |
| Conjuntos | `/conjuntos` | Sets coordenados (ex: colar + brincos + pulseira) |
| **Decoração** | `/decoracao` | **NOVO** — Redomas de vidro com orquídeas eternizadas, bases de cortiça |

---

## 2. Coleções

As coleções são **agrupamentos temáticos** que cruzam categorias. Uma peça pode pertencer a uma ou mais coleções.

### 2.1 Coleções por Ocasião

| Coleção | Slug | Exemplo de peça |
|---|---|---|
| Dia da Mãe | `dia-da-mae` | Brincos Amor Perfeito 🌸 |
| Casamentos | `casamentos` | Pingente de bouquet de noiva |
| Namorados / Dia dos Namorados | `namorados` | Conjunto Blue Orchid 💙 |
| Aniversário | `aniversario` | Pingente personalizado |
| Presente para mim | `para-mim` | Auto-presente, todas as peças |

### 2.2 Coleções Botânicas

| Coleção | Slug | Flor principal |
|---|---|---|
| Blue Orchid | `blue-orchid` | Orquídea Vanda azul |
| Coleção Brincos | `colecao-brincos` | Tons lilás/violeta |
| Cambria 'Africana' | `cambria-africana` | Orquídea Cambria coral |
| Sobrália | `sobralia` | Sobrália rosea |
| Amor Perfeito | `amor-perfeito` | Viola tricolor |
| Orquídeas Raras | `orquideas-raras` | Paphiopedilum, Hoffmannseggella |
| Ao Vento | `ao-vento` | Coleção de movimento e leveza |

### 2.3 Coleções por Estilo

| Coleção | Slug | Carácter |
|---|---|---|
| Joias Únicas | `joias-unicas` | Peças irrepetíveis (1 flor = 1 peça) |
| Coleção Personalizada | `personalizada` | Cliente escolhe a flor e o tipo de peça |
| Edição Limitada | `edicao-limitada` | Peças sazonais, apenas enquanto a flor dura |

---

## 3. Tipos de Peça (Product Types)

### 3.1 Estrutura Técnica

Cada produto tem um `productType` que determina o template de exibição e os campos de variante:

```typescript
type ProductType = 'brincos' | 'aneis' | 'pingentes' | 'colares' | 'pulseiras' | 'conjuntos'
```

### 3.2 Variantes por Tipo

**Brincos:**
- Argola (aro metálico com flor encapsulada)
- Gancho (pendente, flor suspensa)
- Cravo (botão, flor sobre base)

**Anéis:**
- Ajustável (tamanho único)
- Tamanho fixo (numeração portuguesa: 10–22)

**Pingentes:**
- Medalha (redondo, oval)
- Lágrima
- Geométrico (hexágono, losango)

**Conjuntos:**
- Par (brincos + colar)
- Trio (colar + brincos + pulseira)
- Completo (colar + brincos + pulseira + anel)

**Decoração (NOVO):**
- Redoma de Vidro (orquídea eternizada sob redoma de vidro)
- Base de Cortiça (assenta a redoma, cortiça natural portuguesa)
- Orquídea em redoma (ex: Paphiopedilum Pinocchio em redoma)
- Peça decorativa botânica

### 3.3 Materiais de Base

| Material | Aplicação |
|---|---|
| Folheado a Ouro | Argolas, ganchos, bases de anéis, correntes |
| Folheado a Ródio | Argolas, ganchos, bases de anéis (tom prateado) |
| Metal prateado | Alternativa mais acessível |
| Cortiça natural | Base para peças decorativas (redomas) |
| Vidro | Redoma protetora para peças decorativas |

---

## 4. Espécies Botânicas (Flora)

### 4.1 Catálogo de Espécies Identificadas

| Nome Comum | Nome Científico | Slug | Cores Típicas |
|---|---|---|---|
| Sobrália | *Sobralia* spp. | sobralia | Rosa, magenta |
| Vanda | *Vanda* spp. | vanda | Azul, roxa |
| Laelia | *Laelia* spp. | laelia | Laranja, amarela |
| Paphiopedilum | *Paphiopedilum* 'Pinocchio' | paphiopedilum | Verde, marrom |
| Cattleya | *Cattleya* spp. | cattleya | Variada |
| Cambria | *Cambria* 'Africana' | cambria | Coral, terracota |
| Dendrobium | *Dendrobium* spp. | dendrobium | Amarelo, branco |
| Hoffmannseggella | *Hoffmannseggella* spp. | hoffmannseggella | Amarelo vivo |
| Curcuma | *Curcuma* spp. | curcuma | Amarelo, laranja |
| Amor Perfeito | *Viola tricolor* | amor-perfeito | Roxo, amarelo, branco |
| Orquídea Mini Mark | *Orchid* mini mark | mini-mark | Rosa com labelo marcado |

### 4.2 Campos de Metadados Botânicos

Cada produto pode armazenar:

| Campo | Exemplo | Obrigatório? |
|---|---|---|
| `nomeCientifico` | "Vanda coerulea" | Sim |
| `nomeComum` | "Orquídea Vanda Azul" | Sim |
| `corPredominante` | "#4A6FA5" | Sim |
| `origem` | "Orquidário da Dona Lúcia, Braga" | Opcional |
| `dataColheita` | "2026-01-15" | Opcional |
| `rara` | true | Opcional |
| `ephemeral` | true | Opcional (se 1 flor = 1 peça) |

---

## 5. Metadados de Produto

### 5.1 Campos Essenciais

```typescript
interface Product {
  // Sistema
  id: string
  title: string           // Nome comercial (ex: "Conjunto Blue Orchid")
  slug: string
  productType: ProductType
  categories: Category[]   // Brincos, Anéis, etc.
  collections: Collection[] // Blue Orchid, Dia da Mãe, etc.

  // Botânica
  species: Species         // Espécie botânica
  flowerColor: string      // Cor dominante da flor
  isRare: boolean
  isEphemeral: boolean     // Apenas 1 peça existe

  // Conteúdo
  shortDescription: string  // 1 frase (máx 120 chars)
  description: string       // 2–3 parágrafos (storytelling)
  story: string             // Opcional: história específica desta peça

  // Media
  images: Image[]
  video: string | null

  // Venda
  price: number
  compareAtPrice: number | null  // Preço original (se em promoção)
  stock: number             // 0 = esgotado, -1 = sob encomenda
  isPersonalizable: boolean
  productionTime: string    // "5–7 dias úteis"

  // SEO
  metaTitle: string
  metaDescription: string
}
```

### 5.2 Badges e Flags

| Badge | Condição | Display |
|---|---|---|
| `Edição Limitada` | `isRare === true` | Badge dourado |
| `Peça Única` | `isEphemeral === true` | Badge lavanda |
| `Sob Encomenda` | `stock === -1` | Badge verde-sálvia |
| `Personalizável` | `isPersonalizable === true` | Ícone de lápis + texto |
| `Esgotado` | `stock === 0` | Badge preto/cinza |

---

## 6. Hierarquia de Navegação

```
Home
├── Brincos
│   ├── Argola
│   ├── Gancho
│   └── Cravo
├── Anéis
│   ├── Ajustáveis
│   └── Tamanho Fixo
├── Pingentes
├── Colares
├── Pulseiras
├── Conjuntos
├── Coleções
│   ├── Blue Orchid
│   ├── Dia da Mãe
│   ├── Casamentos
│   ├── Orquídeas Raras
│   ├── Joias Únicas
│   └── Todas as coleções
├── O Processo
│   ├── Colheita
│   ├── Desidratação
│   ├── Criação
│   └── Cuidados
├── Sobre a Marina
└── Contacto / WhatsApp
```

---

## 7. Tags e Filtros

### Filtros de Navegação (por categoria)

- **Por flor:** Orquídea, Sobrália, Vanda, Amor Perfeito, etc.
- **Por cor:** Azul, Rosa, Roxo, Amarelo, Branco, Coral
- **Por ocasião:** Dia da Mãe, Casamento, Namorados
- **Por preço:** Até €30, €30–€60, €60–€100, €100+
- **Por disponibilidade:** Disponível, Sob encomenda, Esgotado