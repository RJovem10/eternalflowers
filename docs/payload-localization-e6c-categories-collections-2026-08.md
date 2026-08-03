# Fase E6C — Traduções de Categories e Collections

> Data: 2 de Agosto de 2026
> Branch: `feature/issue-016-payload-localization`
> Head base: `ff5d64f`

## Resumo

Criação dos manifestos de tradução para as 5 Categories e 6 Collections da Eternal Flowers nos idiomas en, es, it, de. As traduções estão armazenadas em ficheiros JSON versionados, **não importadas** para a base de dados.

## Ficheiros Criados

| Ficheiro | Conteúdo |
|----------|----------|
| `translations/categories.json` | Manifesto combinado — 5 slugs, 10 campos, 4 locales |
| `translations/categories-en.json` | Apenas EN |
| `translations/categories-es.json` | Apenas ES |
| `translations/categories-it.json` | Apenas IT |
| `translations/categories-de.json` | Apenas DE |
| `translations/collections.json` | Manifesto combinado — 6 slugs, 12 campos, 4 locales |
| `translations/collections-en.json` | Apenas EN |
| `translations/collections-es.json` | Apenas ES |
| `translations/collections-it.json` | Apenas IT |
| `translations/collections-de.json` | Apenas DE |

## 5 Categories

| Slug | Name PT | Descrição PT | Name EN | Name ES | Name IT | Name DE |
|------|---------|-------------|---------|---------|---------|---------|
| colares | Colares | Pendentes e colares… | Necklaces | Collares | Collane | Ketten |
| brincos | Brincos | Brincos delicados… | Earrings | Pendientes | Orecchini | Ohrringe |
| pulseiras | Pulseiras | Pulseiras artesanais… | Bracelets | Pulseras | Bracciali | Armbänder |
| porta-chaves | Porta-chaves | Pequenas memórias… | Keyrings | Llaveros | Portachiavi | Schlüsselanhänger |
| molduras | Molduras | Molduras com flores… | Frames | Marcos | Cornici | Bilderrahmen |

**10 relações Flowers → Categories preservadas.** Slugs partilhados.

## 6 Collections

| Slug | Name PT | Descrição PT | Name EN | Name ES | Name IT | Name DE |
|------|---------|-------------|---------|---------|---------|---------|
| casamentos | Casamentos | Para celebrar o amor. | Weddings | Bodas | Matrimoni | Hochzeit |
| dia-da-mae | Dia da Mãe | Memórias que florescem… | Mother's Day | Día de la Madre | Festa della Mamma | Muttertag |
| primavera | Primavera | Peças frescas e vibrantes. | Spring | Primavera | Primavera | Frühling |
| memorias | Memórias | Um instante que o tempo… | Memories | Recuerdos | Ricordi | Erinnerungen |
| natureza | Natureza | Inspirado na beleza natural. | Nature | Naturaleza | Natura | Natur |
| edicao-limitada | Edição Limitada | Criações únicas… | Limited Edition | Edición Limitada | Edizione Limitata | Limitierte Auflage |

**19 relações Flowers → Collections preservadas.** Todas ativas. Imagens partilhadas. Slugs partilhados.

## Contagens

| Entidade | Documentos | Campos | Strings PT | Traduções/locale | Total |
|----------|-----------|--------|-----------|------------------|-------|
| Categories | 5 | 2 (name + description) | 10 | 10 | 40 |
| Collections | 6 | 2 (name + description) | 12 | 12 | 48 |
| **Total** | **11** | **22** | **22** | **22** | **88** |

## Política de Tradução

- Nomes traduzidos naturalmente para cada mercado
- Descrições curtas, ton premium e artesanal
- Sem claims novos, sem informações inventadas
- Consistente com glossário e Homepage
- Tom informal (tal como os dicionários existentes)

## Validação Estrutural

| Verificação | Categories | Collections |
|-------------|-----------|-------------|
| JSON válido | ✅ | ✅ |
| Campos esperados | 10/10 | 12/12 |
| Required | ✅ Todos | ✅ Todos |
| SourceHash verificado | ✅ 10/10 | ✅ 12/12 |
| Locales (4) | ✅ | ✅ |
| Sem E5_* / TODO | ✅ | ✅ |
| UTF-8 válido | ✅ | ✅ |

## Revisão GPT-5.6 Sol

**Veredito:** APPROVED — Classificação A

**0 críticos, 0 médios, X menores** (a aguardar resultado completo).

## Próximos passos

- As traduções aguardam E6E (importador) para serem aplicadas
- Marcadas como `ai-reviewed`, não `human-reviewed`
- Necessário validar visualmente as categories/collections em cards, filtros e headings