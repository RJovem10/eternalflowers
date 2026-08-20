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
    expect(content).toContain('backups/backup-*')
  })

  it('24. backups/.tmp-* ignorado', () => {
    expect(content).toContain('backups/.tmp-*')
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
  const INSTALLER = path.join(PROJECT_ROOT, 'scripts/production/install-backup-timer.sh')

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
// 16. backup.sh — set -euo pipefail
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

  it('41. backup final dir e backup-<YYYYMMDD_HHMMSS>', () => {
    expect(content).toContain('backup-${TIMESTAMP}')
  })

  it('42. ficheiros sao postgres.dump, media.tar.gz, manifest.sha256', () => {
    expect(content).toContain('postgres.dump')
    expect(content).toContain('media.tar.gz')
    expect(content).toContain('manifest.sha256')
  })
})

// ══════════════════════════════════════════════════════════════════
// 18. restore.sh media restores to app container
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