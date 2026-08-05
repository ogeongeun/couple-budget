"use client";

import Image from "next/image";
import { useState } from "react";

type IncomeSheetProps = {
  open: boolean;
  onClose: () => void;
  currentBudget: number;
  usedAmount: number;
  onSave: (amount: number) => void;
};

type IncomeType =
  | "급여"
  | "용돈"
  | "상여금"
  | "투자수익"
  | "기타 수입";

const incomeTypes: {
  name: IncomeType;
  icon: string;
}[] = [
  { name: "급여", icon: "💵" },
  { name: "용돈", icon: "✉️" },
  { name: "상여금", icon: "🎁" },
  { name: "투자수익", icon: "📈" },
  { name: "기타 수입", icon: "•••" },
];

export default function IncomeSheet({
  open,
  onClose,
  currentBudget,
  usedAmount,
  onSave,
}: IncomeSheetProps) {
  const [amount, setAmount] = useState("1000000");
  const [incomeType, setIncomeType] =
    useState<IncomeType>("급여");
  const [date, setDate] = useState("2026-07-30");
  const [memo, setMemo] = useState("");

  if (!open) return null;

  const numericAmount = Number(amount || 0);
  const formattedAmount =
    numericAmount.toLocaleString("ko-KR");

  const nextBudget = currentBudget + numericAmount;
  const currentAvailable = currentBudget - usedAmount;
  const nextAvailable = nextBudget - usedAmount;

  const addAmount = (value: number) => {
    setAmount((current) =>
      String(Number(current || 0) + value),
    );
  };

  const clearAmount = () => {
    setAmount("");
  };

  const handleSave = () => {
    if (numericAmount <= 0) {
      alert("추가할 금액을 입력해 주세요.");
      return;
    }

    const incomeData = {
      amount: numericAmount,
      incomeType,
      date,
      memo,
      createdAt: new Date().toISOString(),
    };

    console.log("저장할 소득 내역:", incomeData);

    onSave(numericAmount);

    setAmount("");
    setIncomeType("급여");
    setMemo("");
    onClose();
  };

  return (
    <div
      className="income-sheet-backdrop"
      onClick={onClose}
    >
      <section
        className="income-sheet-new"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="income-sheet-header">
          <button
            type="button"
            className="income-back-button"
            onClick={onClose}
            aria-label="뒤로 가기"
          >
            ←
          </button>

          <h2>예산 추가 (밥 주기) 🍚</h2>

          <button
            type="button"
            className="income-close-button"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="income-sheet-scroll">
          {/* 소개 영역 */}
          <section className="income-intro">
            <div className="income-intro-text">
              <h3>
                우리 멍멍이에게
                <br />
                밥을 주고 예산을 추가해요! 🐾
              </h3>

              <p>
                추가한 예산은 ‘사용 가능 금액’에
                <br />
                합쳐져요.
              </p>
            </div>

            <div className="income-dog-area">
              <Image
                src="/chorong-v2.png"
                alt="초롱이와 밥그릇"
                width={185}
                height={170}
                priority
              />

              <div className="income-heart">♥</div>

              <div className="income-bowl-art">
                <span className="income-kibble">
                  ● ● ●
                  <br />
                  ● ● ●
                </span>
                <span className="income-bowl-paw">
                  🐾
                </span>
              </div>
            </div>
          </section>

          {/* 금액 입력 */}
          <section className="income-block income-amount-block">
            <h4>추가할 금액</h4>

            <div className="income-new-amount-input">
              <span className="income-won-symbol">
                ₩
              </span>

              <input
                type="text"
                inputMode="numeric"
                value={
                  amount ? formattedAmount : ""
                }
                placeholder="0"
                onChange={(event) => {
                  const value =
                    event.target.value.replace(
                      /[^0-9]/g,
                      "",
                    );

                  setAmount(value);
                }}
              />

              {amount && (
                <button
                  type="button"
                  className="income-clear-button"
                  onClick={clearAmount}
                  aria-label="금액 지우기"
                >
                  ×
                </button>
              )}
            </div>

            <div className="income-new-quick-buttons">
              <button
                type="button"
                onClick={() => addAmount(100_000)}
              >
                + 10만원
              </button>

              <button
                type="button"
                onClick={() => addAmount(300_000)}
              >
                + 30만원
              </button>

              <button
                type="button"
                onClick={() => addAmount(500_000)}
              >
                + 50만원
              </button>

              <button
                type="button"
                onClick={() =>
                  addAmount(1_000_000)
                }
              >
                + 100만원
              </button>

              <button
                type="button"
                onClick={clearAmount}
              >
                직접입력
              </button>
            </div>
          </section>

          {/* 소득 종류 */}
          <section className="income-block">
            <h4>어디에서 온 소득인가요?</h4>

            <div className="income-type-grid-new">
              {incomeTypes.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  className={
                    incomeType === item.name
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setIncomeType(item.name)
                  }
                >
                  <span>{item.icon}</span>
                  <small>{item.name}</small>
                </button>
              ))}
            </div>
          </section>

          {/* 날짜와 메모 */}
          <section className="income-block income-details">
            <label>
              <span>날짜</span>

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(event.target.value)
                }
              />
            </label>

            <label>
              <span>
                메모 <small>선택</small>
              </span>

              <div className="income-memo-wrap">
                <textarea
                  maxLength={50}
                  value={memo}
                  placeholder="메모를 입력해주세요 (예: 7월 월급)"
                  onChange={(event) =>
                    setMemo(event.target.value)
                  }
                />

                <small>{memo.length}/50</small>
              </div>
            </label>
          </section>

          {/* 예산 미리보기 */}
          <section className="income-preview-card">
            <h4>추가 후 예산 미리보기</h4>

            <div className="income-preview-values">
              <div>
                <span>현재 예산</span>
                <strong>
                  {currentBudget.toLocaleString(
                    "ko-KR",
                  )}
                  원
                </strong>

                <small>
                  사용가능{" "}
                  {currentAvailable.toLocaleString(
                    "ko-KR",
                  )}
                  원
                </small>
              </div>

              <div className="income-preview-divider" />

              <div>
                <span>추가 금액</span>
                <strong className="income-green">
                  +
                  {numericAmount.toLocaleString(
                    "ko-KR",
                  )}
                  원
                </strong>
              </div>

              <div className="income-preview-arrow">
                ➜
              </div>

              <div>
                <span>추가 후 예산</span>
                <strong>
                  {nextBudget.toLocaleString(
                    "ko-KR",
                  )}
                  원
                </strong>

                <small>
                  사용가능{" "}
                  {nextAvailable.toLocaleString(
                    "ko-KR",
                  )}
                  원
                </small>
              </div>
            </div>
          </section>

          <div className="income-info-box">
            ⓘ 추가한 예산은 가계부의 ‘사용 가능
            금액’에 반영됩니다.
          </div>
        </div>

        <div className="income-save-area-new">
          <button
            type="button"
            onClick={handleSave}
          >
            🥣 {formattedAmount || "0"}원
            추가하고 밥 주기
          </button>
        </div>
      </section>
    </div>
  );
}