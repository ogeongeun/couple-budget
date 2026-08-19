"use client";

import BottomNavigation from "@/components/BottomNavigation";

import "./ai.css";

const suggestions = [
  "이번 달 소비를 요약해줘",
  "이번 주에 얼마 더 써도 돼?",
  "가장 많이 쓴 내용이 뭐야?",
  "우리 둘의 소비를 비교해줘",
];

export default function AiPage() {
  return (
    <main className="ai-page">
      <header className="ai-header">
        <span aria-hidden="true">✨</span>
        <div>
          <h1>AI 소비 도우미</h1>
          <p>우리의 소비를 함께 살펴봐요</p>
        </div>
      </header>

      <section className="ai-welcome">
        <div className="ai-avatar" aria-hidden="true">AI</div>
        <div className="ai-bubble">
          <strong>무엇이 궁금한가요?</strong>
          <p>소비 기록과 예산을 바탕으로 답해드릴게요.</p>
        </div>
      </section>

      <section className="ai-suggestions" aria-label="추천 질문">
        <h2>이렇게 물어보세요</h2>
        <div>
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion}>{suggestion}</button>
          ))}
        </div>
      </section>

      <div className="ai-connection-notice">AI 연결을 준비하고 있어요.</div>

      <form className="ai-input" onSubmit={(event) => event.preventDefault()}>
        <input type="text" placeholder="AI에게 물어보세요" aria-label="AI에게 질문" disabled />
        <button type="submit" disabled aria-label="질문 보내기">↑</button>
      </form>

      <BottomNavigation active="ai" />
    </main>
  );
}
