# Fase E6B — Manifesto e Traduções do Homepage

> Data: 2 de Agosto de 2026
> Branch: `feature/issue-016-payload-localization`
> Head base: `630e97f`
> Head final: aguardar amend

## Resumo

Criação do glossário terminológico e das traduções do Homepage Global para en, es, it, de. As traduções estão armazenadas em ficheiros JSON versionados, **não importadas** para a base de dados.

## Ficheiros Criados

| Ficheiro | Conteúdo |
|----------|----------|
| `translations/glossary.json` | 12 termos com equivalências nos 5 idiomas |
| `translations/homepage.json` | Manifesto completo — 16 campos, 4 locales, 64 traduções |
| `translations/homepage-en.json` | Manifesto apenas EN |
| `translations/homepage-es.json` | Manifesto apenas ES |
| `translations/homepage-it.json` | Manifesto apenas IT |
| `translations/homepage-de.json` | Manifesto apenas DE |
| `docs/payload-localization-e6a-content-audit-2026-08.md` | Auditoria corrigida |
| `docs/payload-localization-e6b-homepage-translations-2026-08.md` | Este documento |

## 16 Campos Traduzidos

### 10 REQUIRED (presentes nos 4 locales)

| Campo | PT chars | EN chars | ES chars | IT chars | DE chars | PT hash |
|-------|----------|----------|----------|----------|----------|---------|
| hero.heroTitle | 43 | 44 | 41 | 43 | 52 | `2092ab898366` |
| hero.heroSubtitle | 195 | 196 | 204 | 200 | 224 | `deb6a8d6a1a6` |
| hero.primaryButtonText | 18 | 22 | 21 | 18 | 17 | `5a5d8265b170` |
| realFlowers.title | 27 | 26 | 26 | 18 | 22 | `0e3d2413ce6e` |
| story.title | 20 | 25 | 25 | 24 | 28 | `2a6e1d064cc5` |
| story.text | 677 | 659 | 687 | 709 | 794 | `8ccd8d8322c8` |
| international.title | 22 | 22 | 23 | 23 | 22 | `05b209fd28a0` |
| instagram.title | 21 | 22 | 21 | 20 | 23 | `5ce94668afa2` |
| cta.title | 34 | 31 | 34 | 35 | 37 | `d150e7c0cf23` |
| cta.buttonText | 13 | 10 | 11 | 10 | 15 | `6b4692af5712` |

### 6 Opcionais

| Campo | PT chars | EN chars | ES chars | IT chars | DE chars |
|-------|----------|----------|----------|----------|----------|
| hero.secondaryButtonText | 10 | 10 | 9 | 13 | 13 |
| realFlowers.subtitle | 76 | 74 | 84 | 78 | 89 |
| international.subtitle | 74 | 72 | 69 | 72 | 76 |
| instagram.text | 98 | 112 | 99 | 115 | 120 |
| cta.subtitle | 112 | 124 | 110 | 119 | 143 |
| footer.brandDescription | 78 | 76 | 79 | 75 | 83 |

## Glossário

12 termos centrais: flor verdadeira, flor preservada, joia botânica, feito à mão, artesanal, peça única, edição limitada, resina, eternizar, memória, natural/natureza, personalizado.

Não traduzidos: Eternal Flowers, Mar&Natur, Marina, eternal.flowers.pt, Braga.

## Tom por Locale

| Locale | Tratamento | Decisão E6B |
|--------|------------|-------------|
| EN | informal (you/your) | Manter. Inglês britânico (jewellery). |
| ES | informal (tú/recuerdo) | Manter. Espanhol europeu. |
| IT | informal (tu) | Manter. Italiano natural comercial. |
| DE | informal (du/kontaktiere) | Manter coerente com dicionário existente. |

## Revisão GPT-5.6 Sol

**Veredito:** APPROVED — Classificação A

**Problemas críticos:** 0
**Problemas médios:** 0
**Melhorias menores:** 2

1. **EN heroTitle:** "Make a Moment Eternal" → "Make a Moment Last Forever" — sugestão menor de naturalidade (aceite)
2. **DE story.text:** comprimento 794ch vs PT 677ch (1,17×) — aceitável para alemão, abaixo do limite de 1,7×

## Validação Estrutural

| Verificação | Resultado |
|-------------|-----------|
| JSON válido | ✅ |
| 16 field paths | ✅ |
| 4 target locales | ✅ |
| 10 required preenchidos (todos os 4 locales) | ✅ |
| cta.subtitle com source (não vazio) | ✅ Traduções presentes |
| SourceHash verificado | ✅ |
| Sem marcadores E5_* | ✅ |
| Sem TODOs | ✅ |
| Sem URLs ou contactos nos campos errados | ✅ |
| UTF-8 válido | ✅ |
| Glossário presente | ✅ |

## Estado das Traduções

| Locale | Traduções | Status |
|--------|-----------|--------|
| EN | 16/16 | ai-reviewed |
| ES | 16/16 | ai-reviewed |
| IT | 16/16 | ai-reviewed |
| DE | 16/16 | ai-reviewed |
| **Total** | **64/64** | **ai-reviewed** |

## Limitações e Próximos Passos

- Traduções NÃO importadas — aguardam E6E (importador)
- Marcadas como `ai-reviewed`, não `human-reviewed`
- Categorias, Collections e Flowers deixados para E6C e E6D
- Importador deve fazer dry-run obrigatório antes de escrita
- Backup da base antes da primeira importação
- Necessário validar visualmente em produção antes de considerar production-ready