"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./calendar.css";
import BottomNavigation from "@/components/BottomNavigation";
type ExpenseItem = {
  id: number;
  date: string;
  title: string;
  category: "식비" | "교통" | "쇼핑";
  amount: number;
  time: string;
  icon: string;
  settlement?: "정산전" | "정산완료";
};

const expenses: ExpenseItem[] = [
  {
    id: 1,
    date: "2026-07-30",
    title: "스타벅스",
    category: "식비",
    amount: 6000,
    time: "오전 10:23",
    icon: "🥤",
    settlement: "정산전",
  },
  {
    id: 2,
    date: "2026-07-30",
    title: "버스 이용",
    category: "교통",
    amount: 1500,
    time: "오전 08:15",
    icon: "🚌",
  },
  {
    id: 3,
    date: "2026-07-30",
    title: "올리브영",
    category: "쇼핑",
    amount: 14500,
    time: "오후 01:42",
    icon: "🛍️",
  },
];

const dayAmounts: Record<number, number> = {
  1: 18000,
  2: 12000,
  7: 25000,
  9: 8000,
  10: 15000,
  14: 21000,
  15: 13000,
  16: 9500,
  18: 16000,
  21: 11500,
  22: 17000,
  23: 8500,
  24: 14000,
  27: 54000,
  28: 15900,
  29: 18500,
  30: 22000,
};

const categoryColor: Record<ExpenseItem["category"], string> = {
  식비: "#50b979",
  교통: "#70a7ee",
  쇼핑: "#a77be0",
};

export default function CalendarPage() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(30);
  const [detailOpen, setDetailOpen] = useState(false);

  const calendarDays = useMemo(() => {
    const previous = [29, 30];
    const current = Array.from({ length: 31 }, (_, index) => index + 1);
    const next = [1, 2];

    return [
      ...previous.map((day) => ({ day, current: false })),
      ...current.map((day) => ({ day, current: true })),
      ...next.map((day) => ({ day, current: false })),
    ];
  }, []);

  const selectedExpenses = expenses.filter(
    (item) => item.date === `2026-07-${String(selectedDay).padStart(2, "0")}`,
  );

  const selectedTotal = selectedExpenses.reduce(
    (total, item) => total + item.amount,
    0,
  );

  const handleDayClick = (day: number, current: boolean) => {
    if (!current) return;

    setSelectedDay(day);
    setDetailOpen(true);
  };

  if (detailOpen) {
    return (
      <DayDetail
        day={selectedDay}
        expenses={selectedExpenses}
        total={selectedTotal}
        onBack={() => setDetailOpen(false)}
      />
    );
  }

  return (
    <main className="calendar-page">
      <header className="calendar-header">
        <button type="button" className="menu-button">
          ☰
        </button>

        <div className="calendar-title">
          <strong>캘린더</strong>
          <button type="button">7월⌄</button>
        </div>

        <button type="button" className="header-calendar-icon">
          🗓️
        </button>
      </header>

      <section className="calendar-hero">
        <div>
          <h2>7월 한눈에 보기 🐶</h2>
          <p>
            하루하루 기록하며
            <br />
            소비 습관을 키워가요.
          </p>
        </div>

        <Image
          src="/chorong-v2.png"
          alt="초롱이"
          width={150}
          height={150}
          priority
        />
      </section>

      <section className="monthly-summary">
        <SummaryItem label="총소비" value="684,000원" active />
        <SummaryItem label="일평균소비" value="22,067원" />
        <SummaryItem label="최고 소비" value="54,000원" sub="(7/27)" coral />
        <SummaryItem label="기록한 날" value="24일" />
      </section>

      <section className="calendar-area">
        <div className="weekday-row">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
            <span
              key={day}
              className={
                index === 0 ? "sunday" : index === 6 ? "saturday" : ""
              }
            >
              {day}
            </span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((item, index) => {
            const amount = item.current ? dayAmounts[item.day] : undefined;
            const selected = item.current && item.day === selectedDay;
            const weekday = index % 7;

            return (
              <button
                type="button"
                key={`${item.current ? "current" : "other"}-${index}`}
                className={[
                  "calendar-cell",
                  !item.current ? "muted" : "",
                  selected ? "selected" : "",
                  weekday === 0 ? "sunday" : "",
                  weekday === 6 ? "saturday" : "",
                ].join(" ")}
                onClick={() => handleDayClick(item.day, item.current)}
              >
                <span className="day-number">{item.day}</span>

                {amount && (
                  <>
                    <span
                      className="day-dot"
                      style={{
                        background:
                          item.day === 15 || item.day === 16
                            ? "#8061b4"
                            : item.day === 18
                              ? "#b47a39"
                              : "#58ad73",
                      }}
                    />
                    <small>{amount.toLocaleString("ko-KR")}</small>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="selected-day-card">
        <div className="selected-day-heading">
          <h2>7월 {selectedDay}일 (수)</h2>
          <strong>총 {selectedTotal.toLocaleString("ko-KR")}원</strong>
        </div>

        <ExpenseList expenses={selectedExpenses} />

        <button
          type="button"
          className="calendar-add-button"
          onClick={() => router.push("/")}
        >
          ＋ 소비 기록하기
        </button>
      </section>

     <BottomNavigation active="calendar" />
    </main>
  );
}

function SummaryItem({
  label,
  value,
  sub,
  active,
  coral,
}: {
  label: string;
  value: string;
  sub?: string;
  active?: boolean;
  coral?: boolean;
}) {
  return (
    <div className={active ? "summary-item active" : "summary-item"}>
      <span>{label}</span>
      <strong className={coral ? "coral" : ""}>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function ExpenseList({ expenses }: { expenses: ExpenseItem[] }) {
  if (expenses.length === 0) {
    return <p className="empty-expense">이 날짜에는 기록이 없어요.</p>;
  }

  return (
    <div className="calendar-expense-list">
      {expenses.map((item) => (
        <article className="calendar-expense-item" key={item.id}>
          <div
            className="expense-icon"
            style={{
              background: `${categoryColor[item.category]}1e`,
            }}
          >
            {item.icon}
          </div>

          <div className="expense-info">
            <small>{item.category}</small>
            <strong>{item.title}</strong>
            <span>{item.category} · 나혼자</span>
          </div>

          <div className="expense-price">
            <strong>{item.amount.toLocaleString("ko-KR")}원</strong>
            {item.settlement && <span>{item.settlement}</span>}
          </div>

          <span className="expense-arrow">›</span>
        </article>
      ))}
    </div>
  );
}

function DayDetail({
  day,
  expenses,
  total,
  onBack,
}: {
  day: number;
  expenses: ExpenseItem[];
  total: number;
  onBack: () => void;
}) {
  return (
    <main className="day-detail-page">
      <header className="day-detail-header">
        <button type="button" onClick={onBack}>
          ‹
        </button>

        <h1>7월 {day}일 (수)</h1>

        <button type="button">🗓️</button>
      </header>

      <section className="day-budget-summary">
        <div>
          <span>총소비</span>
          <strong>684,000원</strong>
        </div>

        <div>
          <span>사용 예산</span>
          <strong>{total.toLocaleString("ko-KR")}원</strong>
        </div>

        <div>
          <span>남은 예산</span>
          <strong>0일</strong>
        </div>

        <div className="day-progress">
          <span />
        </div>
      </section>

      <section className="day-category-list">
        {expenses.map((item) => (
          <div className="day-category-group" key={item.id}>
            <div className="day-category-heading">
              <strong style={{ color: categoryColor[item.category] }}>
                {item.category}
              </strong>

              <strong style={{ color: categoryColor[item.category] }}>
                {item.amount.toLocaleString("ko-KR")}원
              </strong>
            </div>

            <article className="day-detail-item">
              <div
                className="expense-icon large"
                style={{
                  background: `${categoryColor[item.category]}1e`,
                }}
              >
                {item.icon}
              </div>

              <div>
                <strong>{item.title}</strong>
                <span>{item.category} · 나 혼자</span>
                <small>{item.time}</small>
              </div>

              <div className="day-detail-price">
                <strong>{item.amount.toLocaleString("ko-KR")}원</strong>
                {item.settlement && <span>{item.settlement}</span>}
              </div>
            </article>
          </div>
        ))}
      </section>

      <section className="day-memo">
        <div>▧</div>
        <div>
          <strong>메모</strong>
          <p>필요한 물품 구매</p>
        </div>
      </section>

      <div className="day-detail-actions">
        <button type="button" className="primary">
          ＋ 소비 기록하기
        </button>

        <button type="button" className="secondary">
          이 날짜 예산 수정
        </button>
      </div>
    </main>
  );
}