"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type ExpenseSheetProps = {
  open: boolean;
  onClose: () => void;
  coupleId: string | null;
  partnerId: string | null;
  onSave: () => void;
};

type UseType = "alone" | "together";
type PaymentType = "split" | "treat";
type Payer = "me" | "partner";
type SettlementStatus = "pending" | "complete";

const categories = [
  { name: "식비", icon: "🍚" },
  { name: "카페", icon: "☕" },
  { name: "교통", icon: "🚌" },
  { name: "쇼핑", icon: "🛍️" },
  { name: "문화", icon: "🎬" },
  { name: "생활", icon: "🏠" },
  { name: "의료", icon: "💊" },
  { name: "기타", icon: "＋" },
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

export default function ExpenseSheet({
  open,
  onClose,
  coupleId,
  partnerId,
  onSave,
}: ExpenseSheetProps) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] =
    useState("식비");
  const [useType, setUseType] =
    useState<UseType>("alone");

  const [paymentType, setPaymentType] =
    useState<PaymentType>("split");

  const [payer, setPayer] =
    useState<Payer>("me");

  const [
    settlementStatus,
    setSettlementStatus,
  ] = useState<SettlementStatus>("pending");

  const [content, setContent] =
    useState("");
  const [memo, setMemo] =
    useState("");
  const [date, setDate] =
    useState(getTodayString());

  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState("");

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

  const numericAmount =
    Number(amount || 0);

  const formattedAmount =
    numericAmount.toLocaleString("ko-KR");

  const myShare =
    Math.floor(numericAmount / 2);

  const partnerShare =
    numericAmount - myShare;

  const addAmount = (value: number) => {
    setAmount((current) =>
      String(
        Number(current || 0) + value,
      ),
    );

    setMessage("");
  };

  const resetAmount = () => {
    setAmount("");
    setMessage("");
  };

  const resetForm = () => {
    setAmount("");
    setCategory("식비");
    setUseType("alone");
    setPaymentType("split");
    setPayer("me");
    setSettlementStatus("pending");
    setContent("");
    setMemo("");
    setDate(getTodayString());
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
        "연결된 가계부를 찾지 못했어요.",
      );
      return;
    }

    if (numericAmount <= 0) {
      setMessage(
        "금액을 입력해 주세요.",
      );
      return;
    }

    if (!date) {
      setMessage(
        "날짜를 선택해 주세요.",
      );
      return;
    }

    if (
      useType === "together" &&
      payer === "partner" &&
      !partnerId
    ) {
      setMessage(
        "연결된 상대방 정보를 찾지 못했어요.",
      );
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

      const isTogether =
        useType === "together";

      const isSplit =
        isTogether &&
        paymentType === "split";

      const payerId =
        !isTogether
          ? user.id
          : payer === "me"
            ? user.id
            : partnerId;

      const { error: insertError } =
        await supabase
          .from("expenses")
          .insert({
            couple_id: coupleId,
            user_id: user.id,
            amount: numericAmount,
            category,
            title:
              content.trim() || null,
            memo:
              memo.trim() || null,
            expense_date: date,

            use_type: isTogether
              ? "함께"
              : "혼자",

            payment_type: isTogether
              ? paymentType === "split"
                ? "나눠내기"
                : "사주기"
              : null,

            payer_id: payerId,

            my_share: isSplit
              ? myShare
              : numericAmount,

            partner_share: isSplit
              ? partnerShare
              : 0,

            settlement_status: isSplit
              ? settlementStatus ===
                "pending"
                ? "정산대기"
                : "정산완료"
              : "해당없음",

            settled_at:
              isSplit &&
              settlementStatus ===
                "complete"
                ? new Date().toISOString()
                : null,
          });

      if (insertError) {
        throw insertError;
      }

      onSave();
      resetForm();
      onClose();
    } catch (error) {
      console.error(
        "소비 저장 오류:",
        error,
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "소비 저장 중 오류가 발생했어요.";

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="expense-sheet-backdrop"
      onClick={handleClose}
    >
      <section
        className="expense-sheet-new"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="expense-sheet-handle" />

        <header className="expense-sheet-title">
          <h2>소비 기록</h2>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="expense-sheet-scroll">
          <section className="expense-intro">
            <div className="expense-intro-text">
              <h3>
                오늘 얼마 썼어?{" "}
                <span>🐶</span>
              </h3>

              <p>
                소비를 기록하고
                <br />
                정산을 깔끔하게 관리해요!
              </p>
            </div>

            <div className="expense-dog-image">
              <Image
                src="/chorong-v2.png"
                alt="소비를 기록하는 초롱이"
                width={190}
                height={150}
                priority
              />

              <span className="expense-user-badge">
                W
              </span>
            </div>
          </section>

          <section className="expense-block amount-block">
            <h4>금액입력</h4>

            <div className="new-amount-input">
              <span className="won-symbol">
                ₩
              </span>

              <input
                type="text"
                inputMode="numeric"
                value={
                  amount
                    ? formattedAmount
                    : ""
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
                  className="amount-clear-button"
                  onClick={resetAmount}
                  disabled={saving}
                  aria-label="금액 지우기"
                >
                  ×
                </button>
              )}
            </div>

            <div className="new-quick-buttons">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(1_000)
                }
              >
                + 1천원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(5_000)
                }
              >
                + 5천원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(10_000)
                }
              >
                + 1만원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  addAmount(50_000)
                }
              >
                + 5만원
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={resetAmount}
              >
                직접입력
              </button>
            </div>
          </section>

          <section className="expense-block">
            <h4>
              카테고리 선택
              <small> 최대 1개</small>
            </h4>

            <div className="new-category-grid">
              {categories.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  disabled={saving}
                  className={
                    category === item.name
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    setCategory(item.name)
                  }
                >
                  {category === item.name && (
                    <span className="category-check">
                      ✓
                    </span>
                  )}

                  <span className="category-icon">
                    {item.icon}
                  </span>

                  <span className="category-name">
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="expense-block">
            <h4>누구와 썼어?</h4>

            <div className="new-use-type">
              <button
                type="button"
                disabled={saving}
                className={
                  useType === "alone"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setUseType("alone")
                }
              >
                <span>👤</span>
                나혼자
              </button>

              <button
                type="button"
                disabled={saving}
                className={
                  useType === "together"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setUseType("together")
                }
              >
                <span>👥</span>
                둘이 함께
              </button>
            </div>

            <div className="content-date-row">
              <label>
                <span>내용</span>

                <div className="text-input-wrap">
                  <input
                    value={content}
                    disabled={saving}
                    placeholder="사용 내용을 입력하세요"
                    onChange={(event) =>
                      setContent(
                        event.target.value,
                      )
                    }
                  />

                  {content && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        setContent("")
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              </label>

              <label>
                <span>날짜</span>

                <input
                  type="date"
                  value={date}
                  disabled={saving}
                  onChange={(event) =>
                    setDate(
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            {useType === "together" && (
              <div className="payment-detail-box">
                <h4>어떻게 계산했어?</h4>

                <div className="payment-type-row">
                  <button
                    type="button"
                    disabled={saving}
                    className={
                      paymentType === "split"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setPaymentType("split")
                    }
                  >
                    👥 나눠 냈어
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    className={
                      paymentType === "treat"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setPaymentType("treat")
                    }
                  >
                    🎁 한 명이 사줬어
                  </button>
                </div>

                <div className="payment-info-grid">
                  <div>
                    <span>누가 결제했어?</span>

                    <div className="payer-row">
                      <button
                        type="button"
                        disabled={saving}
                        className={
                          payer === "me"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setPayer("me")
                        }
                      >
                        내가 결제
                      </button>

                      <button
                        type="button"
                        disabled={
                          saving || !partnerId
                        }
                        className={
                          payer === "partner"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setPayer("partner")
                        }
                      >
                        상대가 결제
                      </button>
                    </div>
                  </div>

                  {paymentType === "split" && (
                    <div>
                      <span>내 부담금</span>

                      <div className="share-amount">
                        ₩{" "}
                        {myShare.toLocaleString(
                          "ko-KR",
                        )}
                      </div>
                    </div>
                  )}

                  {paymentType === "split" && (
                    <div className="settlement-status">
                      <span>정산 상태?</span>

                      <div>
                        <button
                          type="button"
                          disabled={saving}
                          className={
                            settlementStatus ===
                            "pending"
                              ? "pending selected"
                              : "pending"
                          }
                          onClick={() =>
                            setSettlementStatus(
                              "pending",
                            )
                          }
                        >
                          정산전
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          className={
                            settlementStatus ===
                            "complete"
                              ? "complete selected"
                              : "complete"
                          }
                          onClick={() =>
                            setSettlementStatus(
                              "complete",
                            )
                          }
                        >
                          정산 완료
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="expense-block memo-block">
            <h4>
              메모 <small>선택</small>
            </h4>

            <div className="memo-textarea-wrap">
              <textarea
                maxLength={50}
                value={memo}
                disabled={saving}
                placeholder="메모를 입력해주세요 (최대 50자)"
                onChange={(event) =>
                  setMemo(event.target.value)
                }
              />

              <span>{memo.length}/50</span>
            </div>
          </section>

          {message && (
            <p className="expense-save-message">
              {message}
            </p>
          )}
        </div>

        <div className="expense-save-area">
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
              : `💸 ${
                  formattedAmount || "0"
                }원 저장하기`}
          </button>
        </div>
      </section>
    </div>
  );
}