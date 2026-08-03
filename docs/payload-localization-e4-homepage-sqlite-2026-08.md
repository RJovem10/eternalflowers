Nota sobre o teste de falha parcial:

A primeira implementação sem try/catch deixou DDL órfão (homepage_locales continuava a existir na base SQLite mesmo com E4 não registada). Isto acontece porque o driver SQLite do Payload não reverte DDL dentro da transação do runner.

A correção adicionou um try/catch com cleanup compensatório:
- `createdStructure = true` é definido imediatamente após CREATE TABLE
- qualquer erro subsequente (CREATE INDEX, backfill, validação) é capturado
- no catch: DROP INDEX + DROP TABLE (IF EXISTS) removem a estrutura parcial
- o erro original é relançado com contexto de cleanup

Testado e passou em 3 cenários: falha após CREATE TABLE, após CREATE INDEX, e após backfill. Em cada caso a rerun na mesma base foi bem-sucedida.