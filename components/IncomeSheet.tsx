"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type IncomeSheetProps = {
  open: boolean;
  onClose: () => void;
  coupleId: string | null;
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

function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(now.getDate()).padStart(
    2,
    "0",
  );

  return `${year}-${month}-${day}`;
}

export default function IncomeSheet({
  open,
  onClose,
  coupleId,
  currentBudget,
  usedAmount,
  onSave,
}: IncomeSheetProps) {
  const [amount, setAmount] = useState("");
  const [incomeType, setIncomeType] =
    useState<IncomeType>("급여");

  const [date, setDate] = useState(
    getTodayString(),
  );

  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDate(getTodayString());
    setMessage("");
  }, [open]);

  if (!open) {
    return null;
  }

  const numericAmount = Number(amount || 0);

  const formattedAmount =
    numericAmount.toLocaleString("ko-KR");

  const nextBudget =
    currentBudget + numericAmount;

  const currentAvailable =
    currentBudget - usedAmount;

  const nextAvailable =
    nextBudget - usedAmount;

  const addAmount = (value: number) => {
    setAmount((current) =>
      String(Number(current || 0) + value),
    );

    setMessage("");
  };

  const clearAmount = () => {
    setAmount("");
    setMessage("");
  };

  const resetForm = () => {
    setAmount("");
    setIncomeType("급여");
    setDate(getTodayString());
    setMemo("");
    setMessage("");
  };

  const handleClose = () => {
    if (saving) {
      return;
    }

    setMessage("");
    onClose();
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setMessage("");

    if (!coupleId) {
      setMessage(
        "연결된 가계부 정보를 찾지 못했어요.",
      );
      return;
    }

    if (numericAmount <= 0) {
      setMessage(
        "추가할 금액을 입력해 주세요.",
      );
      return;
    }

    if (!date) {
      setMessage("날짜를 선택해 주세요.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "로그인 정보를 확인하지 못했어요.",
        );
      }

      const { error: insertError } =
        await supabase
          .from("incomes")
          .insert({
            couple_id: coupleId,
            user_id: user.id,
            amount: numericAmount,
            category: incomeType,
            memo: memo.trim() || null,
            income_date: date,
          });

      if (insertError) {
        throw insertError;
      }

      onSave(numericAmount);
      resetForm();
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "소득 저장 중 오류가 발생했어요.";

      console.error(
        "소득 저장 오류:",
        error,
      );

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="income-sheet-backdrop"
      onClick={handleClose}
    >
      <section
        className="income-sheet-new"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="income-sheet-header">
          <button
            type="button"
            className="income-back-button"
            onClick={handleClose}
            disabled={saving}
            aria-label="뒤로 가기"
          >
            ←
          </button>

          <h2>예산 추가 (밥 주기) 🍚</h2>

          <button
            type="button"
            className="income-close-button"
            onClick={handleClose}
            disabled={saving}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="income-sheet-scroll">
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

              <div className="income-heart">
                ♥
              </div>

            </div>
          </section>

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
                disabled={saving}
                onChange={(event) => {
                  const value =
                    event.target.value.replace(
                      /[^0-9]/g,
                      "",
                    );

                  setAmount(value);
                  setMessage("");
                }}
              />

              {amount && (
                <button
                  type="button"
                  className="income-clear-button"
                  onClick={clearAmount}
                  disabled={saving}
                  aria-label="금액 지우기"
                >
                  ×
                </button>
              )}
            </div>

            <div className="income-new-quick-buttons">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(100_000)
                }
              >
                + 10만원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(300_000)
                }
              >
                + 30만원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(500_000)
                }
              >
                + 50만원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(1_000_000)
                }
              >
                + 100만원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={clearAmount}
              >
                직접입력
              </button>
            </div>
          </section>

          <section className="income-block">
            <h4>어디에서 온 소득인가요?</h4>

            <div className="income-type-grid-new">
              {incomeTypes.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  disabled={saving}
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

          <section className="income-block income-details">
            <label>
              <span>날짜</span>

              <input
                type="date"
                value={date}
                disabled={saving}
                onChange={(event) => {
                  setDate(event.target.value);
                  setMessage("");
                }}
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
                  disabled={saving}
                  placeholder="메모를 입력해주세요 (예: 8월 월급)"
                  onChange={(event) =>
                    setMemo(event.target.value)
                  }
                />

                <small>{memo.length}/50</small>
              </div>
            </label>
          </section>

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

          {message && (
            <p className="income-save-message">
              {message}
            </p>
          )}

          <div className="income-info-box">
            ⓘ 추가한 예산은 가계부의 ‘사용 가능
            금액’에 반영됩니다.
          </div>
        </div>

        <div className="income-save-area-new">
          <button
            type="button"
            disabled={
              saving ||
              numericAmount <= 0 ||
              !coupleId
            }
            onClick={handleSave}
          >
            {saving
              ? "저장하는 중..."
              : `🥣 ${
                  formattedAmount || "0"
                }원 추가하고 밥 주기`}
          </button>
        </div>
      </section>
    </div>
  );
}