"use client";

import { FormEvent, useState } from "react";

import BottomNavigation from "@/components/BottomNavigation";
import "./ai.css";

type ChatMessage = { role: "user" | "assistant"; content: string };

const suggestions = [
  "이번 달 소비를 요약해줘",
  "이번 주에 얼마 더 써도 돼?",
  "가장 많이 쓴 내용이 뭐야?",
  "우리 둘의 소비를 비교해줘",
];

export default function AiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const result = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !result.answer) {
        throw new Error(result.error || "AI 답변을 받지 못했어요.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer as string },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "AI 연결 중 문제가 생겼어요.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(input);
  };

  return (
    <main className="ai-page">
      <header className="ai-header">
        <span aria-hidden="true">✨</span>
        <div><h1>AI 소비 도우미</h1><p>우리의 소비를 함께 살펴봐요</p></div>
      </header>

      <section className="ai-chat" aria-live="polite">
        <div className="ai-welcome">
          <div className="ai-avatar" aria-hidden="true">AI</div>
          <div className="ai-bubble">
            <strong>무엇이 궁금한가요?</strong>
            <p>이번 달 소비와 소득을 바탕으로 답해드릴게요.</p>
          </div>
        </div>

        {messages.map((message, index) => (
          <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
            {message.role === "assistant" && <div className="ai-avatar">AI</div>}
            <p>{message.content}</p>
          </div>
        ))}

        {loading && (
          <div className="ai-message assistant">
            <div className="ai-avatar">AI</div>
            <p className="ai-thinking">소비 기록을 살펴보고 있어요…</p>
          </div>
        )}
      </section>

      {messages.length === 0 && (
        <section className="ai-suggestions" aria-label="추천 질문">
          <h2>이렇게 물어보세요</h2>
          <div>
            {suggestions.map((suggestion) => (
              <button type="button" onClick={() => void sendQuestion(suggestion)} key={suggestion}>
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <div className="ai-error" role="alert">{error}</div>}

      <form className="ai-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="AI에게 물어보세요"
          aria-label="AI에게 질문"
          maxLength={500}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label="질문 보내기">↑</button>
      </form>

      <BottomNavigation active="ai" />
    </main>
  );
}
