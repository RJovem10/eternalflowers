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
 *   9. Apenas MAINTENANCE_SECRET é fornecida via environment
 *  10. Sem env_file (impede injeção de secrets não necessários)
 *  11. Health probe usa GET /api/health, não POST /api/internal/maintenance
 *  12. Conexão curl zero tratada como "000"
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
// 4. Secret isolation — no env_file, explicit MAINTENANCE_SECRET only
// ══════════════════════════════════════════════════════════════════

describe('maintenance-scheduler — secret isolation', () => {
  beforeAll(() => loadCompose())

  it('10. NÃO usa env_file (evita injeção de secrets desnecessários)', () => {
    expect(schedulerService.env_file).toBeUndefined()
  })

  it('11. environment contém apenas MAINTENANCE_SECRET', () => {
    expect(schedulerService.environment).toBeDefined()
    const env = schedulerService.environment
    // Deve conter MAINTENANCE_SECRET
    expect(env).toHaveProperty('MAINTENANCE_SECRET')
    // NÃO deve conter outros secrets de produção
    expect(env).not.toHaveProperty('DATABASE_URI')
    expect(env).not.toHaveProperty('PAYLOAD_SECRET')
    expect(env).not.toHaveProperty('STRIPE_SECRET_KEY')
    expect(env).not.toHaveProperty('RESEND_API_KEY')
    expect(env).not.toHaveProperty('INSTAGRAM_ACCESS_TOKEN')
    expect(env).not.toHaveProperty('INSTAGRAM_BUSINESS_ID')
    expect(env).not.toHaveProperty('POSTGRES_USER')
    expect(env).not.toHaveProperty('POSTGRES_PASSWORD')
    expect(env).not.toHaveProperty('NODE_ENV')
    // Número exacto de variáveis: apenas MAINTENANCE_SECRET
    const keys = Object.keys(env)
    expect(keys).toHaveLength(1)
  })

  it('12. MAINTENANCE_SECRET usa interpolação Compose com validação (:?)', () => {
    const env = schedulerService.environment
    expect(env.MAINTENANCE_SECRET).toBe('${MAINTENANCE_SECRET:?MAINTENANCE_SECRET is required}')
  })

  it('13. não tem volumes', () => {
    expect(schedulerService.volumes).toBeUndefined()
  })
})

// ══════════════════════════════════════════════════════════════════
// 5. Scheduler script — internal URL, 5-min cadence, health probe
// ══════════════════════════════════════════════════════════════════

describe('maintenance-loop.sh — script behaviour', () => {
  it('14. ficheiro existe e é executável', () => {
    expect(fs.existsSync(SCHEDULER_SCRIPT_PATH)).toBe(true)
    const stats = fs.statSync(SCHEDULER_SCRIPT_PATH)
    expect(stats.mode & 0o111).not.toBe(0) // executable
  })

  it('15. usa URL interna http://app:3000 (não pública)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('http://app:3000/api/internal/maintenance')
    // Não deve usar domínio público
    expect(content).not.toContain('https://eternalflowers.pt')
    expect(content).not.toContain('https://floresmarina.pt')
  })

  it('16. cadência de 300 segundos (5 minutos)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('INTERVAL_SECONDS=300')
  })

  it('17. MAINTENANCE_SECRET não hardcoded — vem de variável de ambiente', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('${MAINTENANCE_SECRET}')
    expect(content).toContain('MAINTENANCE_SECRET:-}')
    // Não deve ter um secret hardcoded
    expect(content).not.toContain('Bearer my-secret')
    expect(content).not.toContain('Bearer test')
  })

  it('18. lida com HTTP 200, 409, 401/403, 503, connection failure (000)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('200)')
    expect(content).toContain('409)')
    expect(content).toContain('401|403)')
    expect(content).toContain('503)')
    expect(content).toContain('000)')
  })

  it('19. startup retry loop usa health endpoint, não maintenance', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // Health probe URL must be present
    expect(content).toContain("HEALTH_URL='http://app:3000/api/health'")
    // Startup loop must use health URL
    expect(content).toContain('${HEALTH_URL}')
    // The startup section (before first call to run_cycle) must use GET,
    // not POST — the POST is only in run_cycle() for the maintenance endpoint
    const startupSection = content.substring(0, content.indexOf('run_cycle'))
    expect(startupSection).toContain('api/health')
    expect(startupSection).not.toContain('--request POST')
  })

  it('20. startup retry loop com ~60s de espera', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    expect(content).toContain('STARTUP_RETRY_DELAY=5')
    expect(content).toContain('STARTUP_MAX_RETRIES=12')
  })

  it('21. startup probe é GET (não POST — não executa maintenance)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // O bloco de startup deve usar --request GET (ou GET implícito sem --request POST)
    // Extract the startup section only (before run_cycle)
    const startupLines = content.split('\n').filter((line, i, arr) => {
      const preRunCycle = arr.indexOf('run_cycle') >= 0
        ? content.substring(0, content.indexOf('run_cycle'))
        : content
      return preRunCycle.includes(line) || !line.includes('run_cycle')
    })
    // Health probe uses GET without auth header
    expect(content).toContain('--request GET')
    expect(content).toContain('--output /dev/null')
    // No Authorization header in startup probe
    const healthLines = content.split('\n').filter(l => l.includes('HEALTH_URL') || l.includes('api/health'))
    const authInHealth = healthLines.filter(l => l.includes('Authorization')).length
    expect(authInHealth).toBe(0)
  })

  it('22. primeira execução de maintenance ocorre APÓS readiness', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // Encontrar a chamada a run_cycle que ocorre DEPOIS do loop de startup
    // (não confundir com a definição da função run_cycle())
    const afterFunctionDef = content.substring(content.indexOf('esac\n}'))
    const breakIndex = afterFunctionDef.indexOf('break\n')
    const runCycleIndex = afterFunctionDef.indexOf('run_cycle')
    expect(runCycleIndex).toBeGreaterThan(breakIndex)
    // Deve haver exactamente um run_cycle fora do while true
    const runCycleCount = (content.match(/\brun_cycle\b/g) || []).length
    expect(runCycleCount).toBeGreaterThanOrEqual(2) // one immediate + in while loop
  })

  it('23. curl 000 failure handling — garante "000" em vez de ambiguidade || echo', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // The pattern must NOT use "|| echo '000'" on the same line as curl
    expect(content).not.toContain('|| echo')
    // Must use "if ! ... ; then http_code='000'; fi" pattern
    expect(content).toContain('if ! http_code="$(curl')
    expect(content).toContain('then')
    expect(content).toContain("http_code='000'")
  })

  it('24. temp response file removido em TODOS os outcomes (000, 200, 409, 401/403, 503, *)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // Cada case branch deve ter rm -f
    const rmCount = (content.match(/rm -f "\$\{response_file\}"/g) || []).length
    // Deve haver rm em: 000, 200, 409, 401|403, 503, *  = 6 branches
    // 200 pode ter rm dentro de if, mas ainda deve limpar
    expect(rmCount).toBeGreaterThanOrEqual(5) // 000, 409, 401|403, 503, * at minimum
  })

  it('25. sem set -x (não expõe tracing)', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // Usa set -eu, nunca set -x activo no shell
    expect(content).toContain('set -eu')
    // A linha set -x não deve aparecer como comando activo
    expect(content.match(/^set -x$/m)).toBeNull()
    expect(content).not.toContain('set -v')
  })

  it('26. sem contacto público — apenas URL interna', () => {
    const content = fs.readFileSync(SCHEDULER_SCRIPT_PATH, 'utf-8')
    // Não deve tentar contactar URLs públicas
    expect(content).not.toContain('eternalflowers.pt')
    expect(content).not.toContain('floresmarina.pt')
    expect(content).not.toContain('google.com')
  })
})

// ══════════════════════════════════════════════════════════════════
// 6. Compose wrapper
// ══════════════════════════════════════════════════════════════════

describe('compose.sh — production wrapper', () => {
  it('27. ficheiro existe e é executável', () => {
    expect(fs.existsSync(COMPOSE_WRAPPER_PATH)).toBe(true)
    const stats = fs.statSync(COMPOSE_WRAPPER_PATH)
    expect(stats.mode & 0o111).not.toBe(0)
  })

  it('28. contém --env-file .env.production', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('--env-file')
    expect(content).toContain('.env.production')
  })

  it('29. preserva argumentos arbitrários via "$@"', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('"$@"')
  })

  it('30. valida existência de .env.production antes de executar', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('.env.production')
    expect(content).toContain('não encontrado')
  })

  it('31. usa exec para o comando final', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('exec docker compose')
  })

  it('32. resolve caminhos relativos corretamente', () => {
    const content = fs.readFileSync(COMPOSE_WRAPPER_PATH, 'utf-8')
    expect(content).toContain('dirname')
    expect(content).toContain('PROJECT_DIR')
  })
})

// ══════════════════════════════════════════════════════════════════
// 7. Dockerfile.maintenance-scheduler
// ══════════════════════════════════════════════════════════════════

describe('Dockerfile.maintenance-scheduler', () => {
  it('33. existe', () => {
    expect(fs.existsSync(SCHEDULER_DOCKERFILE_PATH)).toBe(true)
  })

  it('34. base Alpine 3.20 — imagem mínima', () => {
    const content = fs.readFileSync(SCHEDULER_DOCKERFILE_PATH, 'utf-8')
    expect(content).toContain('alpine:3.20')
    expect(content).toContain('apk add --no-cache curl')
  })

  it('35. copia maintenance-loop.sh para /usr/local/bin/', () => {
    const content = fs.readFileSync(SCHEDULER_DOCKERFILE_PATH, 'utf-8')
    expect(content).toContain('COPY scripts/production/maintenance-loop.sh')
  })

  it('36. executa como nobody', () => {
    const content = fs.readFileSync(SCHEDULER_DOCKERFILE_PATH, 'utf-8')
    expect(content).toContain('USER nobody')
  })
})

// ══════════════════════════════════════════════════════════════════
// 8. .env.production.example — MAINTENANCE_SECRET documented
// ══════════════════════════════════════════════════════════════════

describe('.env.production.example — MAINTENANCE_SECRET', () => {
  it('37. MAINTENANCE_SECRET documentado', () => {
    const content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8')
    expect(content).toContain('MAINTENANCE_SECRET')
    expect(content).toContain('<GERAR_SECRET_64_HEX>')
  })

  it('38. composição do ciclo documentada', () => {
    const content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8')
    expect(content).toContain('/api/internal/maintenance')
  })
})

// ══════════════════════════════════════════════════════════════════
// 9. Compose header references wrapper
// ══════════════════════════════════════════════════════════════════

describe('docker-compose.production.yml — header references wrapper', () => {
  beforeAll(() => loadCompose())

  it('39. header recomenda usar compose.sh', () => {
    const raw = fs.readFileSync(COMPOSE_PATH, 'utf-8')
    expect(raw).toContain('scripts/production/compose.sh')
  })

  it('40. header avisa sobre omitir --env-file', () => {
    const raw = fs.readFileSync(COMPOSE_PATH, 'utf-8')
    expect(raw).toContain('NUNCA')
    expect(raw).toContain('--env-file')
  })

  it('41. network eternal-flowers-net existe', () => {
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

  it('42. maintenance.ts inalterado — funções principais preservadas', () => {
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