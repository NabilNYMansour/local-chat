import { useEffect, useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { Moon, SendHorizontal, Square, Sun } from "lucide-react"

import { Button } from "./components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card"
import { Textarea } from "./components/ui/textarea"
import { MockChatTransport } from "./lib/mock-chat-transport"

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim()
}

const starterMessages: UIMessage[] = [
  {
    id: "starter-assistant-message",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Chat UI is ready. This is frontend-only with a mock AI transport for now.",
      },
    ],
  },
]

type Theme = "light" | "dark"

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark"
  }

  const storedTheme = window.localStorage.getItem("theme")
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme
  }

  return "dark"
}

function App() {
  const [input, setInput] = useState("")
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const transport = useMemo(() => new MockChatTransport(), [])
  const { messages, sendMessage, status, stop, error } = useChat({
    transport,
    messages: starterMessages,
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    window.localStorage.setItem("theme", theme)
  }, [theme])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedInput = input.trim()

    if (!trimmedInput || isStreaming) {
      return
    }

    setInput("")
    await sendMessage({ text: trimmedInput })
  }

  return (
    <main className="bg-muted/30 flex min-h-svh items-center justify-center p-4 md:p-8">
      <Card className="h-[80svh] w-full max-w-3xl gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Local Chat</CardTitle>
              <CardDescription>
                Frontend-only chat powered by AI SDK v6 hook + mock transport.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
            {messages.map((message) => {
              const text = getTextFromMessage(message)

              if (!text) {
                return null
              }

              const isUser = message.role === "user"

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {text}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>

        <CardFooter className="border-t py-4">
          <form className="flex w-full flex-col gap-2" onSubmit={handleSubmit}>
            <Textarea
              placeholder="Ask anything..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void handleSubmit(event)
                }
              }}
              rows={2}
              disabled={isStreaming}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                Enter to send, Shift+Enter for newline.
              </p>
              {isStreaming ? (
                <Button type="button" variant="secondary" onClick={stop}>
                  <Square className="size-4" />
                  Stop
                </Button>
              ) : (
                <Button type="submit" disabled={!input.trim()}>
                  <SendHorizontal className="size-4" />
                  Send
                </Button>
              )}
            </div>
            {error ? (
              <p className="text-destructive text-xs">{error.message}</p>
            ) : null}
          </form>
        </CardFooter>
      </Card>
    </main>
  )
}

export default App