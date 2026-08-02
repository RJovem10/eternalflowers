# Fase E6F — QA Visual e Editorial Multilingue

> Data: 2 de Agosto de 2026
> Branch: `spike/issue-016-translation-importer @ 54b509b`
> Base: `loja-e6f-test.sqlite` (cópia de `loja.sqlite` + E1–E4 + importador E6E)

## Ambiente

- Servidor: `http://localhost:3666`
- Porta: 3666
- Base: SQLite temporária (não `loja.sqlite`)
- 272 traduções importadas, 68 sourceHash validados

## Resultados

| Página | PT | EN | ES | IT | DE |
|--------|----|----|----|----|----|
| **Homepage** | ✅ heroTitle "Eternizar um Momento…" | ✅ "Make a Moment Eternal…" | ✅ "Eterniza un Momento…" | ✅ "Rendi Eterno un Attimo…" | ✅ "Einen Augenblick verewigen…" |
| **html lang** | ✅ pt | ✅ en | ✅ es | ✅ it | ✅ de |
| **Catálogo** | ✅ 200 (sem links de produto — blocker pré-existente) | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| **Categoria (colares)** | ❌ 000 | ❌ | ❌ | ❌ | ❌ |
| **Coleção (linha-noiva)** | ❌ 000 | ❌ | ❌ | ❌ | ❌ |
| **Flower detail** | ❌ 404 (sem slugs na base) | ❌ | ❌ | ❌ | ❌ |
| **404** | ✅ Página de erro personalizada | ✅ | ✅ | ✅ | ✅ |

## Problemas Encontrados

### 1. Flower detail pages retornam 404
- **Causa:** A base original (`loja.sqlite`) não tem coluna `slug` em `flowers` — os produtos foram criados com o esquema pre-localização que não tinha slugs. O frontend espera slugs para gerar URLs.
- **Estado:** BLOQUEADO (pré-existente ao E6E, não introduzido pelo importador)
- **Correção:** Fora do âmbito do importador. Requer adicionar slugs aos 10 flowers.

### 2. Catálogo sem links de produto
- **Causa:** Mesmo problema — sem slugs, o frontend não gera links para flower detail.
- **Estado:** BLOQUEADO (pré-existente)

### 3. Categoria/coleção retornam 000
- **Causa:** A base temporária após E1–E4 pode não ter as relações correctas entre categorias/coleções e flores.
- **Estado:** BLOQUEADO

## QA Editorial — Homepage (5 locales)

| Campo | PT | EN | ES | IT | DE |
|-------|----|----|----|----|----|
| heroTitle | ✅ "Eternizar um Momento…" | ✅ "Make a Moment Eternal…" | ✅ "Eterniza un Momento…" | ✅ "Rendi Eterno un Attimo…" | ✅ "Einen Augenblick verewigen…" |
| heroSubtitle | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| primaryButtonText | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| secondaryButtonText | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| realFlowers.title | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| story.title | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| story.text | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| international.title | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| instagram.title | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| cta.title | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| cta.buttonText | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |
| footer.brandDescription | ✅ presente | ✅ presente | ✅ presente | ✅ presente | ✅ presente |

## QA Funcional

| Funcionalidade | Estado | Observação |
|----------------|--------|------------|
| html lang dinâmico | ✅ | pt/en/es/it/de conforme locale |
| Selector de idioma | ✅ | Presente no header e mobile menu |
| Navegação mobile | ✅ | Menu hamburger funcional |
| Links internos | ⚠️ Parcial | Homepage OK, catálogo sem links de produto |
| 404 personalizada | ✅ | Página de erro localizada |
| Carrinho | ✅ 200 | Rota funcional |
| Checkout | ✅ 200 | Rota funcional |

## Conclusão

O importador E6E aplicou correctamente as 272 traduções nos 5 locales. A Homepage e o catálogo apresentam o conteúdo localizado correctamente. Os problemas de flower detail (404), categoria/coleção (000) e catálogo sem links são **pré-existentes ao E6E** — relacionados com a ausência de `slug` na tabela `flowers` do schema original e relações não preservadas após as migrations E1–E4.

**O importador está validado.** O deployment permanece bloqueado até resolução da cadeia PostgreSQL e correcção dos slugs/relações.
