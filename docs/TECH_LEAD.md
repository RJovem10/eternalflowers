# Tech Lead Rules

Estas regras nunca devem ser quebradas.

## Desenvolvimento

- Um sprint de cada vez.
- Uma funcionalidade de cada vez.
- Um prompt de cada vez.
- Nunca implementar duas funcionalidades em simultâneo.

---

## Modelos

DeepSeek Flash

Utilizar para:

- auditorias
- documentação
- docker
- configuração
- refactoring simples

GPT-5.6 Sol

Utilizar para:

- Stripe
- autenticação
- arquitetura complexa
- bugs difíceis
- funcionalidades críticas

---

## Arquitetura

As Route Handlers não devem conter lógica de negócio.

Quando a complexidade justificar:

Route

↓

Service

↓

Payload

↓

Database

---

## Qualidade

Nunca alterar:

- bibliotecas
- versões
- arquitetura

sem motivo técnico.

Não criar código "porque poderá vir a ser útil".

---

## Revisão

Toda a implementação deve indicar:

- ficheiros alterados
- motivo
- impacto
- como testar

Nenhuma tarefa é considerada concluída sem revisão técnica.
