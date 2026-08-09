"use client";

import {
  useEffect,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

import "./SavingSheet.css";

const supabase = createClient();

type SavingMode =
  | "deposit"
  | "withdraw";

type SavingSheetProps = {
  open: boolean;
  mode: SavingMode;
  onClose: () => void;
  coupleId: string | null;
  userId: string | null;
  currentBalance: number;
  availableBudget: number;
  onSave: () => void;
};

function getTodayString() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function SavingSheet({
  open,
  mode,
  onClose,
  coupleId,
  userId,
  currentBalance,
  availableBudget,
  onSave,
}: SavingSheetProps) {
  const [amount, setAmount] =
    useState("");

  const [memo, setMemo] =
    useState("");

  const [date, setDate] =
    useState(
      getTodayString(),
    );

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setAmount("");
    setMemo("");
    setDate(
      getTodayString(),
    );
    setMessage("");
    setSaving(false);
  }, [open, mode]);

  if (!open) {
    return null;
  }

  const numericAmount =
    Number(
      amount.replace(
        /[^0-9]/g,
        "",
      ),
    );

  const maximumAmount =
    mode === "deposit"
      ? availableBudget
      : currentBalance;

  const handleAmountChange = (
    value: string,
  ) => {
    const onlyNumber =
      value.replace(
        /[^0-9]/g,
        "",
      );

    setAmount(onlyNumber);
    setMessage("");
  };

  const addQuickAmount = (
    value: number,
  ) => {
    const nextAmount =
      numericAmount + value;

    setAmount(
      String(
        Math.min(
          nextAmount,
          Math.max(
            maximumAmount,
            0,
          ),
        ),
      ),
    );

    setMessage("");
  };

  const handleSave =
    async () => {
      setMessage("");

      if (
        !userId ||
        !coupleId
      ) {
        setMessage(
          "사용자 정보를 불러오지 못했어요.",
        );
        return;
      }

      if (
        !numericAmount ||
        numericAmount <= 0
      ) {
        setMessage(
          "금액을 입력해주세요.",
        );
        return;
      }

      if (
        mode === "deposit" &&
        numericAmount >
          availableBudget
      ) {
        setMessage(
          "현재 사용 가능한 예산보다 많이 저금할 수 없어요.",
        );
        return;
      }

      if (
        mode === "withdraw" &&
        numericAmount >
          currentBalance
      ) {
        setMessage(
          "저금통에 있는 금액보다 많이 꺼낼 수 없어요.",
        );
        return;
      }

      setSaving(true);

      const {
        error,
      } = await supabase
        .from("savings")
        .insert({
          couple_id:
            coupleId,
          user_id:
            userId,
          type:
            mode,
          amount:
            numericAmount,
          memo:
            memo.trim() ||
            null,
          saving_date:
            date,
        });

      setSaving(false);

      if (error) {
        console.error(
          "저금 저장 오류:",
          error,
        );

        setMessage(
          "저금 기록을 저장하지 못했어요.",
        );
        return;
      }

      onSave();
    };

  const formattedAmount =
    amount
      ? Number(
          amount,
        ).toLocaleString(
          "ko-KR",
        )
      : "";

  return (
    <div
      className="saving-sheet-backdrop"
      onClick={onClose}
    >
      <section
        className="saving-sheet"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="saving-sheet-handle" />

        <header className="saving-sheet-header">
          <div>
            <span>
              {mode ===
              "deposit"
                ? "🐷"
                : "🔨"}
            </span>

            <div>
              <h2>
                {mode ===
                "deposit"
                  ? "저금하기"
                  : "저금통 깨기"}
              </h2>

              <p>
                {mode ===
                "deposit"
                  ? "현재 예산에서 저금통으로 옮겨요."
                  : "저금한 돈을 다시 현재 예산으로 가져와요."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="saving-balance-overview">
          <div>
            <span>
              현재 저금통
            </span>

            <strong>
              {currentBalance.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>
          </div>

          <div>
            <span>
              사용 가능 예산
            </span>

            <strong className="available">
              {availableBudget.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>
          </div>
        </div>

        <div className="saving-amount-field">
          <label>
            {mode ===
            "deposit"
              ? "얼마를 저금할까요?"
              : "얼마를 꺼낼까요?"}
          </label>

          <div>
            <input
              inputMode="numeric"
              value={
                formattedAmount
              }
              onChange={(
                event,
              ) =>
                handleAmountChange(
                  event.target
                    .value,
                )
              }
              placeholder="0"
            />

            <span>원</span>
          </div>
        </div>

        <div className="saving-quick-buttons">
          {[
            10000,
            30000,
            50000,
            100000,
          ].map(
            (value) => (
              <button
                type="button"
                key={value}
                disabled={
                  maximumAmount <= 0
                }
                onClick={() =>
                  addQuickAmount(
                    value,
                  )
                }
              >
                +
                {value.toLocaleString(
                  "ko-KR",
                )}
              </button>
            ),
          )}
        </div>

      {maximumAmount > 0 && (
  <button
    type="button"
    className={
      mode === "deposit"
        ? "saving-all-deposit-button"
        : "saving-all-withdraw-button"
    }
    onClick={() => {
      setAmount(
        String(maximumAmount),
      );
      setMessage("");
    }}
  >
    {mode === "deposit"
      ? "가능한 금액 전부 저금하기"
      : "전액 꺼내기"}
  </button>
)}

        <div className="saving-field">
          <label>
            날짜
          </label>

          <input
            type="date"
            value={date}
            onChange={(
              event,
            ) =>
              setDate(
                event.target
                  .value,
              )
            }
          />
        </div>

        <div className="saving-field">
          <label>
            메모
            <small>
              선택
            </small>
          </label>

          <input
            type="text"
            value={memo}
            onChange={(
              event,
            ) =>
              setMemo(
                event.target
                  .value,
              )
            }
            placeholder={
              mode ===
              "deposit"
                ? "예: 이번 달 남은 돈"
                : "예: 급하게 필요해서"
            }
            maxLength={40}
          />
        </div>

        {message && (
          <p className="saving-message">
            {message}
          </p>
        )}

        <button
          type="button"
          className={
            mode ===
            "deposit"
              ? "saving-submit"
              : "saving-submit withdraw"
          }
          disabled={
            saving ||
            numericAmount <= 0 ||
            numericAmount >
              maximumAmount ||
            maximumAmount <= 0
          }
          onClick={() => {
            void handleSave();
          }}
        >
          {saving
            ? "저장 중..."
            : mode ===
                "deposit"
              ? `${numericAmount.toLocaleString(
                  "ko-KR",
                )}원 저금하기`
              : `${numericAmount.toLocaleString(
                  "ko-KR",
                )}원 꺼내기`}
        </button>
      </section>
    </div>
  );
}
