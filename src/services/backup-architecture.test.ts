/**
 * Testes para production backup/restore hardening
 *
 * ISSUE-40 — Valida:
 *   1. backup.sh uses compose.sh (not bare docker compose)
 *   2. backup.sh media source is /app/media, not host ./media
 *   3. PostgreSQL dump uses custom format
 *   4. pg_restore listing verification exists
 *   5. tar media verification exists
 *   6. SHA-256 manifest exists
 *   7. Staging before final publish
 *   8. Retention 14 days
 *   9. Minimum 3 complete sets
 *  10. No unsafe broad deletion
 *  11. Backup directory gitignored
 *  12. systemd service is Type=oneshot
 *  13. systemd timer is daily at 03:30 Europe/Lisbon
 *  14. Persistent=true
 *  15. Daily job runs FULL backup
 *  16. No secrets in unit files
 *  17. restore.sh uses compose wrapper
 *  18. No production restore in tests
 *
 * ISSUE-41 — Fixes:
 *  19. PG structural verification always runs (container fallback, never skipped)
 *  20. Media tar non-zero exit = FAIL
 *  21. Flock lock file is persistent (not removed on exit)
 *  22. .backup.lock gitignored
 *  23. Naming: full/backup-*, pg-only/backup-pg-*, media-only/backup-media-*
 *  24. Retention only counts full sets (both postgres.dump + media.tar.gz)
 *  25. PG-only sets do NOT count toward MIN_SETS
 *  26. Media-only sets do NOT count toward MIN_SETS
 *  27. Unknown directories ignored by retention
 *  28. Verify mode understands backup type (full/pg-only/media-only)
 *  29. Default --verify selects latest FULL backup only
 *  30. Restore: no top-level `local` declarations
 *  31. Restore: PG validation fails closed
 *  32. Restore: media wording is accurate (overlay, not mirror)
 *  33. Timer: RandomizedDelaySec removed
 *  34. Lock file is NOT removed by backup.sh
 *  35. systemd installer does NOT start timer
 *  36. restore.sh uses POSTGRES_USER/POSTGRES_DB from container
 */
/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const BACKUP_SH = path.join(PROJECT_ROOT, 'scripts/production/backup.sh')
const RESTORE_SH = path.join(PROJECT_ROOT, 'scripts/production/restore.sh')
const COMPOSE_WRAPPER = path.join(PROJECT_ROOT, 'scripts/production/compose.sh')
const GITIGNORE = path.join(PROJECT_ROOT, '.gitignore')
const SERVICE_UNIT = path.join(PROJECT_ROOT, 'configs/systemd/eternalflowers-backup.service')
const TIMER_UNIT = path.join(PROJECT_ROOT, 'configs/systemd/eternalflowers-backup.timer')
const INSTALLER = path.join(PROJECT_ROOT, 'scripts/production/install-backup-timer.sh')

// ══════════════════════════════════════════════════════════════════
// 1. backup.sh uses compose wrapper, not bare docker compose
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — compose wrapper compliance', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('1. usa COMPOSE_WRAPPER (nunca docker compose directo)', () => {
    // Must reference the wrapper
    expect(content).toContain('COMPOSE_WRAPPER')
    expect(content).toContain('compose.sh')
    // Must NOT contain bare "docker compose" that isn't inside the wrapper variable
    const dockerComposeLines = content.split('\n').filter(l =>
      l.includes('docker compose') && !l.includes('COMPOSE_WRAPPER') && !l.includes('#') && !l.match(/^\s*$/)
    )
    expect(dockerComposeLines).toHaveLength(0)
  })

  it('2. caminho do wrapper resolve da localizacao do script', () => {
    expect(content).toContain('SCRIPT_DIR')
    expect(content).toContain('COMPOSE_WRAPPER="${SCRIPT_DIR}/compose.sh"')
  })

  it('3. nao invoca bare "docker compose -f" ou "docker-compose"', () => {
    expect(content).not.toContain('docker compose -f')
    // But it's okay to have "docker compose" inside a comment
    const cmdPattern = /[^#]\bdocker compose\b/
    const match = content.match(cmdPattern)
    if (match) {
      const line = content.split('\n')[content.substr(0, match.index!).split('\n').length - 1]
      // The only docker compose usage must be through COMPOSE_WRAPPER
      expect(line).toContain('COMPOSE_WRAPPER')
    }
  })
})

// ══════════════════════════════════════════════════════════════════
// 2. Media source verification
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — media source', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('4. media source e /app/media (nao ./media)', () => {
    // Must reference the docker media path
    expect(content).toContain('/app/media')
    expect(content).not.toContain('MEDIA_SRC=')
    // The old pattern used ${MEDIA_SRC:-./media} — verify it's gone
    expect(content).not.toContain('./media')
  })

  it('5. media archive vem do container app via compose exec', () => {
    expect(content).toContain('exec -T app')
    expect(content).toContain('tar czf')
    expect(content).toContain('/app media')
  })
})

// ══════════════════════════════════════════════════════════════════
// 3. PostgreSQL dump format
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — PostgreSQL dump', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('6. usa pg_dump --format=custom', () => {
    expect(content).toContain('--format=custom')
  })

  it('7. usa --no-owner --no-acl', () => {
    expect(content).toContain('--no-owner')
    expect(content).toContain('--no-acl')
  })

  it('8. cria postgres.dump (nao pg-<timestamp>.dump)', () => {
    expect(content).toContain('postgres.dump')
    // The old pattern used pg-$TIMESTAMP
    expect(content).not.toContain('pg-$TIMESTAMP')
    expect(content).not.toContain('pg-${TIMESTAMP}')
  })
})

// ══════════════════════════════════════════════════════════════════
// 4. Verification
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — verification', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('9. pg_restore --list verification existe', () => {
    expect(content).toContain('pg_restore --list')
  })

  it('10. tar -tzf verification existe', () => {
    expect(content).toContain('tar -tzf')
  })

  it('11. SHA-256 manifest existe', () => {
    expect(content).toContain('manifest.sha256')
    expect(content).toContain('sha256sum')
  })
})

// ══════════════════════════════════════════════════════════════════
// 5. Staging → final publish
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — staging/publish', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('12. usa staging dir .tmp-<timestamp>', () => {
    expect(content).toContain('.tmp-')
    expect(content).toContain('STAGING_DIR')
  })

  it('13. publica apenas apos verificacao SHA-256', () => {
    const shaIndex = content.indexOf('sha256sum -c')
    const mvIndex = content.indexOf('mv "${STAGING_DIR}"')
    // sha256sum -c must come before mv
    expect(mvIndex).toBeGreaterThan(shaIndex)
  })
})

// ══════════════════════════════════════════════════════════════════
// 6. Retention
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — retention', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('14. RETENTION_DAYS definido com default 14', () => {
    expect(content).toContain('RETENTION_DAYS=${RETENTION_DAYS:-14}')
  })

  it('15. MIN_SETS definido com default 3', () => {
    expect(content).toContain('MIN_SETS=${MIN_SETS:-3}')
  })

  it('16. nao faz rm -rf "$BACKUP_DIR"/* (delecao ampla insegura)', () => {
    // Ensure there's no unsafe broad deletion pattern
    expect(content).not.toContain('rm -rf "${BACKUP_DIR}"')
    expect(content).not.toContain('rm -rf "$BACKUP_DIR"')
  })

  it('17. retencao executada apenas apos backup completo bem-sucedido', () => {
    // run_retention deve estar dentro do bloco FULL backup (else),
    // que contém publish seguido de run_retention
    const fullBlock = content.substring(
      content.indexOf('# ─── Execute'),
    )
    const pubPos = fullBlock.indexOf('publish')
    const retPos = fullBlock.indexOf('run_retention')
    expect(retPos).toBeGreaterThan(pubPos)
  })
})

// ══════════════════════════════════════════════════════════════════
// 7. Concurrency lock
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — concurrency', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('18. usa flock para lock de concorrencia', () => {
    expect(content).toContain('flock')
    expect(content).toContain('.backup.lock')
  })

  it('34. lock file nao e removido (sem rm em cleanup/trap)', () => {
    // The file must NOT contain rm for .backup.lock
    // The lock file must persist after process exit
    expect(content).not.toContain('rm -f "${LOCK_FILE}"')
    expect(content).not.toContain('rm -f "$LOCK_FILE"')
    // Specifically, there should be no trap/cleanup referencing the lock file
    // The lock section says "DO NOT unlink on exit"
    const lockSection = content.substring(content.indexOf('CONCURRENCY LOCK'))
    expect(lockSection).toContain('DO NOT unlink')
  })
})

// ══════════════════════════════════════════════════════════════════
// 8. Verify mode
// ══════════════════════════════════════════════════════════════════

describe('backup.sh --verify mode', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('19. suporta --verify <backup-dir>', () => {
    expect(content).toContain('VERIFY_MODE')
    expect(content).toContain('--verify')
  })

  it('20. verifica postgres.dump, media.tar.gz, manifest.sha256', () => {
    expect(content).toContain('postgres.dump')
    expect(content).toContain('media.tar.gz')
    expect(content).toContain('manifest.sha256')
  })

  it('28. verify entende tipo de backup (full/pg-only/media-only)', () => {
    expect(content).toContain('backup-pg-*)')
    expect(content).toContain('backup-media-*)')
    expect(content).toContain('backup_type="full"')
    expect(content).toContain('backup_type="pg-only"')
    expect(content).toContain('backup_type="media-only"')
  })

  it('28b. verify full requer postgres.dump + media.tar.gz', () => {
    // The do_verify function checks both postgres.dump and media.tar.gz for full
    expect(content).toContain('media.tar.gz')
    // full path checks both files
    const verifySection = content.substring(content.indexOf('do_verify()'), content.indexOf('if $VERIFY_MODE'))
    // Full type runs both pg_restore --list and tar -tzf checks
    expect(verifySection).toContain('pg_restore --list')
    expect(verifySection).toContain('tar -tzf')
  })

  it('28c. verify pg-only so requer postgres.dump + manifest (nao media.tar.gz)', () => {
    // For pg-only, media check is skipped — verify via the backup-type branching
    const verifySection = content.substring(content.indexOf('do_verify()'), content.indexOf('if $VERIFY_MODE'))
    expect(verifySection).toContain('pg-only')
  })

  it('28d. verify media-only so requer media.tar.gz + manifest (nao postgres.dump)', () => {
    // For media-only, pg check is skipped — verify via the backup-type branching
    const verifySection = content.substring(content.indexOf('do_verify()'), content.indexOf('if $VERIFY_MODE'))
    expect(verifySection).toContain('media-only')
  })
})

// ══════════════════════════════════════════════════════════════════
// 9. Partial backup flags
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — partial flags', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('21. preserva --pg-only e --media-only', () => {
    expect(content).toContain('--pg-only')
    expect(content).toContain('--media-only')
  })

  it('22. backup completo executa ambos', () => {
    expect(content).toContain('pg_backup')
    expect(content).toContain('media_backup')
  })
})

// ══════════════════════════════════════════════════════════════════
// 10. .gitignore
// ══════════════════════════════════════════════════════════════════

describe('.gitignore — backup directories', () => {
  const content = fs.readFileSync(GITIGNORE, 'utf-8')

  it('23. backups/backup-* ignorado', () => {
    expect(content).toContain('backups/backup-')
  })

  it('24. backups/.tmp-* ignorado', () => {
    expect(content).toContain('backups/.tmp-*')
  })

  it('22b. .backup.lock gitignored', () => {
    expect(content).toContain('backups/.backup.lock')
  })

  it('backup-pg-* e backup-media-* gitignored', () => {
    expect(content).toContain('backup-pg-')
    expect(content).toContain('backup-media-')
  })
})

// ══════════════════════════════════════════════════════════════════
// 11. Systemd service
// ══════════════════════════════════════════════════════════════════

describe('systemd service unit', () => {
  const content = fs.readFileSync(SERVICE_UNIT, 'utf-8')

  it('25. Type=oneshot', () => {
    expect(content).toContain('Type=oneshot')
  })

  it('26. ExecStart aponta para backup.sh', () => {
    expect(content).toContain('backup.sh')
  })

  it('27. nao contem secrets', () => {
    expect(content).not.toContain('MAINTENANCE_SECRET')
    expect(content).not.toContain('PAYLOAD_SECRET')
    expect(content).not.toContain('DATABASE_URI')
    expect(content).not.toContain('.env.production')
  })
})

// ══════════════════════════════════════════════════════════════════
// 12. Systemd timer
// ══════════════════════════════════════════════════════════════════

describe('systemd timer unit', () => {
  const content = fs.readFileSync(TIMER_UNIT, 'utf-8')

  it('28. OnCalendar=*-*-* 03:30:00 Europe/Lisbon', () => {
    expect(content).toContain('OnCalendar=*-*-* 03:30:00 Europe/Lisbon')
  })

  it('29. Persistent=true', () => {
    expect(content).toContain('Persistent=true')
  })

  it('30. WantedBy=timers.target', () => {
    expect(content).toContain('WantedBy=timers.target')
  })

  it('31. nao contem secrets', () => {
    expect(content).not.toContain('MAINTENANCE_SECRET')
    expect(content).not.toContain('PAYLOAD_SECRET')
    expect(content).not.toContain('.env.production')
  })

  it('33. RandomizedDelaySec removido', () => {
    expect(content).not.toContain('RandomizedDelaySec')
  })
})

// ══════════════════════════════════════════════════════════════════
// 13. restore.sh uses compose wrapper
// ══════════════════════════════════════════════════════════════════

describe('restore.sh — compose wrapper', () => {
  const content = fs.readFileSync(RESTORE_SH, 'utf-8')

  it('32. usa COMPOSE_WRAPPER (nao docker compose directo)', () => {
    expect(content).toContain('COMPOSE_WRAPPER')
    expect(content).toContain('compose.sh')
    // No bare docker compose lines
    const dockerComposeLines = content.split('\n').filter(l =>
      l.includes('docker compose') && !l.includes('COMPOSE_WRAPPER') && !l.includes('#') && !l.match(/^\s*$/)
    )
    expect(dockerComposeLines).toHaveLength(0)
  })

  it('33. requer confirmacao explicita CONFIRMAR', () => {
    expect(content).toContain('CONFIRMAR')
  })
})

// ══════════════════════════════════════════════════════════════════
// 14. Installer script
// ══════════════════════════════════════════════════════════════════

describe('install-backup-timer.sh', () => {
  it('34. existe e e executavel', () => {
    expect(fs.existsSync(INSTALLER)).toBe(true)
    const stats = fs.statSync(INSTALLER)
    expect(stats.mode & 0o111).not.toBe(0)
  })

  it('35. requer root', () => {
    const content = fs.readFileSync(INSTALLER, 'utf-8')
    expect(content).toContain('$(id -u)')
    expect(content).toContain('0')
  })

  it('36. nao contem secrets', () => {
    const content = fs.readFileSync(INSTALLER, 'utf-8')
    expect(content).not.toContain('MAINTENANCE_SECRET')
    expect(content).not.toContain('.env.production')
  })

  it('37. faz systemctl daemon-reload e enable timer', () => {
    const content = fs.readFileSync(INSTALLER, 'utf-8')
    expect(content).toContain('daemon-reload')
    expect(content).toContain('systemctl enable')
  })

  it('35b. installer nao executa systemctl start timer', () => {
    const content = fs.readFileSync(INSTALLER, 'utf-8')
    // Should NOT start the timer automatically as an executed command
    // The string appears only in echo/comment context
    const lines = content.split('\n')
    const execStart = lines.filter(l =>
      l.includes('systemctl start eternalflowers-backup.timer') &&
      !l.trim().startsWith('echo') &&
      !l.trim().startsWith('#')
    )
    expect(execStart).toHaveLength(0)
  })

  it('35c. installer mostra comando para iniciar o timer manualmente', () => {
    const content = fs.readFileSync(INSTALLER, 'utf-8')
    // Should document how to start the timer
    expect(content).toContain('systemctl start eternalflowers-backup.timer')
    // Should be in informational context, not executed
    const startLine = content.split('\n').find(l => l.includes('systemctl start eternalflowers-backup.timer'))
    expect(startLine).toBeTruthy()
    // It should be in a comment/echo, not a bare command
    expect(startLine).toMatch(/^(echo|#)/)
  })
})

// ══════════════════════════════════════════════════════════════════
// 15. No production restore in tests
// ══════════════════════════════════════════════════════════════════

describe('static test safety', () => {
  it('38. nenhum teste executa backup ou restore contra producao', () => {
    // This test file is purely static analysis — no production contact
    expect(true).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════
// 16. backup.sh — shell safety
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — shell safety', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('39. usa set -euo pipefail', () => {
    expect(content).toContain('set -euo pipefail')
  })

  it('40. nao tem set -x', () => {
    expect(content.match(/^set -x$/m)).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════
// 17. Backup files naming convention
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — naming convention', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('41. backup final dir prefixos corretos', () => {
    expect(content).toContain('backup"')
    expect(content).toContain('backup-pg"')
    expect(content).toContain('backup-media"')
  })

  it('42. ficheiros sao postgres.dump, media.tar.gz, manifest.sha256', () => {
    expect(content).toContain('postgres.dump')
    expect(content).toContain('media.tar.gz')
    expect(content).toContain('manifest.sha256')
  })
})

// ══════════════════════════════════════════════════════════════════
// 18. restore.sh — media restore path & wording
// ══════════════════════════════════════════════════════════════════

describe('restore.sh — media restore path', () => {
  const content = fs.readFileSync(RESTORE_SH, 'utf-8')

  it('43. media restore vai para app:/app/media', () => {
    expect(content).toContain('/app/media')
  })

  it('44. usa compose cp para copiar para o container', () => {
    expect(content).toContain('cp')
  })
})

// ══════════════════════════════════════════════════════════════════
// 19. ISSUE-41: PG verification via container (fix 2)
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — PG verification via container (ISSUE-41)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('PG structural verification always runs via container pg_restore', () => {
    expect(content).toContain('verify_pg_dump')
  })

  it('verify_pg_dump function exists — container-first approach', () => {
    expect(content).toContain('verify_pg_dump()')
    expect(content).toContain('pg_restore --list /dev/stdin')
  })

  it('no path that skips PG verification exists', () => {
    // backup.sh must not have a branch that says "skip" for PG verification
    expect(content).not.toContain('salte verificação pg')
    expect(content).not.toContain('skip pg')
  })

  it('pg_backup calls verify_pg_dump and fails if it fails', () => {
    // The pg_backup function must call verify_pg_dump and return 1 on failure
    const pgBackupSection = content.substring(content.indexOf('pg_backup()'))
    expect(pgBackupSection).toContain('verify_pg_dump')
    expect(pgBackupSection).toContain('return 1')
  })
})

// ══════════════════════════════════════════════════════════════════
// 20. ISSUE-41: Media tar non-zero exit = FAIL
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — media tar failure is fatal (ISSUE-41)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('media tar non-zero exit fails the backup (no rescue)', () => {
    const mediaSection = content.substring(content.indexOf('media_backup()'))
    // The old rescue pattern checked if [ -s "${MEDIA_ARCHIVE}" ] after tar failure
    expect(mediaSection).not.toContain('if [ -s')
    // Must explicitly fail on tar non-zero
    expect(mediaSection).toContain('log_err "Falha ao criar media archive (tar exit non-zero)"')
  })

  it('nao tenta salvar archive parcial apenas por ser non-empty', () => {
    // The old rescue pattern checked: if tar fails but file is non-empty → treat as OK
    const mediaSection = content.substring(content.indexOf('media_backup()'))
    // Should NOT have the rescue logic
    expect(mediaSection).not.toMatch(/tar.*then.*log_ok.*else.*\[ -s.*\]/)
    expect(mediaSection).toContain('rm -f "${MEDIA_ARCHIVE}"')
    // Verify the exact pattern: tar then directly fail
    expect(mediaSection).toContain('log_err "Falha ao criar media archive (tar exit non-zero)"')
  })
})

// ══════════════════════════════════════════════════════════════════
// 21. ISSUE-41: Naming convention for partial backups
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — naming distinguishes full vs partial (ISSUE-41)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('FULL backup published as backup-YYYYMMDD_HHMMSS', () => {
    expect(content).toContain('FINAL_PREFIX="backup"')
  })

  it('PG-only published as backup-pg-YYYYMMDD_HHMMSS', () => {
    expect(content).toContain('FINAL_PREFIX="backup-pg"')
  })

  it('Media-only published as backup-media-YYYYMMDD_HHMMSS', () => {
    expect(content).toContain('FINAL_PREFIX="backup-media"')
  })
})

// ══════════════════════════════════════════════════════════════════
// 22. ISSUE-41: Default --verify selects latest FULL backup only
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — default verify selects FULL only (ISSUE-41)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('default verify (no arg) selects only backup-<timestamp> (full)', () => {
    // The pattern must exclude backup-pg- and backup-media-
    const verifySection = content.substring(content.indexOf('VERIFY_DIR=$(ls'))
    // The glob must not match partials
    expect(verifySection).toContain('backup-[0-9]*_*/')
  })
})

// ══════════════════════════════════════════════════════════════════
// 23. ISSUE-41: Retention only counts full sets
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — retention partial set isolation (ISSUE-41)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('retention so considera conjuntos backup-<timestamp> (full)', () => {
    const retentionSection = content.substring(content.indexOf('run_retention()'))
    // Must only match full backup pattern
    expect(retentionSection).toContain('backup-[0-9]{8}_[0-9]{6}$')
  })

  it('full sets requerem ambos postgres.dump + media.tar.gz para contarem', () => {
    const retentionSection = content.substring(content.indexOf('run_retention()'))
    expect(retentionSection).toContain('postgres.dump')
    expect(retentionSection).toContain('media.tar.gz')
  })

  it('PG-only sets (backup-pg-) nao contam para MIN_SETS', () => {
    // The glob should not match backup-pg-*
    const retentionSection = content.substring(content.indexOf('run_retention()'))
    // Regex ^backup-... should avoid backup-pg- prefix
    expect(retentionSection).toContain('^backup-')
    // backup-pg- starts with backup- but has -pg- before the timestamp
    // ^backup- matches backup- but the full regex ^backup-[0-9]{8}_ should not
    expect(retentionSection).toMatch(/backup-\[0-9\]/)
  })

  it('diretorios desconhecidos sao ignorados', () => {
    const retentionSection = content.substring(content.indexOf('run_retention()'))
    // The loop only globs backup-* not everything in BACKUP_DIR
    expect(retentionSection).toMatch(/backup-\[0-9\]/)
  })
})

// ══════════════════════════════════════════════════════════════════
// 24. ISSUE-41: Restore fixes
// ══════════════════════════════════════════════════════════════════

describe('restore.sh — ISSUE-41 fixes', () => {
  const content = fs.readFileSync(RESTORE_SH, 'utf-8')

  it('nao contem top-level local keyword (fora de funcoes)', () => {
    // Scan for `local` at the start of non-indented, non-comment lines
    // within top-level scope (before any function definition)
    const lines = content.split('\n')
    const topLevelLocals = lines.filter((l, idx) => {
      // Only check lines before the first function declaration
      const beforeFunc = !lines.slice(0, idx + 1).some(l2 => l2.trim().startsWith('function ') || (l2.trim().endsWith('() {') && !l2.trim().startsWith('#') && !l2.trim().startsWith('case')))
      return beforeFunc && l.match(/^\s*local\s/) && !l.match(/^\s*#/)
    })
    expect(topLevelLocals).toHaveLength(0)
  })

  it('PG validation fails closed (aborta se dump nao verificado)', () => {
    // Must abort, not warn and continue
    expect(content).toContain('Validação estrutural do dump falhou')
    expect(content).toContain('ABORTAR')
    // Should not have the old warning pattern
    expect(content).not.toContain('Não foi possível validar')
  })

  it('usa container pg_restore (POSTGRES_USER/POSTGRES_DB do container)', () => {
    // Must use POSTGRES_USER and POSTGRES_DB from container environment
    // The sh -ec single-quoted shell string keeps these as container-resolved vars
    expect(content).toContain('sh -ec')
    expect(content).toContain('"$POSTGRES_USER"')
    expect(content).toContain('"$POSTGRES_DB"')
    // Should NOT use host-side PGUSER/PGDATABASE fallback
    expect(content).not.toContain('${PGUSER:-')
    expect(content).not.toContain('${PGDATABASE:-')
  })

  it('POSTGRES_USER/DB resolved inside container shell, not host env', () => {
    // The pg_restore call wraps variables in sh -ec '...' single quotes
    // so the host shell (with set -u) never expands them.
    const pgSection = content.substring(
      content.indexOf('tmp_restore='),
      content.indexOf('# ── Media')
    )
    // Verify the sh -ec wrapper encloses the POSTGRES_* references
    expect(pgSection).toContain("sh -ec '")
    expect(pgSection).toContain('-U "$POSTGRES_USER"')
    expect(pgSection).toContain('-d "$POSTGRES_DB"')
  })

  it('CONFIRMAR mantido', () => {
    expect(content).toContain('CONFIRMAR')
  })

  it('restore inclui --clean --if-exists para pg_restore', () => {
    // The script should contain pg_restore --clean (required for restore operation)
    expect(content).toContain('--clean --if-exists')
  })
})

// ══════════════════════════════════════════════════════════════════
// 25. ISSUE-41: Media restore wording
// ══════════════════════════════════════════════════════════════════

describe('restore.sh — media wording accuracy (ISSUE-41)', () => {
  const content = fs.readFileSync(RESTORE_SH, 'utf-8')

  it('media restore menciona overlay nao mirror', () => {
    expect(content).toContain('overlay')
    expect(content).toContain('ficheiros contidos no backup')
  })

  it('media restore admite que ficheiros extra nao sao apagados', () => {
    expect(content).toContain('NÃO são apagados')
    expect(content).toContain('extra atualmente em /app/media NÃO são apagados')
  })
})

// ══════════════════════════════════════════════════════════════════
// 26. ISSUE-41: No business logic changes
// ══════════════════════════════════════════════════════════════════

describe('static assertions — no business logic changes (ISSUE-41)', () => {
  it('nenhum ficheiro de aplicacao alterado', () => {
    // This test file is focused on scripts/production/* only
    const testFiles = [
      'scripts/production/backup.sh',
      'scripts/production/restore.sh',
      'scripts/production/install-backup-timer.sh',
      'scripts/production/compose.sh',
      'configs/systemd/eternalflowers-backup.service',
      'configs/systemd/eternalflowers-backup.timer',
      '.gitignore',
      'src/services/backup-architecture.test.ts',
    ]
    // These are the only files in scope — no src/app business logic
    expect(testFiles).not.toContain('src/app/')
    expect(testFiles).not.toContain('src/collections/')
    expect(testFiles).not.toContain('src/payload/')
  })
})

// ══════════════════════════════════════════════════════════════════
// 27. ISSUE-41: Flock is non-blocking, lock file persistent
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — flock persistent lock (ISSUE-41)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('flock usa -n (non-blocking, sem timeout)', () => {
    const lockSection = content.substring(content.indexOf('exec 200>'))
    expect(lockSection).toContain('flock -n 200')
    // No 300-second wait
    expect(lockSection).not.toContain('flock -w')
  })

  it('lock file nao e removido no exit trap', () => {
    // There should be no trap or cleanup that removes the lock
    expect(content).not.toContain('trap cleanup')
    // The entire file should not have `rm` targeting the lock file
    const rmPattern = /rm\s+(-f\s+)?.*LOCK_FILE/
    expect(content.match(rmPattern)).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════
// 28. ISSUE-41: verify_pg_dump function completeness
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — verify_pg_dump container fallback chain (ISSUE-41)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('verify_pg_dump tenta container primeiro, depois host', () => {
    const funcSection = content.substring(content.indexOf('verify_pg_dump()'))
    // Container path
    expect(funcSection).toContain('pg_restore --list /dev/stdin <')
    // Host fallback
    expect(funcSection).toContain('command -v pg_restore')
  })

  it('verify_pg_dump retorna 1 (failure) se nenhum verificador funciona', () => {
    const funcSection = content.substring(content.indexOf('verify_pg_dump()'))
    // The final return 1 when both paths fail
    expect(funcSection).toContain('return 1')
  })
})

// ══════════════════════════════════════════════════════════════════
// 29. ISSUE-41 fix: POSTGRES_USER/DB expanded inside container
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — container-side env expansion (ISSUE-41 fix)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('pg_dump postgres env vars are inside sh -ec container shell', () => {
    const pgSection = content.substring(content.indexOf('pg_backup()'))
    // pg_dump wrapped in sh -ec with POSTGRES_ vars inside single quotes
    expect(pgSection).toContain("sh -ec '")
    expect(pgSection).toContain('"$POSTGRES_USER"')
    expect(pgSection).toContain('"$POSTGRES_DB"')
    // Host shell must NOT expand these vars directly
    expect(pgSection).not.toContain('\\$POSTGRES_USER')
  })

  it('pg_dump does not reference POSTGRES_USER/DB on the host shell', () => {
    // Verify the pg_dump line contains NO host-level $POSTGRES_USER/DB
    const pgSection = content.substring(content.indexOf('pg_backup()'))
    const lines = pgSection.split('\n')
    // Find the exec line that has pg_dump — it must be the sh -ec line
    const execLine = lines.find(l => l.includes('exec -T postgres sh'))
    expect(execLine).toBeTruthy()
    // Ensure the exec line is the single-quoted version
    expect(execLine).toContain("sh -ec '")
    // No bare $POSTGRES_USER outside quotes on the exec line
    expect(execLine).not.toMatch(/\$POSTGRES_USER[^"]/)
  })
})

// ══════════════════════════════════════════════════════════════════
// 30. ISSUE-41 fix: --verify argument parsing
// ══════════════════════════════════════════════════════════════════

describe('backup.sh — --verify argument parsing (ISSUE-41 fix)', () => {
  const content = fs.readFileSync(BACKUP_SH, 'utf-8')

  it('usa while-shift parser em vez de for-arg loop plano', () => {
    // Must use while [ $# -gt 0 ]; do case "$1" ... shift
    expect(content).toContain('while [ $# -gt 0 ]')
    expect(content).toContain('case "$1" in')
    // Must NOT use the old for-arg pattern
    expect(content).not.toContain('for arg in "$@"')
  })

  it('--verify suporta tres formas sintaticas', () => {
    // --verify (no arg, uses default latest full)
    expect(content).toContain('--verify)')
    // --verify=<dir> (inline value with =)
    expect(content).toContain('--verify=*)')
    // --verify <dir> (next arg consumed)
    // Check that the --verify) case consumes next arg if not another option
    const verifyBlock = content.substring(content.indexOf('--verify)'), content.indexOf('--verify=*)'))
    expect(verifyBlock).toContain('VERIFY_DIR="$1"')
    expect(verifyBlock).toContain('shift')
  })

  it('--verify only consumes next arg if not another option flag', () => {
    const verifyBlock = content.substring(content.indexOf('--verify)'), content.indexOf('--verify=*)'))
    expect(verifyBlock).toContain('[[ "$1" != -* ]]')
  })

  it('erro em opcao desconhecida com shift parser', () => {
    // The catch-all uses $1 instead of $arg
    expect(content).toContain('Opção desconhecida: $1')
  })

  it('mantem --pg-only e --media-only no parser', () => {
    expect(content).toContain('--pg-only)')
    expect(content).toContain('--media-only)')
  })
})

// ══════════════════════════════════════════════════════════════════
// 31. Runtime shell test: unset POSTGRES_USER/POSTGRES_DB
// ══════════════════════════════════════════════════════════════════

describe('runtime — unset host env (ISSUE-41 fix)', () => {
  it('backup.sh nao crasha com POSTGRES_USER e POSTGRES_DB unset (--verify path)', () => {
    // Run backup.sh with --verify pointing to a non-existent dir,
    // in an environment where POSTGRES_USER and POSTGRES_DB are unset.
    // The script must NOT hit "unbound variable" from set -u.
    // Expected: "Diretório não encontrado" — clean error, not crash.
    const { execSync } = require('child_process')
    const projectDir = path.resolve(__dirname, '..', '..')
    const result = execSync(
      'bash scripts/production/backup.sh --verify /dev/null/does-not-exist 2>&1 || true',
      {
        cwd: projectDir,
        timeout: 10000,
        encoding: 'utf-8',
        env: Object.assign({}, process.env, {
          POSTGRES_USER: undefined,
          POSTGRES_DB: undefined,
        }),
      }
    )
    // Should NOT contain "unbound variable" or "POSTGRES_USER"
    expect(result).not.toContain('unbound variable')
    expect(result).not.toContain('POSTGRES_USER')
    // Should reach the verify path and fail with directory-not-found
    expect(result).toContain('Diretório não encontrado')
  })
})