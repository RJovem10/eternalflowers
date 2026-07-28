export const migrations: {
  up: () => Promise<void>
  down: () => Promise<void>
  name: string
}[] = []