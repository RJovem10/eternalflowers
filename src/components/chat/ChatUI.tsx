'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from './types'

interface ChatUIProps {
  initialMessages?: ChatMessage[]
}

export default function ChatUI({ initialMessages = [] }: ChatUIProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async () => {
    const text = input.trim()
    if (!text && !pendingImage) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: text || (pendingImage ? '[Enviou uma fotografia]' : ''),
      id: `msg-${Date.now()}`,
    }

    if (pendingImage) {
      userMessage.imageData = pendingImage
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setPendingImage(null)
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        messages: [...messages, userMessage].map(m => ({
          role: m.role,
          content: m.content,
          imageData: m.imageData,
        })),
      }

      const res = await fetch('/api/catalog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error?.message || `Erro ${res.status}`)
      }

      const data = await res.json()
      if (data.success && data.data?.messages) {
        setMessages(data.data.messages)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao comunicar com o assistente.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (file: File | null) => {
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Formato não suportado. Aceita: JPEG, PNG, WebP.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Imagem demasiado grande. Máximo 10 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setPendingImage(result)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const removePendingImage = () => setPendingImage(null)

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {messages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-stone-400">
            <div className="text-center max-w-md">
              <p className="text-lg font-medium text-stone-500 mb-2">Assistente de Catálogo</p>
              <p className="text-sm">
                Olá! Sou o teu assistente de catálogo da Eternal Flowers.
                Podes pedir-me para consultar, criar ou editar produtos, categorias e coleções.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-amber-800 text-white'
                  : 'bg-stone-100 text-stone-800 border border-stone-200'
              }`}
            >
              {msg.imageData && (
                <div className="mb-2">
                  <img
                    src={msg.imageData}
                    alt="Fotografia anexada"
                    className="max-w-[200px] rounded border border-stone-300"
                  />
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-stone-100 text-stone-500 rounded-lg px-4 py-3 border border-stone-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm border border-red-200">
              {error}
            </div>
          </div>
        )}

        {dragOver && (
          <div className="absolute inset-0 bg-amber-50/80 flex items-center justify-center rounded-lg border-2 border-dashed border-amber-400">
            <p className="text-amber-800 font-medium">Largar fotografia aqui</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-4 py-2 border-t border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <img src={pendingImage} alt="Pré-visualização" className="h-12 w-12 object-cover rounded border" />
            <span className="text-xs text-stone-500">Fotografia pronta para enviar</span>
            <button
              onClick={removePendingImage}
              className="ml-auto text-stone-400 hover:text-red-600 text-sm"
            >
              Remover
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-stone-200 px-4 py-3 bg-white">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-stone-400 hover:text-amber-700 rounded-lg hover:bg-stone-100 transition-colors"
            title="Anexar fotografia"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreve a tua mensagem..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            disabled={loading}
          />

          <button
            onClick={handleSend}
            disabled={loading || (!input.trim() && !pendingImage)}
            className="px-4 py-2 bg-amber-800 text-white rounded-lg text-sm font-medium hover:bg-amber-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}