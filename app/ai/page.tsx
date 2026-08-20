"use client";

import { FormEvent, useState } from "react";

import BottomNavigation from "@/components/BottomNavigation";
import "./ai.css";

type ChartData = {
  kind: "show_chart";
  title: string;
  points: { label: string; value: number }[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  chart?: ChartData;
};

type ExpenseDraft = {
  kind: "add_expense";
  amount: number;
  category: string;
  title: string;
  expenseDate: string;
};

const suggestions = [
  "내 이번 달 소비를 요약해줘",
  "내가 이번 주에 얼마 더 써도 돼?",
  "내 이번 달 일일 소비를 그래프로 보여줘",
  "내 소비에서 줄이기 좋은 항목을 알려줘",
];

function SpendingChart({ chart }: { chart: ChartData }) {
  const [expanded, setExpanded] = useState(false);
  const values = chart.points.map((point) => point.value);
  const minimum = Math.min(...values, 0);
  const maximum = Math.max(...values, 1);
  const range = Math.max(maximum - minimum, 1);
  const chartWidth = 320;
  const chartHeight = 150;
  const padding = { top: 24, right: 12, bottom: 28, left: 12 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const coordinates = chart.points.map((point, index) => ({
    ...point,
    x:
      padding.left +
      (chart.points.length <= 1 ? plotWidth / 2 : (index / (chart.points.length - 1)) * plotWidth),
    y: padding.top + ((maximum - point.value) / range) * plotHeight,
  }));
  const pointString = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(chart.points.length / 6));

  const graph = (
    <svg className="ai-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`${chart.title} 선 그래프`}>
      {[0, 0.5, 1].map((ratio) => (
        <line key={ratio} x1={padding.left} x2={chartWidth - padding.right} y1={padding.top + plotHeight * ratio} y2={padding.top + plotHeight * ratio} className="ai-chart-grid" />
      ))}
      {coordinates.length > 1 && (
        <polygon points={`${coordinates[0].x},${padding.top + plotHeight} ${pointString} ${coordinates.at(-1)?.x},${padding.top + plotHeight}`} className="ai-chart-area" />
      )}
      <polyline points={pointString} className="ai-chart-line" />
      {coordinates.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="3.5" className={point.value < 0 ? "ai-chart-dot negative" : "ai-chart-dot"}>
            <title>{point.label} · {point.value.toLocaleString("ko-KR")}원</title>
          </circle>
          {(index % labelStep === 0 || index === coordinates.length - 1) && (
            <text x={point.x} y={chartHeight - 8} textAnchor="middle" className="ai-chart-label">{point.label}</text>
          )}
        </g>
      ))}
      {coordinates.length === 1 && <text x={coordinates[0].x} y={coordinates[0].y - 9} textAnchor="middle" className="ai-chart-amount">{coordinates[0].value.toLocaleString("ko-KR")}원</text>}
    </svg>
  );

  return (
    <section className="ai-chart" aria-label={chart.title}>
      <header><strong>{chart.title}</strong><span>눌러서 크게 보기</span></header>
      {chart.points.length === 0 ? (
        <p className="ai-chart-empty">해당 기간의 기록이 없어요.</p>
      ) : (
        <button type="button" className="ai-chart-open" onClick={() => setExpanded(true)} aria-label={`${chart.title} 크게 보기`}>
          {graph}
        </button>
      )}
      {expanded && (
        <div className="ai-chart-modal" role="dialog" aria-modal="true" aria-label={`${chart.title} 확대 그래프`} onClick={() => setExpanded(false)}>
          <div className="ai-chart-expanded" onClick={(event) => event.stopPropagation()}>
            <header><div><strong>{chart.title}</strong><span>실제 기록 기준</span></div><button type="button" onClick={() => setExpanded(false)} aria-label="확대 그래프 닫기">×</button></header>
            {graph}
            <div className="ai-chart-legend"><span>최고 {maximum.toLocaleString("ko-KR")}원</span><span>전체 {chart.points.reduce((sum, point) => sum + point.value, 0).toLocaleString("ko-KR")}원</span></div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingExpense, setPendingExpense] = useState<ExpenseDraft | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);

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
    setPendingExpense(null);
    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const result = (await response.json()) as {
        answer?: string;
        action?: ExpenseDraft | ChartData | null;
        error?: string;
      };

      if (!response.ok || !result.answer) {
        throw new Error(result.error || "AI 답변을 받지 못했어요.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer as string,
          chart: result.action?.kind === "show_chart" ? result.action : undefined,
        },
      ]);
      setPendingExpense(result.action?.kind === "add_expense" ? result.action : null);
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

  const savePendingExpense = async () => {
    if (!pendingExpense || savingExpense) return;

    setSavingExpense(true);
    setError("");

    try {
      const response = await fetch("/api/ai/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingExpense),
      });
      const result = (await response.json()) as { message?: string; expenseId?: string; error?: string };

      if (!response.ok || !result.message) {
        throw new Error(result.error || "소비 기록을 저장하지 못했어요.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.message as string },
      ]);
      if (result.expenseId) {
        void fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expenseId: result.expenseId }),
        }).catch((pushError) => console.error("푸시 알림 요청 오류:", pushError));
      }
      setPendingExpense(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "소비 기록을 저장하지 못했어요.",
      );
    } finally {
      setSavingExpense(false);
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
          <div className={`ai-message-wrap ${message.role}`} key={`${message.role}-${index}`}>
            <div className={`ai-message ${message.role}`}>
              {message.role === "assistant" && <div className="ai-avatar">AI</div>}
              <p>{message.content}</p>
            </div>
            {message.chart && <SpendingChart chart={message.chart} />}
          </div>
        ))}

        {loading && (
          <div className="ai-message assistant">
            <div className="ai-avatar">AI</div>
            <p className="ai-thinking">소비 기록을 살펴보고 있어요…</p>
          </div>
        )}
      </section>

      {pendingExpense && (
        <section className="ai-expense-confirm" aria-label="소비 추가 확인">
          <header>
            <strong>이 소비를 추가할까요?</strong>
            <span>확인 후에만 저장돼요</span>
          </header>
          <dl>
            <div><dt>내용</dt><dd>{pendingExpense.title || pendingExpense.category}</dd></div>
            <div><dt>금액</dt><dd>{pendingExpense.amount.toLocaleString("ko-KR")}원</dd></div>
            <div><dt>카테고리</dt><dd>{pendingExpense.category}</dd></div>
            <div><dt>날짜</dt><dd>{pendingExpense.expenseDate}</dd></div>
          </dl>
          <div className="ai-expense-actions">
            <button type="button" onClick={() => setPendingExpense(null)} disabled={savingExpense}>
              취소
            </button>
            <button type="button" onClick={() => void savePendingExpense()} disabled={savingExpense}>
              {savingExpense ? "추가 중…" : "추가하기"}
            </button>
          </div>
        </section>
      )}

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
