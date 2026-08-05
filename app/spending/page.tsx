"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./spending.css";

type Category = {
  name: string;
  amount: number;
  budget: number;
  percentage: number;
  color: string;
  icon: string;
};

type Expense = {
  id: number;
  date: string;
  title: string;
  detail: string;
  amount: number;
  icon: string;
  settlement?: "정산전" | "정산 완료";
};

const categories: Category[] = [
  {
    name: "식비",
    amount: 239400,
    budget: 350000,
    percentage: 35,
    color: "#64c28a",
    icon: "🍚",
  },
  {
    name: "카페",
    amount: 171000,
    budget: 200000,
    percentage: 25,
    color: "#d69a5c",
    icon: "☕",
  },
  {
    name: "교통",
    amount: 123000,
    budget: 150000,
    percentage: 18,
    color: "#48a3df",
    icon: "🚌",
  },
  {
    name: "쇼핑",
    amount: 82000,
    budget: 150000,
    percentage: 12,
    color: "#956bcd",
    icon: "🛍️",
  },
  {
    name: "문화/여가",
    amount: 47000,
    budget: 80000,
    percentage: 7,
    color: "#ffb23f",
    icon: "🎬",
  },
  {
    name: "기타",
    amount: 21600,
    budget: 70000,
    percentage: 3,
    color: "#bdbdbd",
    icon: "•••",
  },
];

const foodExpenses: Expense[] = [
  {
    id: 1,
    date: "7월 30일 (수)",
    title: "김밥천국",
    detail: "점심 · 나혼자",
    amount: 8000,
    icon: "🍲",
  },
  {
    id: 2,
    date: "7월 30일 (수)",
    title: "샐러드 정기구독",
    detail: "점심 · 나혼자",
    amount: 14000,
    icon: "🥗",
  },
  {
    id: 3,
    date: "7월 29일 (화)",
    title: "현대백화점 푸드코트",
    detail: "저녁 · 둘이 함께",
    amount: 13000,
    icon: "🍱",
    settlement: "정산전",
  },
  {
    id: 4,
    date: "7월 29일 (화)",
    title: "GS25 샌드위치",
    detail: "간식 · 나혼자",
    amount: 5500,
    icon: "🥪",
  },
  {
    id: 5,
    date: "7월 28일 (월)",
    title: "본도시락",
    detail: "점심 · 나혼자",
    amount: 9900,
    icon: "🍙",
  },
];

export default function SpendingPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null);

  const total = categories.reduce(
    (sum, category) => sum + category.amount,
    0,
  );

  if (selectedCategory) {
    return (
      <CategoryDetail
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <main className="spending-page">
      <header className="spending-header">
        <button type="button" onClick={() => router.back()}>
          ←
        </button>

        <h1>소비 현황 상세</h1>

        <button type="button" className="spending-month">
          🗓️ 7월⌄
        </button>
      </header>

      <div className="spending-tabs">
        <button className="active">카테고리별</button>
        <button>기간별</button>
      </div>

      <section className="spending-summary-card">
        <div className="spending-summary-top">
          <div>
            <span>총소비</span>

            <strong>
              {total.toLocaleString("ko-KR")}
              <small>원</small>
            </strong>

            <p>7월 1일 ~ 7월 30일</p>
          </div>

          <div>
            <span>예산 대비</span>
            <strong className="small-total">68%</strong>
            <p>사용</p>
          </div>
        </div>

        <div className="spending-chart-area">
          <div className="spending-donut">
            <div>
              <strong>{total.toLocaleString("ko-KR")}원</strong>
              <span>총지출</span>
            </div>
          </div>

          <div className="spending-legend">
            {categories.map((category) => (
              <button
                type="button"
                key={category.name}
                onClick={() => setSelectedCategory(category)}
              >
                <i style={{ background: category.color }} />
                <span>{category.name}</span>

                <strong>
                  {category.amount.toLocaleString("ko-KR")}원
                </strong>

                <small>{category.percentage}%</small>
              </button>
            ))}
          </div>
        </div>

        <section className="category-budget-card">
          <h2>카테고리별 예산 대비</h2>

          {categories.map((category) => {
            const budgetRate = Math.round(
              (category.amount / category.budget) * 100,
            );

            return (
              <button
                type="button"
                className="category-budget-row"
                key={category.name}
                onClick={() => setSelectedCategory(category)}
              >
                <div className="budget-row-info">
                  <span>{category.name}</span>

                  <p>
                    {category.amount.toLocaleString("ko-KR")}원/
                    {category.budget.toLocaleString("ko-KR")}원
                  </p>

                  <strong>{budgetRate}%</strong>
                </div>

                <div className="budget-progress">
                  <span
                    style={{
                      width: `${Math.min(budgetRate, 100)}%`,
                      background: category.color,
                    }}
                  />
                </div>
              </button>
            );
          })}

          <p className="budget-guide">
            ⓘ 카테고리 예산은 예산 설정에서 변경할 수 있어요.
          </p>
        </section>
      </section>

     
    </main>
  );
}

function CategoryDetail({
  category,
  onBack,
}: {
  category: Category;
  onBack: () => void;
}) {
  const groupedExpenses = foodExpenses.reduce<
    Record<string, Expense[]>
  >((result, expense) => {
    if (!result[expense.date]) {
      result[expense.date] = [];
    }

    result[expense.date].push(expense);
    return result;
  }, {});

  const rate = Math.round(
    (category.amount / category.budget) * 100,
  );

  return (
    <main className="category-detail-page">
      <header className="category-detail-header">
        <button type="button" onClick={onBack}>
          ←
        </button>

        <h1>카테고리별 상세 내역</h1>

        <span />
      </header>

      <section className="category-detail-summary">
        <div className="category-detail-icon">
          {category.icon}
        </div>

        <div>
          <span>{category.name}</span>

          <strong>
            {category.amount.toLocaleString("ko-KR")}
            <small>원</small>
          </strong>

          <p>
            예산 {category.budget.toLocaleString("ko-KR")}원
          </p>
        </div>

        <div className="category-rate">
          <span>예산 대비</span>
          <strong>{rate}%</strong>
        </div>
      </section>

      <div className="category-detail-tabs">
        <button className="active">내역</button>
        <button>분석</button>
      </div>

      <section className="category-history">
        {Object.entries(groupedExpenses).map(
          ([date, expenses]) => {
            const dailyTotal = expenses.reduce(
              (sum, expense) => sum + expense.amount,
              0,
            );

            return (
              <article className="date-group" key={date}>
                <header>
                  <span>{date}</span>

                  <strong>
                    {dailyTotal.toLocaleString("ko-KR")}원⌃
                  </strong>
                </header>

                {expenses.map((expense) => (
                  <div
                    className="history-item"
                    key={expense.id}
                  >
                    <div className="history-icon">
                      {expense.icon}
                    </div>

                    <div className="history-content">
                      <strong>{expense.title}</strong>
                      <span>{expense.detail}</span>
                    </div>

                    <div className="history-price">
                      <strong>
                        {expense.amount.toLocaleString("ko-KR")}원
                      </strong>

                      {expense.settlement && (
                        <span
                          className={
                            expense.settlement === "정산전"
                              ? "pending"
                              : "complete"
                          }
                        >
                          {expense.settlement}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </article>
            );
          },
        )}
      </section>

      <footer className="category-detail-footer">
        <div>
          <span>총 {foodExpenses.length}건</span>

          <strong>
            {category.amount.toLocaleString("ko-KR")}원
          </strong>
        </div>

        <nav>
          <button type="button">‹ 이전 달</button>
          <strong>🗓️ 7월</strong>
          <button type="button">다음 달 ›</button>
        </nav>
      </footer>
    </main>
  );
}