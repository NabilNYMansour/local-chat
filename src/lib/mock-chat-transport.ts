import type { ChatTransport, UIMessage, UIMessageChunk } from "ai"

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim()
}

function buildMockReply(input: string): string {
  if (!input) {
    return "Tell me what you want to build, and I will help you sketch the UI and API next steps."
  }

  const lower = input.toLowerCase()

  if (lower.includes("hello") || lower.includes("hi")) {
    return "Hey! I am your frontend chat stub running fully in the browser."
  }

  if (lower.includes("backend") || lower.includes("api")) {
    return "The frontend is ready. When you are ready for backend, we can connect this to /api/chat with DefaultChatTransport."
  }

  return `You said: "${input}". This is a mock AI response from a local transport so we can iterate on UI first.`
}

export class MockChatTransport implements ChatTransport<UIMessage> {
  async sendMessages({
    messages,
    abortSignal,
  }: {
    trigger: "submit-message" | "regenerate-message"
    chatId: string
    messageId: string | undefined
    messages: UIMessage[]
    abortSignal: AbortSignal | undefined
    headers?: Record<string, string> | Headers
    body?: object
    metadata?: unknown
  }): Promise<ReadableStream<UIMessageChunk>> {
    const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user")
    const reply = buildMockReply(lastUserMessage ? getMessageText(lastUserMessage) : "")
    const textId = crypto.randomUUID()

    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "start" })
        controller.enqueue({ type: "text-start", id: textId })

        let index = 0
        const interval = window.setInterval(() => {
          if (abortSignal?.aborted) {
            window.clearInterval(interval)
            controller.enqueue({ type: "abort", reason: "aborted-by-user" })
            controller.close()
            return
          }

          if (index >= reply.length) {
            window.clearInterval(interval)
            controller.enqueue({ type: "text-end", id: textId })
            controller.enqueue({ type: "finish", finishReason: "stop" })
            controller.close()
            return
          }

          controller.enqueue({ type: "text-delta", id: textId, delta: reply[index] })
          index += 1
        }, 18)
      },
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }
}
