"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import "./settlement.css";

const supabase = createClient();

type SettlementFilter =
  | "all"
  | "pay"
  | "receive";

type ProfileData = {
  id: string;
  nickname: string | null;
  couple_id: string | null;
};

type SettlementExpense = {
  id: string;
  couple_id: string;
  user_id: string;
  amount: number;
  category: string;
  title: string | null;
  memo: string | null;
  expense_date: string;
  payer_id: string | null;
  my_share: number;
  partner_share: number;
  settlement_status:
    | "정산대기"
    | "정산완료"
    | "해당없음";
  settlement_sent_at: string | null;
  settlement_sent_by: string | null;
  settlement_sent_amount: number;
  settled_amount: number;
  settled_at: string | null;
  created_at: string;
};

type SettlementItem = SettlementExpense & {
  direction: "pay" | "receive";
  settlementAmount: number;
  settledAmount: number;
  remainingAmount: number;
  pendingSentAmount: number;
  receiverId: string;
  debtorId: string;
  payerName: string;
};

type PartialSettlementAction = {
  expenseId: string;
  direction: "pay" | "receive";
  remainingAmount: number;
  suggestedAmount: number;
};

const categoryIcons: Record<
  string,
  string
> = {
  식비: "🍚",
  카페: "☕",
  교통: "🚌",
  쇼핑: "🛍️",
  문화: "🎬",
  생활비: "🏠",
  의료: "💊",
  기타: "💰",
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthRange(
  year: number,
  month: number,
) {
  return {
    start: formatLocalDate(
      new Date(year, month, 1),
    ),

    end: formatLocalDate(
      new Date(year, month + 1, 1),
    ),
  };
}

function formatKoreanDate(
  dateString: string,
) {
  const date = new Date(
    `${dateString}T00:00:00`,
  );

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function SettlementPage() {
  const router = useRouter();

  const now = new Date();

  const [year, setYear] = useState(
    now.getFullYear(),
  );

  const [month, setMonth] = useState(
    now.getMonth(),
  );

  const [filter, setFilter] =
    useState<SettlementFilter>("all");

  const [loading, setLoading] =
    useState(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [partialAction, setPartialAction] =
    useState<PartialSettlementAction | null>(null);

  const [partialAmount, setPartialAmount] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [userId, setUserId] =
    useState<string | null>(null);

  const [partnerId, setPartnerId] =
    useState<string | null>(null);

  const [nickname, setNickname] =
    useState("나");

  const [
    partnerNickname,
    setPartnerNickname,
  ] = useState("상대");

  const [expenses, setExpenses] =
    useState<SettlementExpense[]>([]);

  const monthRange = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const loadSettlements =
    useCallback(async () => {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const {
        data: profileResult,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, nickname, couple_id",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (
        profileError ||
        !profileResult
      ) {
        console.error(
          "프로필 조회 오류:",
          profileError,
        );

        setMessage(
          "프로필 정보를 불러오지 못했어요.",
        );

        setLoading(false);
        return;
      }

      const profile =
        profileResult as ProfileData;

      if (!profile.couple_id) {
        router.replace(
          "/couple/connect",
        );

        return;
      }

      setUserId(user.id);

      setNickname(
        profile.nickname ?? "나",
      );

      const {
        data: partnerResult,
        error: partnerError,
      } = await supabase
        .from("profiles")
        .select(
          "id, nickname, couple_id",
        )
        .eq(
          "couple_id",
          profile.couple_id,
        )
        .neq("id", user.id)
        .limit(1)
        .maybeSingle();

      if (partnerError) {
        console.error(
          "상대방 조회 오류:",
          partnerError,
        );
      }

      const partner =
        partnerResult as
          | ProfileData
          | null;

      setPartnerId(
        partner?.id ?? null,
      );

      setPartnerNickname(
        partner?.nickname ?? "상대",
      );

      const {
        data: expenseResult,
        error: expenseError,
      } = await supabase
        .from("expenses")
        .select(`
          id,
          couple_id,
          user_id,
          amount,
          category,
          title,
          memo,
          expense_date,
          payer_id,
          my_share,
          partner_share,
          settlement_status,
          settlement_sent_at,
          settlement_sent_by,
          settlement_sent_amount,
          settled_amount,
          settled_at,
          created_at
        `)
        .eq(
          "couple_id",
          profile.couple_id,
        )
        .eq("use_type", "함께")
        .eq(
          "payment_type",
          "나눠내기",
        )
        .order("expense_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (expenseError) {
        console.error(
          "정산 기록 조회 오류:",
          expenseError,
        );

        setMessage(
          "정산 기록을 불러오지 못했어요.",
        );

        setExpenses([]);
        setLoading(false);
        return;
      }

      const loadedExpenses =
        (expenseResult as
          | SettlementExpense[]
          | null) ?? [];

      setExpenses(
        loadedExpenses.filter(
          (expense) =>
            expense.settlement_status !== "정산완료" ||
            (expense.expense_date >= monthRange.start &&
              expense.expense_date < monthRange.end),
        ),
      );

      setLoading(false);
    }, [
      monthRange.end,
      monthRange.start,
      router,
    ]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const settlementItems =
    useMemo<SettlementItem[]>(() => {
      if (
        !userId ||
        !partnerId
      ) {
        return [];
      }

      return expenses
        .map((expense) => {
          const receiverId =
            expense.payer_id;

          if (!receiverId) {
            return null;
          }

          /*
           * 기록 작성자가 결제한 경우
           * 상대방이 돈을 보내야 함.
           */
          const payerIsCreator =
            receiverId ===
            expense.user_id;

          const debtorId =
            payerIsCreator
              ? expense.user_id === userId
                ? partnerId
                : userId
              : expense.user_id;

          const settlementAmount =
            payerIsCreator
              ? Number(
                  expense.partner_share ||
                    0,
                )
              : Number(
                  expense.my_share || 0,
                );

          const settledAmount = Math.min(
            settlementAmount,
            Number(expense.settled_amount || 0),
          );

          const remainingAmount = Math.max(
            0,
            settlementAmount - settledAmount,
          );

          const pendingSentAmount = Math.min(
            remainingAmount,
            Number(expense.settlement_sent_amount || 0),
          );

          if (
            receiverId !== userId &&
            debtorId !== userId
          ) {
            return null;
          }

          return {
            ...expense,

            receiverId,
            debtorId,

            settlementAmount,
            settledAmount,
            remainingAmount,
            pendingSentAmount,

            direction:
              receiverId === userId
                ? "receive"
                : "pay",

            payerName:
              receiverId === userId
                ? nickname
                : partnerNickname,
          };
        })
        .filter(
          (
            item,
          ): item is SettlementItem =>
            Boolean(item) &&
            Number(
              item?.settlementAmount ||
                0,
            ) > 0,
        );
    }, [
      expenses,
      nickname,
      partnerId,
      partnerNickname,
      userId,
    ]);

  const pendingItems =
    settlementItems.filter(
      (item) =>
        item.settlement_status !==
        "정산완료",
    );

  const receivableAmount =
    pendingItems
      .filter(
        (item) =>
          item.direction ===
          "receive",
      )
      .reduce(
        (total, item) =>
          total +
          item.remainingAmount,
        0,
      );

  const payableAmount =
    pendingItems
      .filter(
        (item) =>
          item.direction === "pay",
      )
      .reduce(
        (total, item) =>
          total +
          item.remainingAmount,
        0,
      );

  const finalAmount =
    receivableAmount -
    payableAmount;

  const filteredItems =
    settlementItems.filter(
      (item) => {
        if (filter === "all") {
          return true;
        }

        return (
          item.direction === filter
        );
      },
    );

  const changeMonth = (
    amount: number,
  ) => {
    const next = new Date(
      year,
      month + amount,
      1,
    );

    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const handleMarkSent = async (
    expenseId: string,
    amount: number,
  ) => {
    if (processingId) {
      return;
    }

    setProcessingId(expenseId);
    setMessage("");

    const { error } =
      await supabase.rpc(
        "mark_partial_settlement_sent",
        {
          target_expense_id:
            expenseId,
          payment_amount: amount,
        },
      );

    if (error) {
      console.error(
        "송금 처리 오류:",
        error,
      );

      setMessage(
        error.message ||
          "송금 상태를 변경하지 못했어요.",
      );

      setProcessingId(null);
      return;
    }

    setMessage(
      `${amount.toLocaleString("ko-KR")}원을 보냈다고 표시했어요. 상대방이 확인하면 반영됩니다.`,
    );

    setPartialAction(null);
    setPartialAmount("");
    setProcessingId(null);

    await loadSettlements();
  };

  const handleComplete = async (
  expenseId: string,
  amount: number,
) => {
  if (processingId) {
    return;
  }

  setProcessingId(expenseId);
  setMessage("");

  const { error } = await supabase.rpc(
    "complete_partial_expense_settlement",
    {
      target_expense_id: expenseId,
      payment_amount: amount,
    },
  );

  if (error) {
  const errorMessage = [
    error.message,
    error.details,
    error.hint,
    error.code,
  ]
    .filter(Boolean)
    .join("\n");

  alert(
    errorMessage ||
      "정산을 완료하지 못했어요.",
  );

  setMessage(
    errorMessage ||
      "정산을 완료하지 못했어요.",
  );

  setProcessingId(null);
  return;
}

  setMessage(
    `${amount.toLocaleString("ko-KR")}원 정산을 반영했어요.`,
  );

  setPartialAction(null);
  setPartialAmount("");
  setProcessingId(null);

  await loadSettlements();
};

  const openPartialAction = (
    item: SettlementItem,
  ) => {
    const suggestedAmount =
      item.direction === "receive" &&
      item.pendingSentAmount > 0
        ? item.pendingSentAmount
        : item.remainingAmount;

    setPartialAction({
      expenseId: item.id,
      direction: item.direction,
      remainingAmount: item.remainingAmount,
      suggestedAmount,
    });
    setPartialAmount(String(suggestedAmount));
    setMessage("");
  };

  const submitPartialAction = async () => {
    if (!partialAction || processingId) {
      return;
    }

    const amount = Number(partialAmount || 0);

    if (
      amount <= 0 ||
      amount > partialAction.remainingAmount
    ) {
      setMessage("남은 정산액 안에서 금액을 입력해 주세요.");
      return;
    }

    if (partialAction.direction === "pay") {
      await handleMarkSent(partialAction.expenseId, amount);
      return;
    }

    await handleComplete(partialAction.expenseId, amount);
  };

  if (loading) {
    return (
      <main className="settlement-loading">
        정산 기록을 불러오고 있어요...
      </main>
    );
  }

  return (
    <main className="settlement-page">
      <header className="settlement-page-header">
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          aria-label="뒤로 가기"
        >
          ←
        </button>

        <h1>
          정산 <span>🐶</span>
        </h1>

        <div className="settlement-month-control">
          <button
            type="button"
            onClick={() =>
              changeMonth(-1)
            }
            aria-label="이전 달"
          >
            ‹
          </button>

          <strong>
            {month + 1}월
          </strong>

          <button
            type="button"
            onClick={() =>
              changeMonth(1)
            }
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </header>

      <section className="settlement-summary">
        <header>
          <h2>정산 요약</h2>

          <span>
            {year}년 {month + 1}월
          </span>
        </header>

        <div className="settlement-summary-grid">
          <article className="receive">
            <div>
              <span>내가 받을 돈</span>

              <strong>
                {receivableAmount.toLocaleString(
                  "ko-KR",
                )}
                <small>원</small>
              </strong>
            </div>

            <div className="settlement-money-icon">
              💰
            </div>
          </article>

          <article className="pay">
            <div>
              <span>내가 줄 돈</span>

              <strong>
                {payableAmount.toLocaleString(
                  "ko-KR",
                )}
                <small>원</small>
              </strong>
            </div>

            <div className="settlement-money-icon">
              💸
            </div>
          </article>
        </div>

        <div className="settlement-final">
          <div>
            <span>최종 정산</span>

            <strong>
              {Math.abs(
                finalAmount,
              ).toLocaleString("ko-KR")}
              <small>원</small>
            </strong>
          </div>

          <em>
            {finalAmount > 0
              ? "받을 예정"
              : finalAmount < 0
                ? "보낼 예정"
                : "정산할 금액 없음"}
          </em>
        </div>
      </section>

      <nav className="settlement-filters">
        <button
          type="button"
          className={
            filter === "all"
              ? "active"
              : ""
          }
          onClick={() =>
            setFilter("all")
          }
        >
          전체
        </button>

        <button
          type="button"
          className={
            filter === "pay"
              ? "active"
              : ""
          }
          onClick={() =>
            setFilter("pay")
          }
        >
          내가 줄 돈
        </button>

        <button
          type="button"
          className={
            filter === "receive"
              ? "active"
              : ""
          }
          onClick={() =>
            setFilter("receive")
          }
        >
          내가 받을 돈
        </button>
      </nav>

      {message && (
        <p className="settlement-message">
          {message}
        </p>
      )}

      <section className="settlement-list-section">
        <header>
          <span>
            정산 상태 목록
          </span>

          <strong>
            최신순
          </strong>
        </header>

        {filteredItems.length === 0 ? (
          <div className="settlement-empty">
            <span>🤝</span>

            <strong>
              정산 기록이 없어요
            </strong>

            <p>
              둘이 함께 사용한 소비를
              나눠내기로 등록하면 표시돼요.
            </p>
          </div>
        ) : (
          <div className="settlement-list">
            {filteredItems.map(
              (item) => {
                const completed =
                  item.settlement_status ===
                  "정산완료";

                const sent =
                  item.pendingSentAmount > 0;

                const processing =
                  processingId === item.id;

                return (
                  <article
                    className="settlement-item"
                    key={item.id}
                  >
                    <div
                      className={`settlement-category-icon ${
                        item.direction
                      }`}
                    >
                      {categoryIcons[
                        item.category
                      ] ?? "💰"}
                    </div>

                    <div className="settlement-item-content">
                      <strong>
                        {item.title ||
                          item.category}
                      </strong>

                      <span>
                        {formatKoreanDate(
                          item.expense_date,
                        )}
                        {" · "}
                        {item.payerName}님이 결제
                      </span>

                      <small>
                        총{" "}
                        {Number(
                          item.amount,
                        ).toLocaleString(
                          "ko-KR",
                        )}
                        원
                      </small>
                    </div>

                    <div className="settlement-item-status">
                      <strong
                        className={
                          item.direction
                        }
                      >
                        {item.remainingAmount.toLocaleString(
                          "ko-KR",
                        )}
                        원
                      </strong>

                      <span>
                        {item.direction ===
                        "pay"
                          ? "내가 줄 돈"
                          : "내가 받을 돈"}
                      </span>

                      {!completed && item.settledAmount > 0 && (
                        <small className="settlement-progress">
                          {item.settledAmount.toLocaleString("ko-KR")}원 정산됨
                        </small>
                      )}

                      {completed ? (
                        <em className="completed">
                          정산 완료
                        </em>
                      ) : sent ? (
                        <em className="sent">
                          {item.pendingSentAmount.toLocaleString("ko-KR")}원 보냈어요
                        </em>
                      ) : (
                        <em className="pending">
                          정산전
                        </em>
                      )}
                    </div>

                    <div className="settlement-item-action">
                      {completed ? (
                        <button
                          type="button"
                          className="completed"
                          disabled
                        >
                          완료
                        </button>
                      ) : item.direction ===
                        "pay" ? (
                        <span className="settlement-receiver-only">
                          받는 사람이 확인해요
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="complete"
                          disabled={processing}
                          onClick={() =>
                            openPartialAction(item)
                          }
                        >
                          {processing
                            ? "처리 중"
                            : "정산 확인"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      {partialAction && (
        <div
          className="partial-settlement-backdrop"
          onClick={() => {
            if (!processingId) {
              setPartialAction(null);
            }
          }}
        >
          <section
            className="partial-settlement-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>
                  {partialAction.direction === "pay"
                    ? "송금 표시"
                    : "부분 정산"}
                </span>
                <strong>
                  {partialAction.direction === "pay"
                    ? "얼마를 보냈나요?"
                    : "얼마를 받았나요?"}
                </strong>
              </div>

              <button
                type="button"
                disabled={Boolean(processingId)}
                onClick={() => setPartialAction(null)}
                aria-label="부분 정산 닫기"
              >
                ×
              </button>
            </header>

            <p>
              남은 정산액
              <strong>
                {partialAction.remainingAmount.toLocaleString("ko-KR")}원
              </strong>
            </p>

            <label>
              <span>
                {partialAction.direction === "pay"
                  ? "이번에 보낸 금액"
                  : "이번에 확인할 금액"}
              </span>
              <div>
                <span>₩</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={
                    partialAmount
                      ? Number(partialAmount).toLocaleString("ko-KR")
                      : ""
                  }
                  disabled={Boolean(processingId)}
                  onChange={(event) =>
                    setPartialAmount(
                      event.target.value.replace(/[^0-9]/g, ""),
                    )
                  }
                />
              </div>
            </label>

            <button
              type="button"
              className="partial-settlement-submit"
              disabled={Boolean(processingId) || !partialAmount}
              onClick={() => void submitPartialAction()}
            >
              {processingId
                ? "처리 중..."
                : partialAction.direction === "pay"
                  ? "보냈다고 표시"
                  : "받은 금액 반영"}
            </button>

            <small>
              {partialAction.direction === "pay"
                ? "상대방이 받은 금액을 확인해야 정산에 반영돼요."
                : "전액을 확인하면 정산 완료되고, 일부만 확인하면 남은 금액이 계속 표시돼요."}
            </small>
          </section>
        </div>
      )}
    </main>
  );
}
