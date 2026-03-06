import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "./components/ai-elements/conversation"
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
import { OllamaChatTransport } from "./lib/ollama-chat-transport"
import { Check, Copy, Github, MoonIcon, RotateCcwIcon, SquareIcon, SunIcon } from "lucide-react"

const STORAGE_KEY = "local-chat-conversation"

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim()
}

function loadStoredMessages(): UIMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is UIMessage =>
        m != null &&
        typeof m === "object" &&
        typeof (m as UIMessage).id === "string" &&
        ((m as UIMessage).role === "user" || (m as UIMessage).role === "assistant" || (m as UIMessage).role === "system") &&
        Array.isArray((m as UIMessage).parts) &&
        (m as UIMessage).parts.every(
          (p: unknown) =>
            p != null &&
            typeof p === "object" &&
            (p as { type: string }).type === "text" &&
            typeof (p as { text: string }).text === "string"
        )
    ) as UIMessage[]
  } catch {
    return []
  }
}

function saveMessages(messages: UIMessage[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // ignore quota / privacy errors
  }
}

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
  const [copiedBlock, setCopiedBlock] = useState<"setup" | "killall" | "404" | null>(null)
  const ollamaModel = "llama3.2"
  const transport = useMemo(() => new OllamaChatTransport(ollamaModel), [ollamaModel])
  const { messages, sendMessage, setMessages, status, stop, error, clearError } = useChat({
    transport,
  })
  const ollamaAllowedOrigins =
    typeof window !== "undefined"
      ? window.location.hostname === "localhost"
        ? "http://localhost:5173"
        : window.location.origin
      : "http://localhost:5173"
  const ollamaSetupCommands = `OLLAMA_ORIGINS="${ollamaAllowedOrigins}" ollama serve\nollama pull ${ollamaModel}  # or other ollama models`
  const hasLoadedFromStorage = useRef(false)

  const isStreaming = status === "streaming" || status === "submitted"

  // Load conversation from localStorage on mount
  useEffect(() => {
    if (hasLoadedFromStorage.current) return
    hasLoadedFromStorage.current = true
    const stored = loadStoredMessages()
    if (stored.length > 0) {
      setMessages(stored)
    }
  }, [setMessages])

  // Persist conversation whenever messages change
  useEffect(() => {
    saveMessages(messages)
  }, [messages])

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

  const handleResetConversation = () => {
    if (isStreaming) {
      stop()
    }

    setInput("")
    setMessages([])
    clearError()
  }

  const handleCopyCode = async (text: string, block: "setup" | "killall" | "404") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedBlock(block)
      window.setTimeout(() => setCopiedBlock(null), 1500)
    } catch {
      setCopiedBlock(null)
    }
  }

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-4">
      <Card className="flex h-[82svh] w-full max-w-3xl flex-col gap-0 py-0">
        <CardHeader className="border-b py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>Local Chat</CardTitle>
              <CardDescription>
                Frontend chat powered by <a href="https://ai-sdk.dev/" className="text-primary hover:underline" target="_blank">AI SDK v6</a> and <a href="https://ollama.com" className="text-primary hover:underline" target="_blank">Ollama</a>
              </CardDescription>
              <div className="bg-muted/40 text-muted-foreground space-y-3 rounded-md border px-3 py-2 text-xs">
                <p className="mb-0.5">Setup commands</p>
                <div className="relative">
                  <pre className="bg-background overflow-x-auto rounded border p-2.5 pr-9 text-[11px] leading-relaxed">
                    <code className="block space-y-0.5">
                      <span className="block">
                        <span className="text-amber-300">OLLAMA_ORIGINS=</span>
                        <span className="text-violet-300">"{ollamaAllowedOrigins}"</span>
                        <span className="text-sky-300"> </span>
                        <span className="text-emerald-400">ollama</span>
                        <span className="text-sky-300"> serve</span>
                      </span>
                    </code>
                  </pre>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => void handleCopyCode(ollamaSetupCommands, "setup")}
                    aria-label="Copy setup commands"
                  >
                    {copiedBlock === "setup" ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="mb-0.5">Port in use?</p>
                    <div className="relative">
                      <pre className="bg-background overflow-x-auto rounded border p-2.5 pr-9 text-[11px] leading-relaxed">
                        <code className="block">
                          <span className="text-sky-300">killall</span>
                          <span className="text-sky-300"> </span>
                          <span className="text-emerald-400">ollama</span>
                        </code>
                      </pre>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => void handleCopyCode("killall ollama", "killall")}
                        aria-label="Copy killall command"
                      >
                        {copiedBlock === "killall" ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-0.5">Getting 404?</p>
                    <div className="relative">
                      <pre className="bg-background overflow-x-auto rounded border p-2.5 pr-9 text-[11px] leading-relaxed">
                        <code className="block">
                          <span className="text-emerald-400">ollama</span>
                          <span className="text-sky-300"> pull</span>
                          <span className="text-violet-300"> {ollamaModel}</span>
                          <span className="text-muted-foreground">  # or other ollama models</span>
                        </code>
                      </pre>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => void handleCopyCode(`ollama pull ${ollamaModel}  # or other ollama models`, "404")}
                        aria-label="Copy ollama pull command"
                      >
                        {copiedBlock === "404" ? (
                          <Check className="size-3.5" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" asChild aria-label="GitHub repository">
                <a
                  href="https://github.com/NabilNYMansour/local-chat"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-4" />
                </a>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <SunIcon className="size-4" />
                ) : (
                  <MoonIcon className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex min-h-0 flex-col p-0">
          <Conversation className="min-h-0">
            <ConversationContent className="gap-4 px-4 py-4">
              {messages.length === 0 ? (
                <ConversationEmptyState description="" />
              ) : null}
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
                      className={`max-w-[85%] rounded-md border px-3 py-2 text-sm whitespace-pre-wrap ${isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                        }`}
                    >
                      {text}
                    </div>
                  </div>
                )
              })}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetConversation}
                  disabled={messages.length === 0 && !input.trim()}
                >
                  <RotateCcwIcon className="size-4" />
                  Reset
                </Button>
                {isStreaming ? (
                  <Button type="button" variant="secondary" onClick={stop}>
                    <SquareIcon className="size-4" />
                    Stop
                  </Button>
                ) : (
                  <Button type="submit" disabled={!input.trim()}>
                    Send
                  </Button>
                )}
              </div>
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