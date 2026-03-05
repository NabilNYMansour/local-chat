import type { ChatTransport, UIMessage, UIMessageChunk } from "ai"

type SendMessagesArgs = {
  trigger: "submit-message" | "regenerate-message"
  chatId: string
  messageId: string | undefined
  messages: UIMessage[]
  abortSignal: AbortSignal | undefined
  headers?: Record<string, string> | Headers
  body?: object
  metadata?: unknown
}

type OllamaChunk = {
  done?: boolean
  message?: {
    content?: string
  }
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim()
}

export class OllamaChatTransport implements ChatTransport<UIMessage> {
  private readonly model: string
  private readonly baseUrl: string

  constructor(model = "llama3.2", baseUrl = "http://localhost:11434") {
    this.model = model
    this.baseUrl = baseUrl
  }

  async sendMessages({ messages, abortSignal }: SendMessagesArgs): Promise<ReadableStream<UIMessageChunk>> {
    const ollamaMessages = messages.map((message) => ({
      role: message.role,
      content: getMessageText(message),
    }))

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: abortSignal,
      body: JSON.stringify({
        model: this.model,
        messages: ollamaMessages,
        stream: true,
      }),
    })

    if (!response.ok || !response.body) {
      throw new Error(`Ollama request failed: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const textId = crypto.randomUUID()
    let buffer = ""

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        controller.enqueue({ type: "start" })
        controller.enqueue({ type: "text-start", id: textId })

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) {
                continue
              }

              const chunk = JSON.parse(trimmed) as OllamaChunk
              const delta = chunk.message?.content ?? ""

              if (delta) {
                controller.enqueue({
                  type: "text-delta",
                  id: textId,
                  delta,
                })
              }

              if (chunk.done) {
                controller.enqueue({ type: "text-end", id: textId })
                controller.enqueue({ type: "finish", finishReason: "stop" })
                controller.close()
                return
              }
            }
          }

          controller.enqueue({ type: "text-end", id: textId })
          controller.enqueue({ type: "finish", finishReason: "stop" })
          controller.close()
        } catch (error) {
          if (abortSignal?.aborted) {
            controller.enqueue({ type: "abort", reason: "aborted-by-user" })
            controller.close()
            return
          }

          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      },
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }
}
