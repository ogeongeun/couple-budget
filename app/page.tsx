"use client";
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./home.css";
import ExpenseSheet from "@/components/ExpenseSheet";
import IncomeSheet from "@/components/IncomeSheet";
import { createClient } from "@/lib/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";

const supabase = createClient();

export default function HomePage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [budget, setBudget] = useState(1_000_000);
  const [used] = useState(684_000);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/login");
        return;
      }

      setAuthLoading(false);
    };

    checkUser();
  }, [router]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("로그아웃 실패:", error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  const remaining = budget - used;
  const usageRate = Math.round((used / budget) * 100);

  if (authLoading) {
    return (
      <main className="auth-loading">
        로그인 정보를 확인하고 있어요...
      </main>
    );
  }

  return (
    <main className="home">
      {/* 헤더 */}
      <header className="header">
        <div>
          <h1>
            우리의 7월 가계부 <span>❤️</span>
          </h1>
          <p>함께 아끼고, 함께 행복해요 🐾</p>
        </div>

        <button className="notification-button">
          🔔
          <span className="notification-count">3</span>
        </button>
      </header>

      {/* 이번 달 예산 */}
      <section className="budget-card">
        <div className="budget-header">
          <div className="budget-title">
            <span className="budget-icon">🗓️</span>
            이번 달 예산
          </div>

          <button className="budget-setting-button">
            예산 설정 ›
          </button>
        </div>

        <div className="budget-amount">
          {budget.toLocaleString()}
          <span>원</span>
        </div>

        <div className="progress-area">
          <div className="progress-bar">
            <div
              className="progress-value"
              style={{ width: `${usageRate}%` }}
            />
          </div>

          <strong>{usageRate}%</strong>
        </div>

        <div className="budget-information">
          <div>
            <span>사용 금액</span>
            <strong>{used.toLocaleString()}원</strong>
          </div>

          <div>
            <span>남은 금액</span>
            <strong className="remaining">
              {remaining.toLocaleString()}원
            </strong>
          </div>

          <div>
            <span>예산 대비</span>
            <strong className="rate">{usageRate}%</strong>
          </div>
        </div>
      </section>

      {/* 초롱이와 밥그릇 */}
      <section className="dog-card">
        <div className="speech-bubble">
          오늘도
          <br />
          수고했어!
        </div>

     <div className="dog-button">
          <Image
            src="/chorong-v2.png"
            alt="초롱이"
            width={210}
            height={210}
            priority
          />
       </div>

        <button
          type="button"
          className="expense-button"
         onClick={() => setExpenseOpen(true)}
        >
          <span className="plus">＋</span>
          <strong>소비 기록하기</strong>
          <small>
            강아지를 눌러서
            <br />
            기록해보세요!
          </small>
        </button>

     <button
  type="button"
  className="bowl-button"
  onClick={() => setIncomeOpen(true)}
>
          <div className="food">
            <span>● ● ●</span>
            <span>● ●</span>
          </div>

          <div className="bowl">
            <span>🐾</span>
          </div>

          <small>밥 주기 · 소득 추가</small>
        </button>
      </section>

      {/* 정산 */}
      <section className="settlement-card">
        <div className="settlement-icon">💰</div>

        <div className="settlement-content">
          <span>아직 정산 안 한 돈</span>

          <strong>
            14,500원
            <small> 받을 예정</small>
          </strong>

          <em>미정산 3건</em>
        </div>

        <button onClick={() => router.push("/settlement")}>
          정산하러 가기 ›
        </button>
      </section>

      {/* 소비 원그래프 */}
      <section className="chart-section">
    <SpendingChart
  title="내 소비 현황"
  total="684,000원"
  chartClassName="my-chart"
  onDetail={() => router.push("/spending")}
/>

<SpendingChart
  title="상대 소비 현황"
  total="654,000원"
  chartClassName="partner-chart"
  onDetail={() => router.push("/spending")}
/>
      </section>

      {/* 하단 메뉴 */}
      <BottomNavigation active="home" />
      <ExpenseSheet
  open={expenseOpen}
  onClose={() => setExpenseOpen(false)}
/>
<IncomeSheet
  open={incomeOpen}
  onClose={() => setIncomeOpen(false)}
  currentBudget={budget}
  usedAmount={used}
  onSave={(amount) =>
    setBudget((current) => current + amount)
  }
/>
  <button
  type="button"
  onClick={handleLogout}
>
  로그아웃
</button>
    </main>
  );
}

function SpendingChart({
  title,
  total,
  chartClassName,
  onDetail,
}: {
  title: string;
  total: string;
  chartClassName: string;
  onDetail: () => void;
}) {
  return (
    <article className="chart-card">
      <h2>{title}</h2>

      <div className="chart-content">
        <div className={`donut-chart ${chartClassName}`}>
          <div className="donut-center">
            <span>총 지출</span>
            <strong>{total}</strong>
          </div>
        </div>

        <div className="chart-percentages">
          <span><i className="green" />35%</span>
          <span><i className="pink" />25%</span>
          <span><i className="yellow" />18%</span>
          <span><i className="blue" />12%</span>
          <span><i className="purple" />7%</span>
          <span><i className="gray" />3%</span>
        </div>
      </div>

      <button type="button" onClick={onDetail}>
        더 자세히 보기 ›
      </button>
    
    </article>
    
  );
}