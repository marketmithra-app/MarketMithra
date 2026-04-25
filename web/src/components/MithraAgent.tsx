"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export default function MithraAgent() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [pageContext, setPageContext] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Update page context when pathname changes
  useEffect(() => {
    setPageContext(pathname ?? "");
  }, [pathname]);

  // Listen for external open trigger (from MithraPopAgent)
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
      setHasOpened(true);
    }
    window.addEventListener("mithra:open", handleOpen);
    return () => window.removeEventListener("mithra:open", handleOpen);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function handleOpenToggle() {
    const next = !open;
    setOpen(next);
    if (next) setHasOpened(true);
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading || rateLimited) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          messages: newMessages,
          page_context: pageContext,
        }),
      });
      const data = await res.json();
      if (data.rate_limited === true) {
        setRateLimited(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "We've had a great chat! Refresh the page to start fresh. 😊",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Please try again in a moment!",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const SUGGESTION_CHIPS = [
    "How does the signal work?",
    "What is Panic-O-Meter?",
    "Explain Stock DNA",
  ];

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[480px] flex flex-col
            bg-white dark:bg-[#0d0f18]
            border border-slate-200 dark:border-slate-800
            rounded-2xl shadow-2xl shadow-slate-900/20
            transition-all duration-150 ease-out
            animate-in fade-in slide-in-from-bottom-4"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 p-3 rounded-t-2xl flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/90 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-slate-900">M</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm leading-tight">Mithra</p>
              <p className="text-[10px] text-slate-800 opacity-80 leading-tight">
                MarketMithra Assistant
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenToggle}
              aria-label="Close chat"
              className="text-slate-900 opacity-70 hover:opacity-100 transition-opacity p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">
                    👋 Hi! I&apos;m Mithra, your MarketMithra guide.
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    I can help you understand signals, indicators, and how the
                    platform works.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleSend(chip)}
                        className="rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300 text-xs px-3 py-1.5 hover:bg-amber-400/20 cursor-pointer transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] text-sm p-3 ${
                    msg.role === "user"
                      ? "ml-8 bg-amber-400 text-slate-900 rounded-2xl rounded-br-sm"
                      : "mr-8 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="mr-8 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-sm p-3">
                  <span className="inline-flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={rateLimited ? "Session ended" : "Ask Mithra..."}
              disabled={loading || rateLimited}
              className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2 text-sm outline-none focus:border-amber-400 transition disabled:opacity-50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || input.trim() === "" || rateLimited}
              aria-label="Send message"
              className="rounded-full bg-amber-400 p-2 text-slate-900 hover:bg-amber-300 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            </button>
          </div>

          {/* Disclaimer */}
          <p className="text-[9px] text-slate-400 text-center py-1 px-3">
            Educational tool · not investment advice
          </p>
        </div>
      )}

      {/* Floating bubble button */}
      <button
        type="button"
        onClick={handleOpenToggle}
        aria-label={open ? "Close Mithra assistant" : "Open Mithra assistant"}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      >
        {/* Pulse ring — only shown before first open */}
        {!hasOpened && (
          <span className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping" />
        )}
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <span className="text-xl font-black text-slate-900 select-none">M</span>
        )}
      </button>
    </>
  );
}
