# Fase E6D — Traduções dos Produtos Flowers

> Data: 2 de Agosto de 2026
> Branch: `feature/issue-016-payload-localization`
> Head base: `99144f5`

## Resumo

Criação dos manifestos de tradução para os 10 produtos Flowers da Eternal Flowers nos idiomas en, es, it, de. As traduções estão em ficheiros JSON versionados, **não importadas** para a base de dados.

## Ficheiros Criados

| Ficheiro | Conteúdo |
|----------|----------|
| `translations/flowers.json` | Manifesto combinado — 10 produtos, 30 campos, 4 locales |
| `translations/flowers-en.json` | Apenas EN |
| `translations/flowers-es.json` | Apenas ES |
| `translations/flowers-it.json` | Apenas IT |
| `translations/flowers-de.json` | Apenas DE |

## 10 Produtos

| ID | Name PT | Name EN | Name ES | Name IT | Name DE | Tipo |
|----|---------|---------|---------|---------|---------|------|
| 1 | Lágrima de Orvalho | Morning Dew | Rocío de la Mañana | Rugiada Mattutina | Morgentau | Colar |
| 2 | Sorriso da Manhã | Morning Smile | Sonrisa de la Mañana | Sorriso del Mattino | Morgenlächeln | Brincos |
| 3 | Abraço Eterno | Eternal Embrace | Abrazo Eterno | Abbraccio Eterno | Ewige Umarmung | Pulseira |
| 4 | Memória Doce | Sweet Memory | Dulce Recuerdo | Dolce Ricordo | Süße Erinnerung | Porta-chaves |
| 5 | Janela para o Jardim | Window to the Garden | Ventana al Jardín | Finestra sul Giardino | Fenster zum Garten | Moldura |
| 6 | Beijo de Luz | Kiss of Light | Besito de Luz | Bacio di Luce | Kuss des Lichts | Colar LE |
| 7 | Dança das Pétalas | Dance of Petals | Danza de los Pétalos | Danza dei Petali | Tanz der Blütenblätter | Brincos |
| 8 | Raiz do Amor | Root of Love | Raíz del Amor | Radice dell'Amore | Wurzel der Liebe | Pulseira |
| 9 | Sussurro da Natureza | Whisper of Nature | Susurro de la Naturaleza | Sussurro della Natura | Flüstern der Natur | Porta-chaves |
| 10 | Eternidade em Flor | Eternity in Bloom | Eternidad en Flor | Eternità in Fiore | Ewigkeit in Blüte | Moldura |

## Campos Traduzidos

Cada produto tem 3 campos traduzidos:

| Campo | Tipo | Required | Descrição |
|-------|------|----------|-----------|
| `name` | Option B suffix | ✅ | Nome comercial do produto |
| `description` | Option B suffix | ❌ | Descrição curta para cards/catálogo |
| `story` | Localized nativo | ❌ | História editorial do produto |

**Campos NÃO traduzidos:** scientificName (latim), creationName (português), slug (partilhado), preço, imagem, categorias, coleções.

## Contagens

| Métrica | Valor |
|---------|-------|
| Produtos | 10 |
| Campos por produto | 3 |
| Fontes PT | 30 (10 names + 10 descs + 10 stories) |
| Por locale | 30 traduções |
| EN | 30 |
| ES | 30 |
| IT | 30 |
| DE | 30 |
| **Total** | **120** |

## Source Hashes

Todos os 30 sourceHash foram calculados sobre os valores PT reais da `loja.sqlite` e verificados.

## Política de Tradução

| Tipo | Regra |
|------|-------|
| Names | Tradução poética natural, não literal. Preservar imagem emocional. Nomes curtos. |
| Descriptions | Factuais, tom delicado. Sem claims novos. |
| Stories | Integrais, sem omissão de parágrafos. Tom editorial/emocional. |
| scientificName | Mantido em latim |
| creationName | Mantido em português |

## Revisão GPT-5.6 Sol

A revisor linguística foi solicitada para os 120 campos.

## Validação Estrutural

| Verificação | Resultado |
|-------------|-----------|
| 10 slugs | ✅ |
| 30 campos | ✅ |
| 30 sourceHash | ✅ |
| 4 locales | ✅ |
| 120 traduções | ✅ |
| Sem valores vazios | ✅ |
| Sem E5_* / TODO | ✅ |
| UTF-8 válido | ✅ |

## Próximos passos

- As traduções aguardam E6E (importador)
- Marcadas como `ai-reviewed`, não `human-reviewed`
- Necessário validar visualmente os nomes em cards, catálogo e detalhe de produto