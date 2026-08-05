"use client";

import Image from "next/image";
import { useState } from "react";

type ExpenseSheetProps = {
  open: boolean;
  onClose: () => void;
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

export default function ExpenseSheet({
  open,
  onClose,
}: ExpenseSheetProps) {
  const [amount, setAmount] = useState("12000");
  const [category, setCategory] = useState("식비");
  const [useType, setUseType] = useState<UseType>("alone");

  const [paymentType, setPaymentType] =
    useState<PaymentType>("split");

  const [payer, setPayer] = useState<Payer>("me");

  const [settlementStatus, setSettlementStatus] =
    useState<SettlementStatus>("pending");

  const [content, setContent] = useState("스타벅스");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState("2026-07-30");

  if (!open) return null;

  const numericAmount = Number(amount || 0);
  const formattedAmount = numericAmount.toLocaleString("ko-KR");
  const splitAmount = Math.floor(numericAmount / 2);

  const addAmount = (value: number) => {
    setAmount((current) =>
      String(Number(current || 0) + value),
    );
  };

  const resetAmount = () => {
    setAmount("");
  };

  const handleSave = () => {
    if (numericAmount <= 0) {
      alert("금액을 입력해 주세요.");
      return;
    }

    const expenseData = {
      amount: numericAmount,
      category,
      useType,
      content,
      date,
      memo,

      paymentType:
        useType === "together" ? paymentType : null,

      payer:
        useType === "together" ? payer : null,

      myShare:
        useType === "together" &&
        paymentType === "split"
          ? splitAmount
          : numericAmount,

      settlementStatus:
        useType === "together" &&
        paymentType === "split"
          ? settlementStatus
          : null,
    };

    console.log("저장할 소비 내역:", expenseData);

    onClose();
  };

  return (
    <div
      className="expense-sheet-backdrop"
      onClick={onClose}
    >
      <section
        className="expense-sheet-new"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="expense-sheet-handle" />

        <header className="expense-sheet-title">
          <h2>소비 기록</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="expense-sheet-scroll">
          {/* 소개 영역 */}
          <section className="expense-intro">
            <div className="expense-intro-text">
              <h3>
                오늘 얼마 썼어? <span>🐶</span>
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

          {/* 금액 */}
          <section className="expense-block amount-block">
            <h4>금액입력</h4>

            <div className="new-amount-input">
              <span className="won-symbol">₩</span>

              <input
                type="text"
                inputMode="numeric"
                value={
                  amount
                    ? formattedAmount
                    : ""
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
                  className="amount-clear-button"
                  onClick={resetAmount}
                  aria-label="금액 지우기"
                >
                  ×
                </button>
              )}
            </div>

            <div className="new-quick-buttons">
              <button
                type="button"
                onClick={() => addAmount(1_000)}
              >
                + 1천원
              </button>

              <button
                type="button"
                onClick={() => addAmount(5_000)}
              >
                + 5천원
              </button>

              <button
                type="button"
                onClick={() => addAmount(10_000)}
              >
                + 1만원
              </button>

              <button
                type="button"
                onClick={() => addAmount(50_000)}
              >
                + 5만원
              </button>

              <button
                type="button"
                onClick={resetAmount}
              >
                직접입력
              </button>
            </div>
          </section>

          {/* 카테고리 */}
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

          {/* 누구와 사용 */}
          <section className="expense-block">
            <h4>누구와 썼어?</h4>

            <div className="new-use-type">
              <button
                type="button"
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
                  onChange={(event) =>
                    setDate(event.target.value)
                  }
                />
              </label>
            </div>

            {/* 둘이 함께 선택했을 때 */}
            {useType === "together" && (
              <div className="payment-detail-box">
                <h4>어떻게 계산했어?</h4>

                <div className="payment-type-row">
                  <button
                    type="button"
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
                        className={
                          payer === "partner"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setPayer(
                            "partner",
                          )
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
                        {splitAmount.toLocaleString(
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

          {/* 메모 */}
          <section className="expense-block memo-block">
            <h4>메모 <small>선택</small></h4>

            <div className="memo-textarea-wrap">
              <textarea
                maxLength={50}
                value={memo}
                placeholder="메모를 입력해주세요 (최대 50자)"
                onChange={(event) =>
                  setMemo(event.target.value)
                }
              />

              <span>{memo.length}/50</span>
            </div>
          </section>
        </div>

        <div className="expense-save-area">
          <button
            type="button"
            onClick={handleSave}
          >
            💸 {formattedAmount || "0"}원 저장하기
          </button>
        </div>
      </section>
    </div>
  );
}