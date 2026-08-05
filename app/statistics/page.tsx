"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import BottomNavigation from "@/components/BottomNavigation";
import "./statistics.css";

const weeklySpending = [
  { day: "월", amount: 18000 },
  { day: "화", amount: 21000 },
  { day: "수", amount: 17000 },
  { day: "목", amount: 15000 },
  { day: "금", amount: 32000 },
  { day: "토", amount: 45000 },
  { day: "일", amount: 38000 },
];

const monthlySpending = [
  { month: "2월", amount: 380000 },
  { month: "3월", amount: 450000 },
  { month: "4월", amount: 520000 },
  { month: "5월", amount: 550000 },
  { month: "6월", amount: 611000 },
  { month: "7월", amount: 684000 },
];

const timeSpending = [
  {
    label: "아침",
    time: "06~11시",
    percent: 12,
    className: "morning",
  },
  {
    label: "점심",
    time: "11~14시",
    percent: 28,
    className: "lunch",
  },
  {
    label: "저녁",
    time: "14~21시",
    percent: 43,
    className: "evening",
  },
  {
    label: "야간",
    time: "21~06시",
    percent: 17,
    className: "night",
  },
];

const savingSuggestions = [
  {
    icon: "☕",
    title: "카페 이용을 주 1회 줄이면",
    amount: "-48,000원",
  },
  {
    icon: "🍔",
    title: "배달을 주 1회 줄이면",
    amount: "-36,000원",
  },
  {
    icon: "🚕",
    title: "택시를 대중교통으로 바꾸면",
    amount: "-22,000원",
  },
];

export default function StatisticsPage() {
  const router = useRouter();

  const weeklyMaximum = Math.max(
    ...weeklySpending.map((item) => item.amount),
  );

  const monthlyMaximum = Math.max(
    ...monthlySpending.map((item) => item.amount),
  );

  return (
    <main className="analysis-page">
      <header className="analysis-header">
        <button
          type="button"
          className="analysis-back-button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          ←
        </button>

        <h1>통계</h1>

        <button type="button" className="analysis-month-button">
          🗓️ 7월⌄
        </button>
      </header>

      {/* 초롱이 분석 */}
      <section className="analysis-dog-card">
        <div className="analysis-speech">
          <strong>
            이번 달은 지난달보다
            <br />
            73,000원 더 썼어요.
          </strong>

          <p>
            식비와 카페 지출이
            <br />
            가장 많이 늘었어요!
          </p>
        </div>

        <Image
          src="/chorong-v2.png"
          alt="소비를 분석하는 초롱이"
          width={180}
          height={180}
          priority
        />
      </section>

      {/* 요약 */}
      <section className="analysis-summary-card">
        <h2>이번 달 한눈에 보기</h2>

        <div className="analysis-summary-grid">
          <SummaryItem
            label="총소비"
            value="684,000원"
            icon="👛"
            iconClass="green"
          />

          <SummaryItem
            label="지난달 대비"
            value="+12%"
            subValue="(+73,000원)"
            icon="↗"
            iconClass="coral"
            valueClass="coral"
          />

          <SummaryItem
            label="예산 사용률"
            value="68%"
            icon="◔"
            iconClass="mint"
          />

          <SummaryItem
            label="하루 평균 소비"
            value="22,067원"
            icon="🗓️"
            iconClass="blue"
          />
        </div>
      </section>

      {/* 최근 6개월 변화 */}
      <section className="analysis-card">
        <div className="analysis-section-heading">
          <h2>
            소비 변화 추이
            <small>최근 6개월</small>
          </h2>

          <div className="chart-legend">
            <span>
              <i className="expense-line" />
              지출
            </span>

            <span>
              <i className="budget-line" />
              예산
            </span>
          </div>
        </div>

        <div className="monthly-line-chart">
          <div className="chart-y-labels">
            <span>80만</span>
            <span>60만</span>
            <span>40만</span>
            <span>20만</span>
            <span>0</span>
          </div>

          <div className="line-chart-area">
            <div className="line-grid line-grid-one" />
            <div className="line-grid line-grid-two" />
            <div className="line-grid line-grid-three" />
            <div className="line-grid line-grid-four" />

            <div className="budget-guide-line" />

            <svg
              className="monthly-svg"
              viewBox="0 0 500 210"
              preserveAspectRatio="none"
            >
              <polyline
                points="5,180 100,155 195,120 290,108 390,82 495,45"
                fill="none"
                stroke="#33ad6d"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {[
                [5, 180],
                [100, 155],
                [195, 120],
                [290, 108],
                [390, 82],
                [495, 45],
              ].map(([x, y]) => (
                <circle
                  key={`${x}-${y}`}
                  cx={x}
                  cy={y}
                  r="7"
                  fill="#ffffff"
                  stroke="#33ad6d"
                  strokeWidth="4"
                />
              ))}
            </svg>

            <div className="monthly-values">
              {monthlySpending.map((item) => (
                <span key={item.month}>
                  {(item.amount / 10000).toFixed(
                    item.amount % 10000 === 0 ? 0 : 1,
                  )}
                  만
                </span>
              ))}
            </div>

            <div className="monthly-labels">
              {monthlySpending.map((item) => (
                <span key={item.month}>{item.month}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 집중도 */}
      <section className="analysis-card concentration-card">
        <h2>소비 집중도 분석</h2>

        <div className="concentration-content">
          <div className="concentration-chart">
            <div>
              <strong>72%</strong>
            </div>
          </div>

          <div className="concentration-copy">
            <p>
              상위 2개 카테고리
              <br />
              <b>식비, 카페</b> 지출이 전체의
              <strong> 72%</strong>를 차지해요.
            </p>

            <span>
              특정 카테고리에 지출이
              <br />
              집중되어 있어요.
            </span>
          </div>
        </div>
      </section>

      {/* 키워드 */}
      <section className="analysis-card">
        <h2>이번 달 소비 패턴 키워드</h2>

        <div className="pattern-keywords">
          <span>🔥 주말 지출 많음</span>
          <span>☕ 카페 이용 잦음</span>
          <span>🚙 대중교통 활용</span>
          <span>🛍️ 쇼핑 지출 증가</span>
          <span>🍴 외식 비중 높음</span>
        </div>
      </section>

      {/* 요일별 */}
      <section className="analysis-card">
        <div className="analysis-section-heading">
          <h2>지출 요일별 분석</h2>
          <small>평균 지출 (원)</small>
        </div>

        <div className="weekday-chart">
          {weeklySpending.map((item) => {
            const height = Math.max(
              28,
              Math.round(
                (item.amount / weeklyMaximum) * 155,
              ),
            );

            return (
              <div className="weekday-column" key={item.day}>
                <strong>{item.amount.toLocaleString()}</strong>

                <div
                  className={[
                    "weekday-bar",
                    item.day === "토" ? "highest" : "",
                  ].join(" ")}
                  style={{ height }}
                />

                <span
                  className={
                    item.day === "토" ? "weekend-active" : ""
                  }
                >
                  {item.day}
                </span>
              </div>
            );
          })}
        </div>

        <div className="analysis-tip">
          <span>💡</span>
          <p>
            주말(토·일) 평균 소비가 평일보다
            <strong> 62% 높아요!</strong>
          </p>
        </div>
      </section>

      {/* 시간대 */}
      <section className="analysis-card">
        <h2>시간대별 소비 비율</h2>

        <div className="time-chart-content">
          <div className="time-donut">
            <div>◷</div>
          </div>

          <div className="time-legend">
            {timeSpending.map((item) => (
              <div key={item.label}>
                <i className={item.className} />

                <span>
                  {item.label}
                  <small>({item.time})</small>
                </span>

                <strong>{item.percent}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="analysis-purple-tip">
          <span>🌙</span>

          <p>
            저녁 이후 지출이 전체의
            <strong> 60%</strong>를 차지해요.
            <small>
              야식과 배달 지출을 한 번 돌아보세요!
            </small>
          </p>
        </div>
      </section>

      {/* 월별 비교 */}
      <section className="analysis-card">
        <div className="analysis-section-heading">
          <h2>월별 소비 비교</h2>
          <small>단위: 원</small>
        </div>

        <div className="month-bar-layout">
          <div className="month-bar-chart">
            {monthlySpending.slice(-4).map((item) => {
              const height = Math.max(
                35,
                Math.round(
                  (item.amount / monthlyMaximum) * 145,
                ),
              );

              return (
                <div className="month-bar-column" key={item.month}>
                  <strong>{item.amount.toLocaleString()}</strong>

                  <div
                    className={
                      item.month === "7월"
                        ? "month-bar current"
                        : "month-bar"
                    }
                    style={{ height }}
                  />

                  <span>{item.month}</span>
                </div>
              );
            })}
          </div>

          <div className="month-change-card">
            <span>지난달 대비</span>
            <strong>+12%</strong>
            <small>+73,000원</small>
          </div>
        </div>
      </section>

      {/* 절약 예상 */}
      <section className="analysis-card saving-card">
        <h2>이번 달 절약 가능 금액 예측</h2>

        <div className="saving-list">
          {savingSuggestions.map((item) => (
            <button type="button" key={item.title}>
              <span className="saving-icon">{item.icon}</span>
              <strong>{item.title}</strong>
              <em>
                월 <b>{item.amount}</b>
              </em>
              <span>⌄</span>
            </button>
          ))}
        </div>
      </section>

      <BottomNavigation active="statistics" />
    </main>
  );
}

function SummaryItem({
  label,
  value,
  subValue,
  icon,
  iconClass,
  valueClass,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: string;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <article className="analysis-summary-item">
      <span>{label}</span>
      <strong className={valueClass}>{value}</strong>
      {subValue && <small>{subValue}</small>}

      <div className={`summary-round-icon ${iconClass}`}>
        {icon}
      </div>
    </article>
  );
}