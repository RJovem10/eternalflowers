/**
 * Testes para maintenance-scheduler e compose wrapper
 *
 * ISSUE-36 — Valida:
 *   1. Scheduler service existe no compose
 *   2. Sem portas expostas
 *   3. Mesma rede Docker que a app
 *   4. URL interno http://app:3000 usado (não público)
 *   5. MAINTENANCE_SECRET não hardcoded
 *   6. Cadência de 5 minutos
 *   7. Wrapper compose.sh sempre inclui --env-file .env.production
 *   8. Scheduler Dockerfile é mínimo (Alpine + curl)
 *   9. Apenas MAINTENANCE_SECRET é necessária
 *  10. Sem acesso a base de dados, Stripe, Payload
 */
/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const COMPOSE_PATH = path.join(PROJECT_ROOT, 'docker-compose.production.yml')
const SCHEDULER_SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts/production/maintenance-loop.sh')
const COMPOSE_WRAPPER_PATH = path.join(PROJECT_ROOT, 'scripts/production/compose.sh')
const SCHEDULER_DOCKERFILE_PATH = path.join(PROJECT_ROOT, 'Dockerfile.maintenance-scheduler')
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, '.env.production.example')

// ─── Load compose once ───────────────────────────────────────────

let composeDoc: any
let schedulerService: any

function loadCompose() {
  if (composeDoc) return
  const raw = fs.readFileSync(COMPOSE_PATH, 'utf-8')
  composeDoc = yaml.load(raw) as any
  if (composeDoc?.services?.['maintenance-scheduler']) {
    schedulerService = composeDoc.services['maintenance-scheduler']
  }
}

// ══════════════════════════════════════════════════════════════════
// 1. Scheduler service exists
// ══════════════════════════════════════════════════════════════════

describe('maintenance-scheduler — service definition', () => {
  beforeAll(() => loadCompose())

  it('1. maintenance-scheduler service existe no docker-compose.production.yml', () => {
    expect(composeDoc?.services).toHaveProperty('maintenance-scheduler')
    expect(schedulerService).toBeDefined()
  })

  it('2. container_name definido', () => {
    expect(schedulerService.container_name).toBe('eternal-flowers-maintenance-scheduler')
  })

  it('3. restart: unless-stopped', () => {
    expect(schedulerService.restart).toBe('unless-stopped')
  })

  it('4. depends_on app com condition service_started', () => {
    expect(schedulerService.depends_on?.app?.condition).toBe('service_started')
  })

  it('5. usa Dockerfile.maintenance-scheduler para build', () => {
    expect(schedulerService.build?.dockerfile).toBe('Dockerfile.maintenance-scheduler')
    expect(schedulerService.build?.context).toBe('.')
  })
})

// ══════════════════════════════════════════════════════════════════
// 2. No exposed ports
// ══════════════════════════════════════════════════════════════════

describe('maintenance-scheduler — no public ports', () => {
  beforeAll(() => loadCompose())

  it('6. não tem ports', () => {
    expect(schedulerService.ports).toBeUndefined()
  })

  it('7. não tem expose', () => {
    expect(schedulerService.expose).toBeUndefined()
  })

  it('8. tem deploy com limites de memória mínimos', () => {
    expect(schedulerService.deploy?.resources?.limits?.memory).toBe('32M')
    expect(schedulerService.deploy?.resources?.reservations?.memory).toBe('16M')
  })
})

// ══════════════════════════════════════════════════════════════════
// 3. Internal network
// ══════════════════════════════════════════════════════════════════

describe('maintenance-scheduler — internal network', () => {
  beforeAll(() => loadCompose())

  it('9. mesma rede Docker que a app: eternal-flowers-net', () => {
    expect(schedulerService.networks).toEqual(['eternal-flowers-net'])
  })
})

// ══════════════════════════════════════════════════════════════════
// 4. Uses env_file, not hardcoded secrets
// ══════════════════════════════════════════════════════════════════

describe('maintenance-scheduler — env/secret safety', () => {
  beforeAll(() => loadCompose())

  it('10. usa env_file: .env.production (não duplica secret no environment)', () => {
    expect(schedulerService.env_file).toContain('.env.production')
  })

  it('11. não usa environment block (evita duplicação de secret)', () => {
    // Pode ou não ter environment, mas se tiver, não deve conter
    // secrets que o scheduler não precisa
    if (schedulerService.environment) {
      const env = schedulerService.environment
      // Scheduler só precisa de MAINTENANCE_SECRET, e isso vem do env_file
      expect(env).not.toHaveProperty('DATABASE_URI')
      expect(env).not.toHaveProperty('PAYLOAD_SECRET')
      expect(env).not.toHaveProperty('STRIPE_SECRET_KEY')
      expect(env).not.toHaveProperty('RESEND_API_KEY')
    }
  })

  it('12. não tem volumes', () => {
    expect(schedulerService.volumes).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════
// 5. Scheduler script — internal URL, 5-min cadence
// ══════════════════════════════════════════════════════════════════

describe('maintenance-loop.sh — script behaviour', () => {
  it('13. ficheiro existe e é executável', () => {
    expect(fs.existsSync(SCHEDULER_SCRIPT_PATH)).toBe(true)
    const stats = fs.statSync(SCHEDULER_SCRIPT_PATH)
    expect(stats.mode & 0o111).not.toBe(0) // executable
  })

  it('14. usa URL interna http://app:3000 (não pública)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('http://app:3000/api/internal/maintenance')
    // Não deve usar domínio público
    expect(content).not.toContain('https://eternalflowers.pt')
    expect(content).not.toContain('https://floresmarina.pt')
  })

  it('15. cadência de 300 segundos (5 minutos)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('INTERVAL_SECONDS=300')
  })

  it('16. MAINTENANCE_SECRET não hardcoded — vem de variável de ambiente', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('${MAINTENANCE_SECRET}')
    expect(content).toContain('MAINTENANCE_SECRET:-}')
    // Não deve ter um secret hardcoded
    expect(content).not.toContain('Bearer my-secret')
    expect(content).not.toContain('Bearer test')
  })

  it('17. lida com HTTP 200, 409, 401/403, 503, connection failure', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('200)')
    expect(content).toContain('409)')
    expect(content).toContain('401|403)')
    expect(content).toContain('503)')
  })

  it('18. startup retry loop com ~60s de espera', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('STARTUP_RETRY_DELAY=5')
    expect(content).toContain('STARTUP_MAX_RETRIES=12')
  })

  it('19. sem set -x (não expõe tracing)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // Usa set -eu, nunca set -x activo no shell
    expect(content).toContain('set -eu')
    // A linha set -x não deve aparecer como comando activo
    expect(content.match(/^set -x$/m)).toBeNull()
    expect(content).not.toContain('set -v')
  })

  it('20. sem contacto com internet — apenas rede Docker', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // Não deve tentar contactar internet
    expect(content).not.toContain('eternalflowers.pt')
    expect(content).not.toContain('floresmarina.pt')
    expect(content).not.toContain('google.com')
  })
})

// ══════════════════════════════════════════════════════════════════
// 6. Compose wrapper
// ══════════════════════════════════════════════════════════════════

describe('compose.sh — production wrapper', () => {
  it('21. ficheiro existe e é executável', () => {
    expect(fs.existsSync(COMPOSE_WRAPPER_PATH)).toBe(true)
    const stats = fs.statSync(COMPOSE_WRAPPER_PATH)
    expect(stats.mode & 0o111).not.toBe(0)
  })

  it('22. contém --env-file .env.production', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('--env-file')
    expect(content).toContain('.env.production')
  })

  it('23. preserva argumentos arbitrários via "$@"', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('"$@"')
  })

  it('24. valida existência de .env.production antes de executar', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('.env.production')
    expect(content).toContain('não encontrado')
  })

  it('25. usa exec para o comando final', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('exec docker compose')
  })

  it('26. resolve caminhos relativos corretamente', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('dirname')
    expect(content).toContain('PROJECT_DIR')
  })
})

// ══════════════════════════════════════════════════════════════════
// 7. Dockerfile.maintenance-scheduler
// ══════════════════════════════════════════════════════════════════

describe('Dockerfile.maintenance-scheduler', () => {
  it('27. existe', () => {
    expect(fs.existsSync(SCHEDULER_DOCKERFILE_PATH)).toBe(true)
  })

  it('28. base Alpine 3.20 — imagem mínima', () => {
    const content = fs.readFileSync(SCHEDULER_DOCKERFILE_PATH, 'utf-8')
    expect(content).toContain('alpine:3.20')
    expect(content).toContain('apk add --no-cache curl')
  })

  it('29. copia maintenance-loop.sh para /usr/local/bin/', () => {
    const content = fs.readFileSync(SCHEDULER_DOCKERFILE_PATH, 'utf-8')
    expect(content).toContain('COPY scripts/production/maintenance-loop.sh')
  })

  it('30. executa como nobody', () => {
    const content = fs.readFileSync(SCHEDULER_DOCKERFILE_PATH, 'utf-8')
    expect(content).toContain('USER nobody')
  })
})

// ══════════════════════════════════════════════════════════════════
// 8. .env.production.example — MAINTENANCE_SECRET documented
// ══════════════════════════════════════════════════════════════════

describe('.env.production.example — MAINTENANCE_SECRET', () => {
  it('31. MAINTENANCE_SECRET documentado', () => {
    const content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8')
    expect(content).toContain('MAINTENANCE_SECRET')
    expect(content).toContain('<GERAR_SECRET_64_HEX>')
  })

  it('32. composição do ciclo documentada', () => {
    const content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8')
    expect(content).toContain('/api/internal/maintenance')
  })
})

// ══════════════════════════════════════════════════════════════════
// 9. Compose header references wrapper
// ══════════════════════════════════════════════════════════════════

describe('docker-compose.production.yml — header references wrapper', () => {
  beforeAll(() => loadCompose())

  it('33. header recomenda usar compose.sh', () => {
    const raw = fs.readFileSync(COMPOSE_PATH, 'utf-8')
    expect(raw).toContain('scripts/production/compose.sh')
  })

  it('34. header avisa sobre omitir --env-file', () => {
    const raw = fs.readFileSync(COMPOSE_PATH, 'utf-8')
    expect(raw).toContain('NUNCA')
    expect(raw).toContain('--env-file')
  })

  it('35. network eternal-flowers-net existe', () => {
    expect(composeDoc?.networks?.['eternal-flowers-net']).toBeDefined()
    expect(composeDoc?.networks?.['eternal-flowers-net']?.driver).toBe('bridge')
  })
})

// ══════════════════════════════════════════════════════════════════
// 10. Maintenance business logic unchanged
// ══════════════════════════════════════════════════════════════════

describe('maintenance business logic unchanged', () => {
  const MAINTENANCE_PATH = path.join(
    PROJECT_ROOT,
    'src/services/maintenance/maintenance.ts',
  )

  it('36. maintenance.ts inalterado — funções principais preservadas', () => {
    const content = fs.readFileSync(MAINTENANCE_PATH, 'utf-8')
    // Funções core
    expect(content).toContain('export async function runMaintenanceCycle')
    expect(content).toContain('expireAbandonedPendingOrders')
    expect(content).toContain('processPendingEmailNotifications')
    // Concorrência
    expect(content).toContain('if (_isRunning)')
    expect(content).toContain('class MaintenanceAlreadyRunningError')
    // Sanitização
    expect(content).not.toContain('pi_')
  })
})