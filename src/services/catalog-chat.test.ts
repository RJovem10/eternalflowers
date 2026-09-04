/**
 * Testes para catalog-chat service — tool schemas and execution
 *
 * Testa:
 *   - uploadMedia existe na allowlist
 *   - product tool contém images, productionLeadTime, canShareShippingPackage
 *   - story é objeto com locales
 *   - 17 tools no total
 *   - nenhum DELETE disponível
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('catalog-chat service — tool schemas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploadMedia tool existe com zero required params', async () => {
    const { CATALOG_TOOLS } = await import('@/services/catalog-chat')
    const uploadTool = (CATALOG_TOOLS as any[]).find((t: any) => t.function.name === 'uploadMedia')
    expect(uploadTool).toBeDefined()
    expect(uploadTool.function.parameters.required).toBeUndefined()
  })

  it('product tools contêm images, productionLeadTime, canShareShippingPackage', async () => {
    const { CATALOG_TOOLS } = await import('@/services/catalog-chat')
    const tools = CATALOG_TOOLS as any[]

    const createProduct = tools.find((t: any) => t.function.name === 'createProduct')
    expect(createProduct).toBeDefined()
    const props = createProduct.function.parameters.properties
    expect(props.images).toBeDefined()
    expect(props.images.type).toBe('array')
    expect(props.images.items.properties.image).toBeDefined()
    expect(props.productionLeadTime).toBeDefined()
    expect(props.productionLeadTime.type).toBe('integer')
    expect(props.canShareShippingPackage).toBeDefined()
    expect(props.canShareShippingPackage.type).toBe('boolean')

    const updateProduct = tools.find((t: any) => t.function.name === 'updateProduct')
    expect(updateProduct).toBeDefined()
    const updateProps = updateProduct.function.parameters.properties
    expect(updateProps.images).toBeDefined()
    expect(updateProps.productionLeadTime).toBeDefined()
    expect(updateProps.canShareShippingPackage).toBeDefined()
  })

  it('story nos product tools é objeto com locales', async () => {
    const { CATALOG_TOOLS } = await import('@/services/catalog-chat')
    const tools = CATALOG_TOOLS as any[]
    const createProduct = tools.find((t: any) => t.function.name === 'createProduct')
    const story = createProduct.function.parameters.properties.story
    expect(story).toBeDefined()
    expect(story.type).toBe('object')
    expect(story.properties.pt).toBeDefined()
    expect(story.properties.en).toBeDefined()
    expect(story.properties.es).toBeDefined()
    expect(story.properties.it).toBeDefined()
    expect(story.properties.de).toBeDefined()
  })

  it('nenhum DELETE disponível nas tools', async () => {
    const { CATALOG_TOOLS } = await import('@/services/catalog-chat')
    const tools = CATALOG_TOOLS as any[]
    const deleteTools = tools.filter((t: any) =>
      t.function.name.toLowerCase().includes('delete')
    )
    expect(deleteTools).toHaveLength(0)
  })

  it('15 tools no total', async () => {
    const { CATALOG_TOOLS } = await import('@/services/catalog-chat')
    expect(CATALOG_TOOLS).toHaveLength(15)
  })
})