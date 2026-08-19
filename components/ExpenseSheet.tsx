"use client";

import Image from "next/image";
import {
  useEffect,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import "./ExpenseSheet.css";

const supabase = createClient();

type ExpenseSheetProps = {
  open: boolean;
  onClose: () => void;
  coupleId: string | null;
  partnerId: string | null;
  initialDate?: string;
  onSave: () => void;
};

type UseType =
  | "alone"
  | "together";

type PaymentType =
  | "split"
  | "treat";

type Payer =
  | "me"
  | "partner";

type SettlementStatus =
  | "pending"
  | "complete";

const categories = [
  {
    name: "식비",
    icon: "🍚",
  },
  {
    name: "카페",
    icon: "☕",
  },
  {
    name: "교통",
    icon: "🚌",
  },
  {
    name: "쇼핑",
    icon: "🛍️",
  },
  {
    name: "문화",
    icon: "🎬",
  },
  {
    name: "생활비",
    icon: "🏠",
  },
  {
    name: "의료",
    icon: "💊",
  },
{ name: "미용", icon: "💄" },
  {
    name: "기타",
    icon: "＋",
  },
];

function getTodayString() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month = String(
    now.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    now.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function ExpenseSheet({
  open,
  onClose,
  coupleId,
  partnerId,
  initialDate,
  onSave,
}: ExpenseSheetProps) {
  const [
    amount,
    setAmount,
  ] = useState("");

  const [
    myShareInput,
    setMyShareInput,
  ] = useState("");

  const [
    category,
    setCategory,
  ] = useState("식비");

  const [
    useType,
    setUseType,
  ] = useState<UseType>(
    "alone",
  );

  const [
    paymentType,
    setPaymentType,
  ] = useState<PaymentType>(
    "split",
  );

  const [
    payer,
    setPayer,
  ] = useState<Payer>("me");

  const [
    settlementStatus,
    setSettlementStatus,
  ] =
    useState<SettlementStatus>(
      "pending",
    );

  const [
    content,
    setContent,
  ] = useState("");

  const [
    contentSuggestions,
    setContentSuggestions,
  ] = useState<string[]>([]);

  const [
    suggestionsLoading,
    setSuggestionsLoading,
  ] = useState(false);

  const [
    hiddenContentSuggestions,
    setHiddenContentSuggestions,
  ] = useState<string[]>([]);

  const [
    suggestionToManage,
    setSuggestionToManage,
  ] = useState<string | null>(null);

  const [
    managingSuggestion,
    setManagingSuggestion,
  ] = useState(false);

  const [
    mergeTargetInput,
    setMergeTargetInput,
  ] = useState("");

  const [
    memo,
    setMemo,
  ] = useState("");

  const [
    date,
    setDate,
  ] = useState(
    initialDate ??
      getTodayString(),
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setDate(
      initialDate ??
        getTodayString(),
    );

    setMessage("");
  }, [open, initialDate]);

  useEffect(() => {
    if (!open || !coupleId) {
      setContentSuggestions([]);
      return;
    }

    let cancelled = false;

    const loadContentSuggestions = async () => {
      setSuggestionsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setContentSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("expenses")
        .select("title, created_at")
        .eq("couple_id", coupleId)
        .eq("user_id", user.id)
        .eq("category", category)
        .not("title", "is", null)
        .order("created_at", {
          ascending: false,
        })
        .limit(100);

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "소비 내용 추천 불러오기 오류:",
          error,
        );
        setContentSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      const seen = new Set<string>();
      const suggestions: string[] = [];

      for (const row of data ?? []) {
        const title = row.title?.trim();
        const normalized = title?.toLocaleLowerCase(
          "ko-KR",
        );

        if (!title || !normalized || seen.has(normalized)) {
          continue;
        }

        seen.add(normalized);
        suggestions.push(title);
      }

      setContentSuggestions(suggestions);
      setSuggestionsLoading(false);
    };

    void loadContentSuggestions();

    return () => {
      cancelled = true;
    };
  }, [category, coupleId, open]);

  useEffect(() => {
    if (!open || !coupleId) {
      setHiddenContentSuggestions([]);
      return;
    }

    const storageKey = `hidden-expense-content:${coupleId}:${category}`;

    try {
      const stored = window.localStorage.getItem(storageKey);
      setHiddenContentSuggestions(
        stored ? JSON.parse(stored) : [],
      );
    } catch {
      setHiddenContentSuggestions([]);
    }
  }, [category, coupleId, open]);

  if (!open) {
    return null;
  }

  const normalizedContent =
    content.trim().toLocaleLowerCase(
      "ko-KR",
    );

  const matchingContentSuggestions =
    normalizedContent
      ? contentSuggestions
          .filter((suggestion) => {
            const normalizedSuggestion =
              suggestion.toLocaleLowerCase(
                "ko-KR",
              );

            return (
              (normalizedSuggestion.includes(
                normalizedContent,
              ) ||
                normalizedContent.includes(
                  normalizedSuggestion,
                )) &&
              normalizedSuggestion !==
                normalizedContent &&
              !hiddenContentSuggestions.includes(
                normalizedSuggestion,
              )
            );
          })
          .slice(0, 5)
      : [];

  const numericAmount =
    Number(amount || 0);

  const formattedAmount =
    numericAmount.toLocaleString(
      "ko-KR",
    );

  const myShare =
    myShareInput === ""
      ? Math.floor(
          numericAmount / 2,
        )
      : Number(myShareInput);

  const partnerShare =
    numericAmount - myShare;

  const invalidShare =
    useType === "together" &&
    paymentType === "split" &&
    (myShare < 0 || myShare > numericAmount);

  const hideContentSuggestion = () => {
    if (!suggestionToManage || !coupleId) {
      return;
    }

    const normalized = suggestionToManage.toLocaleLowerCase(
      "ko-KR",
    );
    const nextHidden = Array.from(
      new Set([
        ...hiddenContentSuggestions,
        normalized,
      ]),
    );

    setHiddenContentSuggestions(nextHidden);
    window.localStorage.setItem(
      `hidden-expense-content:${coupleId}:${category}`,
      JSON.stringify(nextHidden),
    );
    setSuggestionToManage(null);
  };

  const restoreContentSuggestion = (
    title: string,
  ) => {
    if (!coupleId || !title.trim()) {
      return;
    }

    const normalized = title
      .trim()
      .toLocaleLowerCase("ko-KR");

    setHiddenContentSuggestions((current) => {
      const nextHidden = current.filter(
        (hidden) => hidden !== normalized,
      );

      window.localStorage.setItem(
        `hidden-expense-content:${coupleId}:${category}`,
        JSON.stringify(nextHidden),
      );

      return nextHidden;
    });
  };

  const mergeContentSuggestion = async () => {
    const targetTitle = mergeTargetInput.trim();

    if (
      !suggestionToManage ||
      !targetTitle ||
      !coupleId
    ) {
      return;
    }

    setManagingSuggestion(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("로그인 정보를 확인하지 못했어요.");
      setManagingSuggestion(false);
      return;
    }

    const oldTitle = suggestionToManage;
    const { data, error } = await supabase
      .from("expenses")
      .update({ title: targetTitle })
      .eq("couple_id", coupleId)
      .eq("user_id", user.id)
      .eq("category", category)
      .eq("title", oldTitle)
      .select("id");

    if (error) {
      console.error("소비 내용 통합 오류:", error);
      setMessage("소비 내용을 통합하지 못했어요.");
      setManagingSuggestion(false);
      return;
    }

    setContentSuggestions((current) =>
      Array.from(
        new Set(
          current.map((suggestion) =>
            suggestion === oldTitle
              ? targetTitle
              : suggestion,
          ),
        ),
      ),
    );
    setSuggestionToManage(null);
    setMergeTargetInput("");
    setManagingSuggestion(false);
    setMessage(
      `${data?.length ?? 0}건을 '${targetTitle}'로 통합했어요.`,
    );
  };

  const addAmount = (
    value: number,
  ) => {
    setAmount((current) =>
      String(
        Number(
          current || 0,
        ) + value,
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
    setMyShareInput("");
    setCategory("식비");
    setUseType("alone");
    setPaymentType("split");
    setPayer("me");
    setSettlementStatus(
      "pending",
    );
    setContent("");
    setMemo("");

    setDate(
      initialDate ??
        getTodayString(),
    );

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
    setMessage("연결된 가계부를 찾지 못했어요.");
    return;
  }

  if (numericAmount <= 0) {
    setMessage("금액을 입력해 주세요.");
    return;
  }

  if (
    useType === "together" &&
    paymentType === "split" &&
    (myShare < 0 || myShare > numericAmount)
  ) {
    setMessage("내 부담금은 전체 금액 안에서 입력해 주세요.");
    return;
  }

  if (!date) {
    setMessage("날짜를 선택해 주세요.");
    return;
  }

  if (
    useType === "together" &&
    payer === "partner" &&
    !partnerId
  ) {
    setMessage("연결된 상대방 정보를 찾지 못했어요.");
    return;
  }

  setSaving(true);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("로그인 정보를 확인하지 못했어요.");
    }

    const isTogether = useType === "together";

    const isSplit =
      isTogether && paymentType === "split";

    const payerId = !isTogether
      ? user.id
      : payer === "me"
        ? user.id
        : partnerId;

    // 소비를 저장하고 생성된 소비 id를 받아옴
    const {
      data: insertedExpense,
      error: insertError,
    } = await supabase
      .from("expenses")
      .insert({
        couple_id: coupleId,

        user_id: user.id,

        amount: numericAmount,

        category,

        title: content.trim() || null,

        memo: memo.trim() || null,

        expense_date: date,

        use_type: isTogether ? "함께" : "혼자",

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
          ? settlementStatus === "pending"
            ? "정산대기"
            : "정산완료"
          : "해당없음",

        settled_at:
          isSplit &&
          settlementStatus === "complete"
            ? new Date().toISOString()
            : null,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    // 연결된 상대방이 있을 때 상대방에게 알림 생성
    if (partnerId && insertedExpense) {
      const expenseTitle =
        content.trim() || category;

      const { error: notificationError } =
        await supabase
          .from("notifications")
          .insert({
            couple_id: coupleId,

            // 기존 테이블 컬럼명은 receiver_id가 아니라 recipient_id
            recipient_id: partnerId,

            actor_id: user.id,

            expense_id: insertedExpense.id,

            type: "expense",

            title: "새로운 소비 기록",

            message: `${expenseTitle} ${numericAmount.toLocaleString(
              "ko-KR",
            )}원이 등록됐어요.`,

            is_read: false,
          });

      if (notificationError) {
        // 알림 저장이 실패해도 소비 기록 자체는 유지
        console.error(
          "알림 생성 오류:",
          notificationError,
        );
      }
    }

    const savedContent = content.trim();

    if (savedContent) {
      restoreContentSuggestion(savedContent);
      setContentSuggestions((current) => [
        savedContent,
        ...current.filter(
          (suggestion) =>
            suggestion.toLocaleLowerCase("ko-KR") !==
            savedContent.toLocaleLowerCase("ko-KR"),
        ),
      ]);
    }

    onSave();
    resetForm();
    onClose();
  } catch (error) {
    console.error("소비 저장 오류:", error);

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
      onClick={
        handleClose
      }
    >
      <section
        className="expense-sheet-new"
        onClick={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="expense-sheet-handle" />

        <header className="expense-sheet-title">
          <h2>소비 기록</h2>

          <button
            type="button"
            onClick={
              handleClose
            }
            disabled={
              saving
            }
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
                <span>
                  🐶
                </span>
              </h3>

              <p>
                소비를
                기록하고
                <br />
                정산을 깔끔하게
                관리해요!
              </p>
            </div>

            <div className="expense-dog-image">
              <Image
                src="/chorong-mint-collar-no-charm-v2.png"
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
            <h4>
              금액입력
            </h4>

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
                disabled={
                  saving
                }
                onChange={(
                  event,
                ) => {
                  const value =
                    event.target.value.replace(
                      /[^0-9]/g,
                      "",
                    );

                  setAmount(
                    value,
                  );

                  setMessage(
                    "",
                  );
                }}
              />

              {amount && (
                <button
                  type="button"
                  className="amount-clear-button"
                  onClick={
                    resetAmount
                  }
                  disabled={
                    saving
                  }
                  aria-label="금액 지우기"
                >
                  ×
                </button>
              )}
            </div>

            <div className="new-quick-buttons">
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  addAmount(
                    1_000,
                  )
                }
              >
                + 1천원
              </button>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  addAmount(
                    5_000,
                  )
                }
              >
                + 5천원
              </button>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  addAmount(
                    10_000,
                  )
                }
              >
                + 1만원
              </button>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  addAmount(
                    50_000,
                  )
                }
              >
                + 5만원
              </button>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  resetAmount
                }
              >
                직접입력
              </button>
            </div>
          </section>

          <section className="expense-block">
            <h4>
              카테고리 선택
              <small>
                {" "}
                최대 1개
              </small>
            </h4>

            <div className="new-category-grid">
              {categories.map(
                (item) => (
                  <button
                    key={
                      item.name
                    }
                    type="button"
                    disabled={
                      saving
                    }
                    className={
                      category ===
                      item.name
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setCategory(
                        item.name,
                      )
                    }
                  >
                    {category ===
                      item.name && (
                      <span className="category-check">
                        ✓
                      </span>
                    )}

                    <span className="category-icon">
                      {
                        item.icon
                      }
                    </span>

                    <span className="category-name">
                      {
                        item.name
                      }
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="expense-block">
            <h4>
              누구와 썼어?
            </h4>

            <div className="new-use-type">
              <button
                type="button"
                disabled={
                  saving
                }
                className={
                  useType ===
                  "alone"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setUseType(
                    "alone",
                  )
                }
              >
                <span>
                  👤
                </span>
                나혼자
              </button>

              <button
                type="button"
                disabled={
                  saving
                }
                className={
                  useType ===
                  "together"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setUseType(
                    "together",
                  )
                }
              >
                <span>
                  👥
                </span>
                둘이 함께
              </button>
            </div>

            <div className="content-date-row">
              <label>
                <span>
                  내용
                </span>

                <div className="text-input-wrap">
                  <input
                    value={
                      content
                    }
                    disabled={
                      saving
                    }
                    placeholder="사용 내용을 입력하세요"
                    onChange={(
                      event,
                    ) =>
                      setContent(
                        event.target
                          .value,
                      )
                    }
                  />

                  {content && (
                    <button
                      type="button"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        setContent(
                          "",
                        )
                      }
                    >
                      ×
                    </button>
                  )}
                </div>

                {normalizedContent &&
                  (suggestionsLoading ||
                    matchingContentSuggestions.length > 0) && (
                  <div className="content-suggestions">
                    <span>
                      {suggestionsLoading
                        ? "연관 내용을 찾는 중..."
                        : "연관된 이전 내용"}
                    </span>

                    {!suggestionsLoading && (
                      <div>
                        {matchingContentSuggestions.map(
                          (suggestion) => (
                            <div
                              className="content-suggestion-row"
                              key={suggestion}
                            >
                              <button
                                type="button"
                                className="content-suggestion-select"
                                disabled={saving}
                                onClick={() =>
                                  setContent(suggestion)
                                }
                              >
                                {suggestion}
                              </button>

                              <button
                                type="button"
                                className="content-suggestion-remove"
                                disabled={saving}
                                aria-label={`${suggestion} 정리하기`}
                                onClick={() =>
                                  {
                                    setSuggestionToManage(
                                      suggestion,
                                    );
                                    setMergeTargetInput("");
                                  }
                                }
                              >
                                ×
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </label>

              <label>
                <span>
                  날짜
                </span>

                <input
                  type="date"
                  value={
                    date
                  }
                  disabled={
                    saving
                  }
                  onChange={(
                    event,
                  ) =>
                    setDate(
                      event.target
                        .value,
                    )
                  }
                />
              </label>
            </div>

            {useType ===
              "together" && (
              <div className="payment-detail-box">
                <h4>
                  어떻게 계산했어?
                </h4>

                <div className="payment-type-row">
                  <button
                    type="button"
                    disabled={
                      saving
                    }
                    className={
                      paymentType ===
                      "split"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setPaymentType(
                        "split",
                      )
                    }
                  >
                    👥 나눠
                    냈어
                  </button>

                  <button
                    type="button"
                    disabled={
                      saving
                    }
                    className={
                      paymentType ===
                      "treat"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setPaymentType(
                        "treat",
                      )
                    }
                  >
                    🎁 한 명이
                    사줬어
                  </button>
                </div>

                <div className="payment-info-grid">
                  <div>
                    <span>
                      누가
                      결제했어?
                    </span>

                    <div className="payer-row">
                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        className={
                          payer ===
                          "me"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setPayer(
                            "me",
                          )
                        }
                      >
                        내가 결제
                      </button>

                      <button
                        type="button"
                        disabled={
                          saving ||
                          !partnerId
                        }
                        className={
                          payer ===
                          "partner"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setPayer(
                            "partner",
                          )
                        }
                      >
                        상대가
                        결제
                      </button>
                    </div>
                  </div>

                  {paymentType ===
                    "split" && (
                    <div>
                      <span>
                        내 부담금
                      </span>

                      <div className="share-amount">
                        <span>₩</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            numericAmount > 0
                              ? myShare.toLocaleString("ko-KR")
                              : ""
                          }
                          disabled={saving}
                          aria-label="내 소비 부담금"
                          onChange={(event) =>
                            setMyShareInput(
                              event.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                        />
                      </div>
                      <small className="partner-share-guide">
                        상대 부담금 {Math.max(partnerShare, 0).toLocaleString("ko-KR")}원
                      </small>
                    </div>
                  )}

                  {paymentType ===
                    "split" && (
                    <div className="settlement-status">
                      <span>
                        정산 상태?
                      </span>

                      <div>
                        <button
                          type="button"
                          disabled={
                            saving
                          }
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
                          disabled={
                            saving
                          }
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
              메모{" "}
              <small>
                선택
              </small>
            </h4>

            <div className="memo-textarea-wrap">
              <textarea
                maxLength={
                  50
                }
                value={
                  memo
                }
                disabled={
                  saving
                }
                placeholder="메모를 입력해주세요 (최대 50자)"
                onChange={(
                  event,
                ) =>
                  setMemo(
                    event.target
                      .value,
                  )
                }
              />

              <span>
                {memo.length}
                /50
              </span>
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
              numericAmount <=
                0 ||
              invalidShare ||
              !coupleId
            }
            onClick={
              handleSave
            }
          >
            {saving
              ? "저장하는 중..."
              : `💸 ${
                  formattedAmount ||
                  "0"
                }원 저장하기`}
          </button>
        </div>
      </section>

      {suggestionToManage && (
        <div
          className="content-manage-backdrop"
          onClick={() => {
            if (!managingSuggestion) {
              setSuggestionToManage(null);
              setMergeTargetInput("");
            }
          }}
        >
          <section
            className="content-manage-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>연관 검색어 정리</h3>
            <p>
              <strong>{suggestionToManage}</strong>을(를) 어떻게 정리할까요?
            </p>

            <button
              type="button"
              disabled={managingSuggestion}
              onClick={hideContentSuggestion}
            >
              추천에서 삭제하기
              <small>기존 소비 기록은 유지돼요.</small>
            </button>

            <div className="content-merge-area">
              <label htmlFor="content-merge-target">
                다른 내용으로 통합
              </label>
              <input
                id="content-merge-target"
                type="text"
                value={mergeTargetInput}
                disabled={managingSuggestion}
                placeholder="통합할 내용 입력 (예: 음료수)"
                onChange={(event) =>
                  setMergeTargetInput(event.target.value)
                }
              />
              <button
                type="button"
                className="merge"
                disabled={
                  managingSuggestion ||
                  !mergeTargetInput.trim() ||
                  mergeTargetInput
                    .trim()
                    .toLocaleLowerCase("ko-KR") ===
                    suggestionToManage.toLocaleLowerCase("ko-KR")
                }
                onClick={mergeContentSuggestion}
              >
                입력한 내용으로 통합하기
                <small>금액과 날짜는 그대로 유지돼요.</small>
              </button>
            </div>

            <button
              type="button"
              className="cancel"
              disabled={managingSuggestion}
              onClick={() => {
                setSuggestionToManage(null);
                setMergeTargetInput("");
              }}
            >
              취소
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
