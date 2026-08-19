"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./spending.css";

const supabase = createClient();

type ViewType = "me" | "partner";

type ExpenseRecord = {
  id: string;
  couple_id: string;
  user_id: string;
  amount: number;
  category: string;
  title: string | null;
  memo: string | null;
  expense_date: string;
  use_type: "혼자" | "함께";
  payment_type:
    | "나눠내기"
    | "사주기"
    | null;
  payer_id: string | null;
  my_share: number;
  partner_share: number;
  settlement_status:
    | "해당없음"
    | "정산대기"
    | "정산완료";
  settled_at: string | null;
  created_at: string;
};

type ProfileData = {
  id: string;
  nickname: string | null;
  couple_id: string | null;
};

type CategorySummary = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
};

type EditForm = {
  amount: string;
  myShare: string;
  category: string;
  title: string;
  memo: string;
  expenseDate: string;
  useType: "혼자" | "함께";
  paymentType:
    | "나눠내기"
    | "사주기";
  payer: "me" | "partner";
  settlementStatus:
    | "정산대기"
    | "정산완료";
};

const categoryInfo: Record<
  string,
  {
    icon: string;
    color: string;
  }
> = {
  식비: {
    icon: "🍚",
    color: "#64c28a",
  },
  카페: {
    icon: "☕",
    color: "#d69a5c",
  },
  교통: {
    icon: "🚌",
    color: "#48a3df",
  },
  쇼핑: {
    icon: "🛍️",
    color: "#956bcd",
  },
  문화: {
    icon: "🎬",
    color: "#ffb23f",
  },
  생활: {
    icon: "🏠",
    color: "#ef8a8a",
  },
  의료: {
    icon: "💊",
    color: "#58b5ad",
  },
미용: {
  icon: "💄",
  color: "#f39ab5",
},
  기타: {
    icon: "•••",
    color: "#bdbdbd",
  },
};

const categoryNames = [
  "식비",
  "카페",
  "교통",
  "쇼핑",
  "문화",
  "생활",
  "의료",
  "미용",
  "기타",
];

function formatDate(date: Date) {
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
  const start = new Date(
    year,
    month,
    1,
  );

  const end = new Date(
    year,
    month + 1,
    1,
  );

  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

function formatKoreanDate(
  dateString: string,
) {
  const date = new Date(
    `${dateString}T00:00:00`,
  );

  const weekdays = [
    "일",
    "월",
    "화",
    "수",
    "목",
    "금",
    "토",
  ];

  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${
    weekdays[date.getDay()]
  })`;
}

/*
 * useSearchParams를 사용하는 내부 컴포넌트를
 * Suspense로 감싼다.
 */
export default function SpendingPage() {
  return (
    <Suspense
      fallback={
        <main className="spending-loading">
          소비 기록을 불러오고 있어요...
        </main>
      }
    >
      <SpendingPageContent />
    </Suspense>
  );
}

function SpendingPageContent() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const initialView: ViewType =
    searchParams.get("view") ===
    "partner"
      ? "partner"
      : "me";

  const now = new Date();

  const [view, setView] =
    useState<ViewType>(initialView);

  const [year, setYear] = useState(
    now.getFullYear(),
  );

  const [month, setMonth] = useState(
    now.getMonth(),
  );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [userId, setUserId] =
    useState<string | null>(null);

  const [partnerId, setPartnerId] =
    useState<string | null>(null);

  const [myNickname, setMyNickname] =
    useState("나");

  const [
    partnerNickname,
    setPartnerNickname,
  ] = useState("상대");

  const [expenses, setExpenses] =
    useState<ExpenseRecord[]>([]);

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState<string | null>(null);

  const [
    selectedExpense,
    setSelectedExpense,
  ] = useState<ExpenseRecord | null>(
    null,
  );

  const [editForm, setEditForm] =
    useState<EditForm>({
      amount: "",
      myShare: "",
      category: "식비",
      title: "",
      memo: "",
      expenseDate: "",
      useType: "혼자",
      paymentType: "나눠내기",
      payer: "me",
      settlementStatus:
        "정산대기",
    });

  const monthRange = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const loadData = useCallback(
    async () => {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const {
        data: profileData,
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
        !profileData
      ) {
        setMessage(
          "프로필 정보를 불러오지 못했어요.",
        );

        setLoading(false);
        return;
      }

      const profile =
        profileData as ProfileData;

      if (!profile.couple_id) {
        router.replace(
          "/couple/connect",
        );

        return;
      }

      setUserId(user.id);

      setMyNickname(
        profile.nickname ?? "나",
      );

      const {
        data: partnerData,
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
        partnerData as
          | ProfileData
          | null;

      setPartnerId(
        partner?.id ?? null,
      );

      setPartnerNickname(
        partner?.nickname ?? "상대",
      );

      const targetUserId =
        view === "me"
          ? user.id
          : partner?.id;

      if (!targetUserId) {
        setExpenses([]);
        setLoading(false);
        return;
      }

      const {
        data: expenseData,
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
          use_type,
          payment_type,
          payer_id,
          my_share,
          partner_share,
          settlement_status,
          settled_at,
          created_at
        `)
        .eq(
          "couple_id",
          profile.couple_id,
        )
        .eq(
          "user_id",
          targetUserId,
        )
        .gte(
          "expense_date",
          monthRange.start,
        )
        .lt(
          "expense_date",
          monthRange.end,
        )
        .order("expense_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (expenseError) {
        console.error(
          "소비 조회 오류:",
          expenseError,
        );

        setMessage(
          "소비 기록을 불러오지 못했어요.",
        );

        setExpenses([]);
        setLoading(false);
        return;
      }

      setExpenses(
        (expenseData as
          | ExpenseRecord[]
          | null) ?? [],
      );

      setLoading(false);
    },
    [
      monthRange.end,
      monthRange.start,
      router,
      view,
    ],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const total = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          sum +
          Number(
            expense.amount || 0,
          ),
        0,
      ),
    [expenses],
  );

  const categories =
    useMemo<CategorySummary[]>(() => {
      return categoryNames
        .map((name) => {
          const amount = expenses
            .filter(
              (expense) =>
                expense.category ===
                name,
            )
            .reduce(
              (sum, expense) =>
                sum +
                Number(
                  expense.amount || 0,
                ),
              0,
            );

          const percentage =
            total > 0
              ? Math.round(
                  (amount / total) *
                    100,
                )
              : 0;

          return {
            name,
            amount,
            percentage,
            icon:
              categoryInfo[name]
                ?.icon ?? "•••",
            color:
              categoryInfo[name]
                ?.color ?? "#bdbdbd",
          };
        })
        .filter(
          (category) =>
            category.amount > 0,
        );
    }, [expenses, total]);

  const selectedExpenses =
    useMemo(() => {
      if (!selectedCategory) {
        return [];
      }

      return expenses.filter(
        (expense) =>
          expense.category ===
          selectedCategory,
      );
    }, [
      expenses,
      selectedCategory,
    ]);

  const selectedCategorySummary =
    categories.find(
      (category) =>
        category.name ===
        selectedCategory,
    ) ?? null;

  const donutBackground =
    useMemo(() => {
      if (
        total <= 0 ||
        categories.length === 0
      ) {
        return "#eeeeee";
      }

      let current = 0;

      const parts = categories.map(
        (category) => {
          const exactPercentage =
            (category.amount /
              total) *
            100;

          const start = current;

          const end =
            current +
            exactPercentage;

          current = end;

          return `${category.color} ${start}% ${end}%`;
        },
      );

      return `conic-gradient(${parts.join(
        ", ",
      )})`;
    }, [categories, total]);

  const changeView = (
    nextView: ViewType,
  ) => {
    setView(nextView);
    setSelectedCategory(null);
    setSelectedExpense(null);

    router.replace(
      `/spending?view=${nextView}`,
    );
  };

  const changeMonth = (
    amount: number,
  ) => {
    const nextDate = new Date(
      year,
      month + amount,
      1,
    );

    setYear(nextDate.getFullYear());
    setMonth(nextDate.getMonth());
    setSelectedCategory(null);
    setSelectedExpense(null);
  };

  const openEdit = (
    expense: ExpenseRecord,
  ) => {
    if (
      expense.user_id !== userId
    ) {
      return;
    }

    setSelectedExpense(expense);

    setEditForm({
      amount: String(expense.amount),
      myShare: String(expense.my_share),
      category: expense.category,
      title: expense.title ?? "",
      memo: expense.memo ?? "",
      expenseDate:
        expense.expense_date,
      useType: expense.use_type,
      paymentType:
        expense.payment_type ===
        "사주기"
          ? "사주기"
          : "나눠내기",
      payer:
        expense.payer_id ===
        partnerId
          ? "partner"
          : "me",
      settlementStatus:
        expense.settlement_status ===
        "정산완료"
          ? "정산완료"
          : "정산대기",
    });

    setMessage("");
  };

  const closeEdit = () => {
    if (saving) {
      return;
    }

    setSelectedExpense(null);
    setMessage("");
  };

  const handleUpdate =
    async () => {
      if (
        !selectedExpense ||
        !userId
      ) {
        return;
      }

      const numericAmount = Number(
        editForm.amount || 0,
      );

      if (numericAmount <= 0) {
        setMessage(
          "금액을 입력해 주세요.",
        );
        return;
      }

      if (!editForm.expenseDate) {
        setMessage(
          "날짜를 선택해 주세요.",
        );
        return;
      }

      const isTogether =
        editForm.useType === "함께";

      const isSplit =
        isTogether &&
        editForm.paymentType ===
          "나눠내기";

      const myShare = isSplit
        ? editForm.myShare === ""
          ? Math.floor(
              numericAmount / 2,
            )
          : Number(editForm.myShare)
        : numericAmount;

      if (
        isSplit &&
        (myShare < 0 || myShare > numericAmount)
      ) {
        setMessage(
          "내 부담금은 전체 금액 안에서 입력해 주세요.",
        );
        return;
      }

      const partnerShare = isSplit
        ? numericAmount - myShare
        : 0;

      const payerId =
        !isTogether ||
        editForm.payer === "me"
          ? userId
          : partnerId;

      setSaving(true);
      setMessage("");

      const { error } =
        await supabase
          .from("expenses")
          .update({
            amount: numericAmount,
            category:
              editForm.category,
            title:
              editForm.title.trim() ||
              null,
            memo:
              editForm.memo.trim() ||
              null,
            expense_date:
              editForm.expenseDate,
            use_type:
              editForm.useType,
            payment_type: isTogether
              ? editForm.paymentType
              : null,
            payer_id: payerId,
            my_share: myShare,
            partner_share:
              partnerShare,
            settlement_status:
              isSplit
                ? selectedExpense.settlement_status
                : "해당없음",
            settled_at:
              isSplit &&
              selectedExpense.settlement_status ===
                "정산완료"
                ? selectedExpense.settled_at
                : null,
          })
          .eq(
            "id",
            selectedExpense.id,
          )
          .eq("user_id", userId);

      if (error) {
        console.error(
          "소비 수정 오류:",
          error,
        );

        setMessage(
          "소비 기록을 수정하지 못했어요.",
        );

        setSaving(false);
        return;
      }

      setSelectedExpense(null);
      setSaving(false);

      await loadData();
    };

  const handleDelete = async (
    expense: ExpenseRecord,
  ) => {
    if (
      !userId ||
      expense.user_id !== userId ||
      saving
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `${Number(
          expense.amount,
        ).toLocaleString(
          "ko-KR",
        )}원 소비 기록을 삭제할까요?`,
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } =
      await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id)
        .eq("user_id", userId);

    if (error) {
      console.error(
        "소비 삭제 오류:",
        error,
      );

      setMessage(
        "소비 기록을 삭제하지 못했어요.",
      );

      setSaving(false);
      return;
    }

    setSelectedExpense(null);
    setSaving(false);

    await loadData();
  };

  if (loading) {
    return (
      <main className="spending-loading">
        소비 기록을 불러오고 있어요...
      </main>
    );
  }

  if (
    selectedCategory &&
    selectedCategorySummary
  ) {
    return (
      <>
        <CategoryDetail
          category={
            selectedCategorySummary
          }
          expenses={
            selectedExpenses
          }
          currentUserId={userId}
          month={month}
          onBack={() =>
            setSelectedCategory(null)
          }
          onEdit={openEdit}
          onDelete={handleDelete}
          onPreviousMonth={() =>
            changeMonth(-1)
          }
          onNextMonth={() =>
            changeMonth(1)
          }
        />

        {selectedExpense && (
          <ExpenseEditSheet
            form={editForm}
            setForm={setEditForm}
            saving={saving}
            message={message}
            partnerExists={Boolean(
              partnerId,
            )}
            onClose={closeEdit}
            onSave={handleUpdate}
            onDelete={() =>
              handleDelete(
                selectedExpense,
              )
            }
          />
        )}
      </>
    );
  }

  return (
    <main className="spending-page">
      <header className="spending-header">
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          aria-label="뒤로 가기"
        >
          ←
        </button>

        <h1>소비 현황 상세</h1>

        <div className="spending-month-control">
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
            🗓️ {month + 1}월
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

      <div className="spending-person-tabs">
        <button
          type="button"
          className={
            view === "me"
              ? "active"
              : ""
          }
          onClick={() =>
            changeView("me")
          }
        >
          {myNickname} 소비
        </button>

        <button
          type="button"
          className={
            view === "partner"
              ? "active"
              : ""
          }
          onClick={() =>
            changeView("partner")
          }
        >
          {partnerNickname} 소비
        </button>
      </div>

      {message && (
        <p className="spending-message">
          {message}
        </p>
      )}

      <section className="spending-summary-card">
        <div className="spending-summary-top">
          <div>
            <span>총소비</span>

            <strong>
              {total.toLocaleString(
                "ko-KR",
              )}
              <small>원</small>
            </strong>

            <p>
              {year}년 {month + 1}월
            </p>
          </div>

          <div>
            <span>등록 건수</span>

            <strong className="small-total">
              {expenses.length}
            </strong>

            <p>건</p>
          </div>
        </div>

        {expenses.length === 0 ? (
          <div className="spending-empty">
            <span>💸</span>

            <strong>
              이번 달 소비 기록이 없어요
            </strong>

            <p>
              홈에서 소비를 기록하면
              이곳에 표시돼요.
            </p>
          </div>
        ) : (
          <>
            <div className="spending-chart-area">
              <div
                className="spending-donut"
                style={{
                  background:
                    donutBackground,
                }}
              >
                <div>
                  <strong>
                    {total.toLocaleString(
                      "ko-KR",
                    )}
                    원
                  </strong>

                  <span>총지출</span>
                </div>
              </div>

              <div className="spending-legend">
                {categories.map(
                  (category) => (
                    <button
                      type="button"
                      key={category.name}
                      onClick={() =>
                        setSelectedCategory(
                          category.name,
                        )
                      }
                    >
                      <i
                        style={{
                          background:
                            category.color,
                        }}
                      />

                      <span>
                        {category.name}
                      </span>

                      <strong>
                        {category.amount.toLocaleString(
                          "ko-KR",
                        )}
                        원
                      </strong>

                      <small>
                        {
                          category.percentage
                        }
                        %
                      </small>
                    </button>
                  ),
                )}
              </div>
            </div>

            <section className="category-budget-card">
              <h2>카테고리별 소비</h2>

              <p className="category-detail-guide">
                카테고리를 누르면 내용별 상세 내역을 볼 수 있어요.
              </p>

              {categories.map(
                (category) => (
                  <button
                    type="button"
                    className="category-budget-row"
                    key={category.name}
                    onClick={() =>
                      setSelectedCategory(
                        category.name,
                      )
                    }
                  >
                    <div className="budget-row-info">
                      <span>
                        {category.icon}{" "}
                        {category.name}
                      </span>

                      <p>
                        {category.amount.toLocaleString(
                          "ko-KR",
                        )}
                        원
                      </p>

                      <strong>
                        {
                          category.percentage
                        }
                        %
                      </strong>
                    </div>

                    <div className="budget-progress">
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, category.percentage))}%`,
                          background:
                            category.color,
                        }}
                      />
                    </div>
                  </button>
                ),
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function CategoryDetail({
  category,
  expenses,
  currentUserId,
  month,
  onBack,
  onEdit,
  onDelete,
  onPreviousMonth,
  onNextMonth,
}: {
  category: CategorySummary;
  expenses: ExpenseRecord[];
  currentUserId: string | null;
  month: number;
  onBack: () => void;
  onEdit: (
    expense: ExpenseRecord,
  ) => void;
  onDelete: (
    expense: ExpenseRecord,
  ) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}) {
  const groupedExpenses =
    expenses.reduce<
      Record<
        string,
        ExpenseRecord[]
      >
    >((result, expense) => {
      const date = formatKoreanDate(
        expense.expense_date,
      );

      if (!result[date]) {
        result[date] = [];
      }

      result[date].push(expense);

      return result;
    }, {});

  const contentSummaries = Array.from(
    expenses.reduce<
      Map<
        string,
        {
          title: string;
          amount: number;
          count: number;
        }
      >
    >((result, expense) => {
      const title =
        expense.title?.trim() ||
        "내용 없음";
      const key = title.toLocaleLowerCase(
        "ko-KR",
      );
      const current = result.get(key);

      if (current) {
        current.amount += Number(
          expense.amount || 0,
        );
        current.count += 1;
      } else {
        result.set(key, {
          title,
          amount: Number(
            expense.amount || 0,
          ),
          count: 1,
        });
      }

      return result;
    }, new Map()).values(),
  ).sort(
    (first, second) =>
      second.amount - first.amount,
  );

  return (
    <main className="category-detail-page">
      <header className="category-detail-header">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
        >
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
            {category.amount.toLocaleString(
              "ko-KR",
            )}
            <small>원</small>
          </strong>

          <p>
            총 {expenses.length}건
          </p>
        </div>

        <div className="category-rate">
          <span>전체 소비 중</span>

          <strong>
            {category.percentage}%
          </strong>
        </div>
      </section>

      <section className="content-summary-section">
        <header>
          <h2>내용별 소비</h2>
          <span>{contentSummaries.length}개 내용</span>
        </header>

        <div className="content-summary-list">
          {contentSummaries.map((summary) => (
            <div
              className="content-summary-item"
              key={summary.title.toLocaleLowerCase("ko-KR")}
            >
              <div>
                <strong>{summary.title}</strong>
                <span>{summary.count}건</span>
              </div>

              <strong>
                {summary.amount.toLocaleString("ko-KR")}원
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="category-history">
        {Object.entries(
          groupedExpenses,
        ).map(
          ([date, dailyExpenses]) => {
            const dailyTotal =
              dailyExpenses.reduce(
                (sum, expense) =>
                  sum +
                  Number(
                    expense.amount,
                  ),
                0,
              );

            return (
              <article
                className="date-group"
                key={date}
              >
                <header>
                  <span>{date}</span>

                  <strong>
                    {dailyTotal.toLocaleString(
                      "ko-KR",
                    )}
                    원
                  </strong>
                </header>

                {dailyExpenses.map(
                  (expense) => {
                    const isMine =
                      expense.user_id ===
                      currentUserId;

                    return (
                      <div
                        className="history-item-wrap"
                        key={expense.id}
                      >
                        <button
                          type="button"
                          className="history-item"
                          onClick={() => {
                            if (isMine) {
                              onEdit(
                                expense,
                              );
                            }
                          }}
                        >
                          <div className="history-icon">
                            {categoryInfo[
                              expense.category
                            ]?.icon ?? "•••"}
                          </div>

                          <div className="history-content">
                            <strong>
                              {expense.title ||
                                expense.category}
                            </strong>

                            <span>
                              {expense.use_type ===
                              "함께"
                                ? `둘이 함께 · ${
                                    expense.payment_type ??
                                    ""
                                  }`
                                : "나 혼자"}
                            </span>

                            {expense.memo && (
                              <small>
                                {
                                  expense.memo
                                }
                              </small>
                            )}
                          </div>

                          <div className="history-price">
                            <strong>
                              {Number(
                                expense.amount,
                              ).toLocaleString(
                                "ko-KR",
                              )}
                              원
                            </strong>

                            {expense.settlement_status ===
                              "정산대기" && (
                              <span className="pending">
                                정산전
                              </span>
                            )}

                            {expense.settlement_status ===
                              "정산완료" && (
                              <span className="complete">
                                정산 완료
                              </span>
                            )}
                          </div>
                        </button>

                        {isMine && (
                          <div className="history-actions">
                            <button
                              type="button"
                              onClick={() =>
                                onEdit(
                                  expense,
                                )
                              }
                            >
                              수정
                            </button>

                           <button
  type="button"
  className="delete"
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    onDelete(expense);
  }}
>
  삭제
</button>
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </article>
            );
          },
        )}
      </section>

      <footer className="category-detail-footer">
        <div>
          <span>
            총 {expenses.length}건
          </span>

          <strong>
            {category.amount.toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <nav>
          <button
            type="button"
            onClick={onPreviousMonth}
          >
            ‹ 이전 달
          </button>

          <strong>
            🗓️ {month + 1}월
          </strong>

          <button
            type="button"
            onClick={onNextMonth}
          >
            다음 달 ›
          </button>
        </nav>
      </footer>
    </main>
  );
}

function ExpenseEditSheet({
  form,
  setForm,
  saving,
  message,
  partnerExists,
  onClose,
  onSave,
  onDelete,
}: {
  form: EditForm;
  setForm: Dispatch<
    SetStateAction<EditForm>
  >;
  saving: boolean;
  message: string;
  partnerExists: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const numericAmount = Number(
    form.amount || 0,
  );

  const numericMyShare =
    form.myShare === ""
      ? Math.floor(numericAmount / 2)
      : Number(form.myShare);

  const partnerShare =
    numericAmount - numericMyShare;

  const invalidShare =
    numericMyShare < 0 ||
    numericMyShare > numericAmount;

  return (
    <div
      className="expense-edit-backdrop"
      onClick={onClose}
    >
      <section
        className="expense-edit-sheet"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <header className="expense-edit-header">
          <h2>소비 기록 수정</h2>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="expense-edit-scroll">
          <label>
            <span>금액</span>

            <div className="expense-edit-amount">
              <span>₩</span>

              <input
                type="text"
                inputMode="numeric"
                value={
                  form.amount
                    ? numericAmount.toLocaleString(
                        "ko-KR",
                      )
                    : ""
                }
                disabled={saving}
                onChange={(event) => {
                  const value =
                    event.target.value.replace(
                      /[^0-9]/g,
                      "",
                    );

                  setForm(
                    (current) => ({
                      ...current,
                      amount: value,
                    }),
                  );
                }}
              />
            </div>
          </label>

          <div>
            <span className="expense-edit-label">
              카테고리
            </span>

            <div className="expense-edit-categories">
              {categoryNames.map(
                (category) => (
                  <button
                    type="button"
                    key={category}
                    disabled={saving}
                    className={
                      form.category ===
                      category
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,
                          category,
                        }),
                      )
                    }
                  >
                    <span>
                      {
                        categoryInfo[
                          category
                        ].icon
                      }
                    </span>

                    <small>
                      {category}
                    </small>
                  </button>
                ),
              )}
            </div>
          </div>

          <label>
            <span>내용</span>

            <input
              type="text"
              value={form.title}
              disabled={saving}
              placeholder="사용 내용을 입력하세요"
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    title:
                      event.target.value,
                  }),
                )
              }
            />
          </label>

          <label>
            <span>날짜</span>

            <input
              type="date"
              value={form.expenseDate}
              disabled={saving}
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    expenseDate:
                      event.target.value,
                  }),
                )
              }
            />
          </label>

          <div>
            <span className="expense-edit-label">
              누구와 썼어?
            </span>

            <div className="expense-edit-choice">
              <button
                type="button"
                disabled={saving}
                className={
                  form.useType === "혼자"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setForm(
                    (current) => ({
                      ...current,
                      useType: "혼자",
                    }),
                  )
                }
              >
                👤 나 혼자
              </button>

              <button
                type="button"
                disabled={saving}
                className={
                  form.useType === "함께"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setForm(
                    (current) => ({
                      ...current,
                      useType: "함께",
                    }),
                  )
                }
              >
                👥 둘이 함께
              </button>
            </div>
          </div>

          {form.useType === "함께" && (
            <>
              <div>
                <span className="expense-edit-label">
                  계산 방법
                </span>

                <div className="expense-edit-choice">
                  <button
                    type="button"
                    disabled={saving}
                    className={
                      form.paymentType ===
                      "나눠내기"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,
                          paymentType:
                            "나눠내기",
                        }),
                      )
                    }
                  >
                    나눠내기
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    className={
                      form.paymentType ===
                      "사주기"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,
                          paymentType:
                            "사주기",
                        }),
                      )
                    }
                  >
                    사주기
                  </button>
                </div>
              </div>

              <div>
                <span className="expense-edit-label">
                  결제한 사람
                </span>

                <div className="expense-edit-choice">
                  <button
                    type="button"
                    disabled={saving}
                    className={
                      form.payer === "me"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,
                          payer: "me",
                        }),
                      )
                    }
                  >
                    내가 결제
                  </button>

                  <button
                    type="button"
                    disabled={
                      saving ||
                      !partnerExists
                    }
                    className={
                      form.payer ===
                      "partner"
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setForm(
                        (current) => ({
                          ...current,
                          payer:
                            "partner",
                        }),
                      )
                    }
                  >
                    상대가 결제
                  </button>
                </div>
              </div>

              {form.paymentType ===
                "나눠내기" && (
                <>
                  <label>
                    <span>내 소비 부담금</span>

                    <div className="expense-edit-amount expense-edit-share">
                      <span>₩</span>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={
                          numericAmount > 0
                            ? numericMyShare.toLocaleString("ko-KR")
                            : ""
                        }
                        disabled={saving}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            myShare: event.target.value.replace(/[^0-9]/g, ""),
                          }))
                        }
                      />
                    </div>

                    <small className="expense-edit-share-guide">
                      상대 부담금 {Math.max(partnerShare, 0).toLocaleString("ko-KR")}원
                    </small>
                  </label>

                  <div>
                    <span className="expense-edit-label">
                      정산 상태
                    </span>

                    <p className="expense-edit-share-guide">
                      {form.settlementStatus === "정산완료"
                        ? "정산 완료"
                        : "정산 화면에서 결제자가 완료할 수 있어요."}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          <label>
            <span>
              메모 <small>선택</small>
            </span>

            <div className="expense-edit-memo">
              <textarea
                maxLength={50}
                value={form.memo}
                disabled={saving}
                placeholder="메모를 입력해주세요"
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,
                      memo:
                        event.target.value,
                    }),
                  )
                }
              />

              <small>
                {form.memo.length}/50
              </small>
            </div>
          </label>

          {message && (
            <p className="spending-message">
              {message}
            </p>
          )}
        </div>

        <div className="expense-edit-buttons">
          <button
            type="button"
            className="delete"
            disabled={saving}
            onClick={onDelete}
          >
            삭제
          </button>

          <button
            type="button"
            className="save"
            disabled={
              saving ||
              numericAmount <= 0 ||
              (form.useType === "함께" &&
                form.paymentType === "나눠내기" &&
                invalidShare)
            }
            onClick={onSave}
          >
            {saving
              ? "저장하는 중..."
              : "수정 완료"}
          </button>
        </div>
      </section>
    </div>
  );
}
