/**
 * types.ts — Tipos partilhados para o chat assistente de catálogo
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  imageData?: string // base64 data URL
  id?: string
}