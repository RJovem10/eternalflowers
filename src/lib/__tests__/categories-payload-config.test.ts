/**
 * Testes para a configuração Payload da collection Categories.
 *
 * Como o buildConfig do Payload resolve lazy em ambiente de teste (não expõe
 * collections em runtime no vitest/jsdom), estes testes verificam o ficheiro
 * fonte directamente para garantir que a estrutura está correcta.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const configPath = path.resolve(__dirname, '../../payload.config.ts')
const source = fs.readFileSync(configPath, 'utf-8')

describe('Payload Config — Categories collection (source verification)', () => {
  it('field icon NÃO existe no schema Categories', () => {
    // Find the Categories collection fields block
    const match = source.match(/const Categories: CollectionConfig = \{[\s\S]*?^\}/m)
    expect(match).not.toBeNull()
    const block = match![0]

    // Verify icon field is not present
    expect(block).not.toContain("name: 'icon'")
    expect(block).not.toContain('Ícone / Emoji')
  })

  it('field image existe com relationTo media', () => {
    const match = source.match(/const Categories: CollectionConfig = \{[\s\S]*?^\}/m)
    const block = match![0]
    expect(block).toContain("name: 'image'")
    expect(block).toContain("type: 'upload'")
    expect(block).toContain("relationTo: 'media'")
  })

  it('image label === "Imagem de capa"', () => {
    expect(source).toContain("label: 'Imagem de capa'")
  })

  it('image NÃO é required', () => {
    const match = source.match(/const Categories: CollectionConfig = \{[\s\S]*?^\}/m)
    const block = match![0]
    // Ensure the image field has "required" only if explicitly set
    const imageFieldLines = block.split('\n').filter(l => l.includes("name: 'image'") || l.includes('Imagem de capa'))
    // Find the full image field block (name to next field or end)
    const lines = block.split('\n')
    let inImageField = false
    let imageFieldEnded = false
    let imageRequired = false
    for (const line of lines) {
      if (line.includes("name: 'image'") || line.includes('Imagem de capa')) {
        inImageField = true
      }
      if (inImageField && !imageFieldEnded) {
        // Check for required
        if (line.includes('required:')) {
          // If we find required: true in the image field, that's wrong
          // If we find required: on a different field, it's fine
          if (line.includes('required: true')) {
            imageRequired = true
          }
        }
        // Field ends when we encounter next field name or close of fields array
        if (line.includes("name: '") && !line.includes("name: 'image'")) {
          imageFieldEnded = true
        }
        if (line.trim().startsWith('},') || line.trim() === ']') {
          imageFieldEnded = true
        }
      }
    }
    expect(imageFieldEnded).toBe(true)
    // image should NOT be required
    expect(imageRequired).toBe(false)
  })
})
