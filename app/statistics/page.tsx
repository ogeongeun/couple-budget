"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import BottomNavigation from "@/components/BottomNavigation";
import { createClient } from "@/lib/supabase/client";

import "./statistics.css";

const supabase = createClient();

type ViewType = "me" | "partner";

type ProfileData = {
  id: string;
  nickname: string | null;
  couple_id: string | null;
};

type ExpenseRecord = {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  title: string | null;
  expense_date: string;
  use_type: "혼자" | "함께";
  payment_type:
    | "나눠내기"
    | "사주기"
    | null;
  payer_id: string | null;
  created_at: string;
};

type IncomeRecord = {
  user_id: string;
  amount: number;
  income_date: string;
};

type CategoryData = {
  name: string;
  amount: number;
  percentage: number;
  icon: string;
  color: string;
};

type MonthlyData = {
  year: number;
  month: number;
  label: string;
  amount: number;
  budget: number;
};

type WeekdayData = {
  day: string;
  amount: number;
};

type TimeData = {
  label: string;
  time: string;
  amount: number;
  percentage: number;
  className:
    | "morning"
    | "lunch"
    | "evening"
    | "night";
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
    color: "#50b977",
  },
  카페: {
    icon: "☕",
    color: "#d59a5c",
  },
  교통: {
    icon: "🚌",
    color: "#70a7ee",
  },
  쇼핑: {
    icon: "🛍️",
    color: "#a77be0",
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
  return {
    start: formatDate(
      new Date(year, month, 1),
    ),

    end: formatDate(
      new Date(year, month + 1, 1),
    ),
  };
}

function sumAmount<
  T extends {
    amount: number;
  },
>(items: T[]) {
  return items.reduce(
    (sum, item) =>
      sum + Number(item.amount || 0),
    0,
  );
}

function getPercentage(
  amount: number,
  total: number,
) {
  if (total <= 0) {
    return 0;
  }

  return Math.round(
    (amount / total) * 100,
  );
}

function getDifferenceText(
  difference: number,
) {
  if (difference === 0) {
    return "0원";
  }

  const prefix =
    difference > 0 ? "+" : "-";

  return `${prefix}${Math.abs(
    difference,
  ).toLocaleString("ko-KR")}원`;
}

export default function StatisticsPage() {
  const router = useRouter();
  const now = new Date();

  const [view, setView] =
    useState<ViewType>("me");

  const [year, setYear] = useState(
    now.getFullYear(),
  );

  const [month, setMonth] = useState(
    now.getMonth(),
  );

  const [loading, setLoading] =
    useState(true);

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

  const [
    currentExpenses,
    setCurrentExpenses,
  ] = useState<ExpenseRecord[]>([]);

  const [
    previousExpenses,
    setPreviousExpenses,
  ] = useState<ExpenseRecord[]>([]);

  const [
    sixMonthExpenses,
    setSixMonthExpenses,
  ] = useState<ExpenseRecord[]>([]);

  const [
    sixMonthIncomes,
    setSixMonthIncomes,
  ] = useState<IncomeRecord[]>([]);

  const currentRange = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const previousDate = useMemo(
    () => new Date(year, month - 1, 1),
    [year, month],
  );

  const previousRange = useMemo(
    () =>
      getMonthRange(
        previousDate.getFullYear(),
        previousDate.getMonth(),
      ),
    [previousDate],
  );

  const sixMonthStart = useMemo(
    () =>
      formatDate(
        new Date(year, month - 5, 1),
      ),
    [year, month],
  );

  const loadStatistics =
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
          "상대 조회 오류:",
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

      const expenseColumns = `
        id,
        user_id,
        amount,
        category,
        title,
        expense_date,
        use_type,
        payment_type,
        payer_id,
        created_at
      `;

      const [
        currentResult,
        previousResult,
        sixMonthExpenseResult,
        sixMonthIncomeResult,
      ] = await Promise.all([
        supabase
          .from("expenses")
          .select(expenseColumns)
          .eq(
            "couple_id",
            profile.couple_id,
          )
          .gte(
            "expense_date",
            currentRange.start,
          )
          .lt(
            "expense_date",
            currentRange.end,
          ),

        supabase
          .from("expenses")
          .select(expenseColumns)
          .eq(
            "couple_id",
            profile.couple_id,
          )
          .gte(
            "expense_date",
            previousRange.start,
          )
          .lt(
            "expense_date",
            previousRange.end,
          ),

        supabase
          .from("expenses")
          .select(expenseColumns)
          .eq(
            "couple_id",
            profile.couple_id,
          )
          .gte(
            "expense_date",
            sixMonthStart,
          )
          .lt(
            "expense_date",
            currentRange.end,
          ),

        supabase
          .from("incomes")
          .select(
            "user_id, amount, income_date",
          )
          .eq(
            "couple_id",
            profile.couple_id,
          )
          .gte(
            "income_date",
            sixMonthStart,
          )
          .lt(
            "income_date",
            currentRange.end,
          ),
      ]);

      if (currentResult.error) {
        console.error(
          "이번 달 소비 조회 오류:",
          currentResult.error,
        );
      }

      if (previousResult.error) {
        console.error(
          "지난달 소비 조회 오류:",
          previousResult.error,
        );
      }

      if (
        sixMonthExpenseResult.error
      ) {
        console.error(
          "6개월 소비 조회 오류:",
          sixMonthExpenseResult.error,
        );
      }

      if (
        sixMonthIncomeResult.error
      ) {
        console.error(
          "6개월 소득 조회 오류:",
          sixMonthIncomeResult.error,
        );
      }

      setCurrentExpenses(
        (currentResult.data as
          | ExpenseRecord[]
          | null) ?? [],
      );

      setPreviousExpenses(
        (previousResult.data as
          | ExpenseRecord[]
          | null) ?? [],
      );

      setSixMonthExpenses(
        (sixMonthExpenseResult.data as
          | ExpenseRecord[]
          | null) ?? [],
      );

      setSixMonthIncomes(
        (sixMonthIncomeResult.data as
          | IncomeRecord[]
          | null) ?? [],
      );

      setLoading(false);
    }, [
      currentRange.end,
      currentRange.start,
      previousRange.end,
      previousRange.start,
      router,
      sixMonthStart,
    ]);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  const selectedUserId =
    view === "me"
      ? userId
      : partnerId;

  const selectedNickname =
    view === "me"
      ? myNickname
      : partnerNickname;

  const selectedCurrentExpenses =
    useMemo(() => {
      if (!selectedUserId) {
        return [];
      }

      return currentExpenses.filter(
        (expense) =>
          expense.user_id ===
          selectedUserId,
      );
    }, [
      currentExpenses,
      selectedUserId,
    ]);

  const selectedPreviousExpenses =
    useMemo(() => {
      if (!selectedUserId) {
        return [];
      }

      return previousExpenses.filter(
        (expense) =>
          expense.user_id ===
          selectedUserId,
      );
    }, [
      previousExpenses,
      selectedUserId,
    ]);

  const selectedSixMonthExpenses =
    useMemo(() => {
      if (!selectedUserId) {
        return [];
      }

      return sixMonthExpenses.filter(
        (expense) =>
          expense.user_id ===
          selectedUserId,
      );
    }, [
      selectedUserId,
      sixMonthExpenses,
    ]);

  const totalExpense = useMemo(
    () =>
      sumAmount(
        selectedCurrentExpenses,
      ),
    [selectedCurrentExpenses],
  );

  const previousTotal = useMemo(
    () =>
      sumAmount(
        selectedPreviousExpenses,
      ),
    [selectedPreviousExpenses],
  );

  const difference =
    totalExpense - previousTotal;

  const changeRate =
    previousTotal > 0
      ? Math.round(
          (difference /
            previousTotal) *
            100,
        )
      : totalExpense > 0
        ? 100
        : 0;

  const selectedCurrentIncomes =
    useMemo(() => {
      if (!selectedUserId) {
        return [];
      }

      return sixMonthIncomes.filter(
        (income) => {
          const date = new Date(
            `${income.income_date}T00:00:00`,
          );

          return (
            income.user_id ===
              selectedUserId &&
            date.getFullYear() === year &&
            date.getMonth() === month
          );
        },
      );
    }, [
      month,
      selectedUserId,
      sixMonthIncomes,
      year,
    ]);

  const currentBudget = useMemo(
    () =>
      sumAmount(
        selectedCurrentIncomes,
      ),
    [selectedCurrentIncomes],
  );

  const budgetUsageRate =
    currentBudget > 0
      ? Math.round(
          (totalExpense /
            currentBudget) *
            100,
        )
      : 0;

  const recordedDays = useMemo(
    () =>
      new Set(
        selectedCurrentExpenses.map(
          (expense) =>
            expense.expense_date,
        ),
      ).size,
    [selectedCurrentExpenses],
  );

  const dailyAverage =
    recordedDays > 0
      ? Math.round(
          totalExpense /
            recordedDays,
        )
      : 0;

  const categoryData =
    useMemo<CategoryData[]>(() => {
      return categoryNames
        .map((name) => {
          const amount = sumAmount(
            selectedCurrentExpenses.filter(
              (expense) =>
                expense.category ===
                name,
            ),
          );

          return {
            name,
            amount,
            percentage:
              getPercentage(
                amount,
                totalExpense,
              ),
            icon:
              categoryInfo[name]
                ?.icon ?? "•••",
            color:
              categoryInfo[name]
                ?.color ??
              "#bdbdbd",
          };
        })
        .filter(
          (category) =>
            category.amount > 0,
        )
        .sort(
          (first, second) =>
            second.amount -
            first.amount,
        );
    }, [
      selectedCurrentExpenses,
      totalExpense,
    ]);

  const topCategory =
    categoryData[0] ?? null;

  const secondCategory =
    categoryData[1] ?? null;

  const topTwoPercentage =
    (topCategory?.percentage ?? 0) +
    (secondCategory?.percentage ?? 0);

  const categoryDonut =
    useMemo(() => {
      if (
        totalExpense <= 0 ||
        categoryData.length === 0
      ) {
        return "#eeeeee";
      }

      let current = 0;

      const parts = categoryData.map(
        (category) => {
          const exact =
            (category.amount /
              totalExpense) *
            100;

          const start = current;
          const end = current + exact;

          current = end;

          return `${category.color} ${start}% ${end}%`;
        },
      );

      return `conic-gradient(${parts.join(
        ", ",
      )})`;
    }, [
      categoryData,
      totalExpense,
    ]);

  const weekdaySpending =
    useMemo<WeekdayData[]>(() => {
      const totals = Array(7).fill(
        0,
      ) as number[];

      selectedCurrentExpenses.forEach(
        (expense) => {
          const date = new Date(
            `${expense.expense_date}T00:00:00`,
          );

          totals[date.getDay()] +=
            Number(
              expense.amount || 0,
            );
        },
      );

      return [
        {
          day: "월",
          amount: totals[1],
        },
        {
          day: "화",
          amount: totals[2],
        },
        {
          day: "수",
          amount: totals[3],
        },
        {
          day: "목",
          amount: totals[4],
        },
        {
          day: "금",
          amount: totals[5],
        },
        {
          day: "토",
          amount: totals[6],
        },
        {
          day: "일",
          amount: totals[0],
        },
      ];
    }, [selectedCurrentExpenses]);

  const weeklyMaximum = Math.max(
    ...weekdaySpending.map(
      (item) => item.amount,
    ),
    1,
  );

  const highestWeekday =
    weekdaySpending.reduce(
      (highest, current) =>
        current.amount >
        highest.amount
          ? current
          : highest,
      weekdaySpending[0] ?? {
        day: "-",
        amount: 0,
      },
    );

  const timeSpending =
    useMemo<TimeData[]>(() => {
      const values = {
        morning: 0,
        lunch: 0,
        evening: 0,
        night: 0,
      };

      selectedCurrentExpenses.forEach(
        (expense) => {
          const createdDate =
            new Date(
              expense.created_at,
            );

          const hour =
            createdDate.getHours();

          const amount = Number(
            expense.amount || 0,
          );

          if (
            hour >= 6 &&
            hour < 11
          ) {
            values.morning += amount;
          } else if (
            hour >= 11 &&
            hour < 14
          ) {
            values.lunch += amount;
          } else if (
            hour >= 14 &&
            hour < 21
          ) {
            values.evening += amount;
          } else {
            values.night += amount;
          }
        },
      );

      return [
        {
          label: "아침",
          time: "06~11시",
          amount: values.morning,
          percentage:
            getPercentage(
              values.morning,
              totalExpense,
            ),
          className: "morning",
        },
        {
          label: "점심",
          time: "11~14시",
          amount: values.lunch,
          percentage:
            getPercentage(
              values.lunch,
              totalExpense,
            ),
          className: "lunch",
        },
        {
          label: "저녁",
          time: "14~21시",
          amount: values.evening,
          percentage:
            getPercentage(
              values.evening,
              totalExpense,
            ),
          className: "evening",
        },
        {
          label: "야간",
          time: "21~06시",
          amount: values.night,
          percentage:
            getPercentage(
              values.night,
              totalExpense,
            ),
          className: "night",
        },
      ];
    }, [
      selectedCurrentExpenses,
      totalExpense,
    ]);

  const timeDonut = useMemo(() => {
    if (totalExpense <= 0) {
      return "#eeeeee";
    }

    const colors = [
      "#50b977",
      "#ffbd38",
      "#ff7846",
      "#9367ce",
    ];

    let current = 0;

    const parts = timeSpending.map(
      (item, index) => {
        const exact =
          (item.amount /
            totalExpense) *
          100;

        const start = current;
        const end = current + exact;

        current = end;

        return `${colors[index]} ${start}% ${end}%`;
      },
    );

    return `conic-gradient(${parts.join(
      ", ",
    )})`;
  }, [
    timeSpending,
    totalExpense,
  ]);

  const monthlySpending =
    useMemo<MonthlyData[]>(() => {
      return Array.from(
        {
          length: 6,
        },
        (_, index) => {
          const date = new Date(
            year,
            month - 5 + index,
            1,
          );

          const targetYear =
            date.getFullYear();

          const targetMonth =
            date.getMonth();

          const expenses =
            selectedSixMonthExpenses.filter(
              (expense) => {
                const expenseDate =
                  new Date(
                    `${expense.expense_date}T00:00:00`,
                  );

                return (
                  expenseDate.getFullYear() ===
                    targetYear &&
                  expenseDate.getMonth() ===
                    targetMonth
                );
              },
            );

          const incomes =
            sixMonthIncomes.filter(
              (income) => {
                const incomeDate =
                  new Date(
                    `${income.income_date}T00:00:00`,
                  );

                return (
                  income.user_id ===
                    selectedUserId &&
                  incomeDate.getFullYear() ===
                    targetYear &&
                  incomeDate.getMonth() ===
                    targetMonth
                );
              },
            );

          return {
            year: targetYear,
            month: targetMonth,
            label: `${
              targetMonth + 1
            }월`,
            amount:
              sumAmount(expenses),
            budget:
              sumAmount(incomes),
          };
        },
      );
    }, [
      month,
      selectedSixMonthExpenses,
      selectedUserId,
      sixMonthIncomes,
      year,
    ]);

  const monthlyMaximum = Math.max(
    ...monthlySpending.flatMap(
      (item) => [
        item.amount,
        item.budget,
      ],
    ),
    1,
  );

  const monthlyPoints =
    useMemo(() => {
      const width = 500;
      const height = 180;

      return monthlySpending.map(
        (item, index) => {
          const x =
            monthlySpending.length <= 1
              ? width / 2
              : (index /
                  (monthlySpending.length -
                    1)) *
                width;

          const y =
            height -
            (item.amount /
              monthlyMaximum) *
              150 -
            10;

          return {
            x,
            y,
          };
        },
      );
    }, [
      monthlyMaximum,
      monthlySpending,
    ]);

  const monthlyPointString =
    monthlyPoints
      .map(
        (point) =>
          `${point.x},${point.y}`,
      )
      .join(" ");

  const aloneAmount = useMemo(
    () =>
      sumAmount(
        selectedCurrentExpenses.filter(
          (expense) =>
            expense.use_type ===
            "혼자",
        ),
      ),
    [selectedCurrentExpenses],
  );

  const togetherAmount = useMemo(
    () =>
      sumAmount(
        selectedCurrentExpenses.filter(
          (expense) =>
            expense.use_type ===
            "함께",
        ),
      ),
    [selectedCurrentExpenses],
  );

  const myExpense = useMemo(() => {
    if (!userId) {
      return 0;
    }

    return sumAmount(
      currentExpenses.filter(
        (expense) =>
          expense.user_id === userId,
      ),
    );
  }, [
    currentExpenses,
    userId,
  ]);

  const partnerExpense =
    useMemo(() => {
      if (!partnerId) {
        return 0;
      }

      return sumAmount(
        currentExpenses.filter(
          (expense) =>
            expense.user_id ===
            partnerId,
        ),
      );
    }, [
      currentExpenses,
      partnerId,
    ]);

  const treatExpenses =
    useMemo(() => {
      return currentExpenses.filter(
        (expense) =>
          expense.use_type ===
            "함께" &&
          expense.payment_type ===
            "사주기",
      );
    }, [currentExpenses]);

  const myTreatAmount = useMemo(() => {
    if (!userId) {
      return 0;
    }

    return sumAmount(
      treatExpenses.filter(
        (expense) =>
          expense.payer_id === userId,
      ),
    );
  }, [
    treatExpenses,
    userId,
  ]);

  const partnerTreatAmount =
    useMemo(() => {
      if (!partnerId) {
        return 0;
      }

      return sumAmount(
        treatExpenses.filter(
          (expense) =>
            expense.payer_id ===
            partnerId,
        ),
      );
    }, [
      partnerId,
      treatExpenses,
    ]);

  const treatTotal =
    myTreatAmount +
    partnerTreatAmount;

  const treatMaximum = Math.max(
    myTreatAmount,
    partnerTreatAmount,
    1,
  );

  const treatDifference =
    myTreatAmount -
    partnerTreatAmount;

  const treatMessage =
    treatDifference > 0
      ? `${myNickname}님이 ${Math.abs(
          treatDifference,
        ).toLocaleString(
          "ko-KR",
        )}원 더 많이 사줬어요.`
      : treatDifference < 0
        ? `${partnerNickname}님이 ${Math.abs(
            treatDifference,
          ).toLocaleString(
            "ko-KR",
          )}원 더 많이 사줬어요.`
        : treatTotal > 0
          ? "이번 달에는 서로 같은 금액을 사줬어요."
          : "이번 달 사주기 기록이 아직 없어요.";

  const biggestTreat =
    useMemo(() => {
      return treatExpenses.reduce<
        ExpenseRecord | null
      >((highest, expense) => {
        if (!highest) {
          return expense;
        }

        return Number(expense.amount) >
          Number(highest.amount)
          ? expense
          : highest;
      }, null);
    }, [treatExpenses]);

  const eveningAfterPercentage =
    (timeSpending.find(
      (item) =>
        item.className ===
        "evening",
    )?.percentage ?? 0) +
    (timeSpending.find(
      (item) =>
        item.className ===
        "night",
    )?.percentage ?? 0);

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
  };

  if (loading) {
    return (
      <main className="analysis-loading">
        통계를 불러오고 있어요...
      </main>
    );
  }

  return (
    <main className="analysis-page">
      <header className="analysis-header">
        <button
          type="button"
          className="analysis-back-button"
          onClick={() =>
            router.back()
          }
          aria-label="뒤로가기"
        >
          ←
        </button>

        <h1>통계</h1>

        <div className="analysis-month-control">
          <button
            type="button"
            onClick={() =>
              changeMonth(-1)
            }
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
          >
            ›
          </button>
        </div>
      </header>

      <div className="statistics-person-tabs">
        <button
          type="button"
          className={
            view === "me"
              ? "active"
              : ""
          }
          onClick={() =>
            setView("me")
          }
        >
          {myNickname}
        </button>

        <button
          type="button"
          className={
            view === "partner"
              ? "active"
              : ""
          }
          disabled={!partnerId}
          onClick={() =>
            setView("partner")
          }
        >
          {partnerNickname}
        </button>
      </div>

      {message && (
        <p className="analysis-message">
          {message}
        </p>
      )}

      <section className="analysis-dog-card">
        <div className="analysis-speech">
          <strong>
            {selectedNickname}님은
            지난달보다
            <br />
            {Math.abs(
              difference,
            ).toLocaleString("ko-KR")}
            원{" "}
            {difference > 0
              ? "더 썼어요."
              : difference < 0
                ? "덜 썼어요."
                : "똑같이 썼어요."}
          </strong>

          <p>
            {topCategory ? (
              <>
                {topCategory.name} 지출이
                <br />
                가장 많았어요!
              </>
            ) : (
              <>
                아직 소비 기록이
                <br />
                없어요!
              </>
            )}
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

      <section className="analysis-summary-card">
        <h2>
          {selectedNickname}님의 이번 달
        </h2>

        <div className="analysis-summary-grid">
          <SummaryItem
            label="총소비"
            value={`${totalExpense.toLocaleString(
              "ko-KR",
            )}원`}
            icon="👛"
            iconClass="green"
          />

          <SummaryItem
            label="지난달 대비"
            value={`${
              changeRate > 0
                ? "+"
                : ""
            }${changeRate}%`}
            subValue={getDifferenceText(
              difference,
            )}
            icon={
              difference > 0
                ? "↗"
                : difference < 0
                  ? "↘"
                  : "→"
            }
            iconClass={
              difference > 0
                ? "coral"
                : "green"
            }
            valueClass={
              difference > 0
                ? "coral"
                : "green-text"
            }
          />

          <SummaryItem
            label="예산 사용률"
            value={`${budgetUsageRate}%`}
            icon="◔"
            iconClass="mint"
          />

          <SummaryItem
            label="하루 평균"
            value={`${dailyAverage.toLocaleString(
              "ko-KR",
            )}원`}
            icon="🗓️"
            iconClass="blue"
          />
        </div>
      </section>

      <section className="analysis-card">
        <div className="analysis-section-heading">
          <h2>
            소비 변화 추이
            <small>
              {selectedNickname} · 최근 6개월
            </small>
          </h2>
        </div>

        <div className="monthly-line-chart">
          <div className="chart-y-labels">
            <span>
              {Math.round(
                monthlyMaximum /
                  10000,
              )}
              만
            </span>

            <span>
              {Math.round(
                (monthlyMaximum *
                  0.75) /
                  10000,
              )}
              만
            </span>

            <span>
              {Math.round(
                (monthlyMaximum *
                  0.5) /
                  10000,
              )}
              만
            </span>

            <span>
              {Math.round(
                (monthlyMaximum *
                  0.25) /
                  10000,
              )}
              만
            </span>

            <span>0</span>
          </div>

          <div className="line-chart-area">
            <div className="line-grid line-grid-one" />
            <div className="line-grid line-grid-two" />
            <div className="line-grid line-grid-three" />
            <div className="line-grid line-grid-four" />

            <svg
              className="monthly-svg"
              viewBox="0 0 500 210"
              preserveAspectRatio="none"
            >
              <polyline
                points={
                  monthlyPointString
                }
                fill="none"
                stroke="#33ad6d"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {monthlyPoints.map(
                (point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r="7"
                    fill="#ffffff"
                    stroke="#33ad6d"
                    strokeWidth="4"
                  />
                ),
              )}
            </svg>

            <div className="monthly-values">
              {monthlySpending.map(
                (item) => (
                  <span
                    key={`${item.year}-${item.month}`}
                  >
                    {Math.round(
                      item.amount /
                        10000,
                    )}
                    만
                  </span>
                ),
              )}
            </div>

            <div className="monthly-labels">
              {monthlySpending.map(
                (item) => (
                  <span
                    key={`${item.year}-${item.month}`}
                  >
                    {item.label}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="analysis-card">
        <h2>
          {selectedNickname}님의 카테고리별 소비
        </h2>

        {categoryData.length === 0 ? (
          <div className="analysis-empty">
            소비 기록이 없어요.
          </div>
        ) : (
          <div className="category-analysis-layout">
            <div
              className="category-analysis-donut"
              style={{
                background:
                  categoryDonut,
              }}
            >
              <div>
                <strong>
                  {totalExpense.toLocaleString(
                    "ko-KR",
                  )}
                </strong>
                <span>원</span>
              </div>
            </div>

            <div className="category-analysis-list">
              {categoryData.map(
                (category) => (
                  <div
                    key={
                      category.name
                    }
                  >
                    <i
                      style={{
                        background:
                          category.color,
                      }}
                    />

                    <span>
                      {category.icon}{" "}
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
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </section>

      <section className="analysis-card concentration-card">
        <h2>소비 집중도 분석</h2>

        <div className="concentration-content">
          <div
            className="concentration-chart"
            style={{
              background: `conic-gradient(
                #35ae6d 0% ${topTwoPercentage}%,
                #e3e5e3 ${topTwoPercentage}% 100%
              )`,
            }}
          >
            <div>
              <strong>
                {topTwoPercentage}%
              </strong>
            </div>
          </div>

          <div className="concentration-copy">
            {topCategory ? (
              <p>
                <b>
                  {topCategory.name}
                  {secondCategory
                    ? `, ${secondCategory.name}`
                    : ""}
                </b>{" "}
                지출이 전체의
                <strong>
                  {" "}
                  {topTwoPercentage}%
                </strong>
                를 차지해요.
              </p>
            ) : (
              <p>
                분석할 기록이 없어요.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="analysis-card">
        <h2>
          {selectedNickname}님의 소비 방식
        </h2>

        <div className="use-type-statistics">
          <div>
            <span>👤 나 혼자</span>

            <strong>
              {aloneAmount.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>

            <small>
              {getPercentage(
                aloneAmount,
                totalExpense,
              )}
              %
            </small>
          </div>

          <div>
            <span>👥 둘이 함께</span>

            <strong>
              {togetherAmount.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>

            <small>
              {getPercentage(
                togetherAmount,
                totalExpense,
              )}
              %
            </small>
          </div>
        </div>
      </section>

      <section className="analysis-card">
        <div className="analysis-section-heading">
          <h2>요일별 분석</h2>
          <small>{selectedNickname}</small>
        </div>

        <div className="weekday-chart">
          {weekdaySpending.map(
            (item) => {
              const height =
                item.amount > 0
                  ? Math.max(
                      15,
                      Math.round(
                        (item.amount /
                          weeklyMaximum) *
                          155,
                      ),
                    )
                  : 0;

              return (
                <div
                  className="weekday-column"
                  key={item.day}
                >
                  <strong>
                    {item.amount.toLocaleString(
                      "ko-KR",
                    )}
                  </strong>

                  <div
                    className={[
                      "weekday-bar",
                      item.day ===
                      highestWeekday.day
                        ? "highest"
                        : "",
                    ].join(" ")}
                    style={{
                      height,
                    }}
                  />

                  <span>
                    {item.day}
                  </span>
                </div>
              );
            },
          )}
        </div>

        <div className="analysis-tip">
          <span>💡</span>

          <p>
            {highestWeekday.amount > 0
              ? `${highestWeekday.day}요일에 가장 많이 사용했어요.`
              : "분석할 기록이 없어요."}
          </p>
        </div>
      </section>

      <section className="analysis-card">
        <h2>
          {selectedNickname}님의 시간대별 소비
        </h2>

        <div className="time-chart-content">
          <div
            className="time-donut"
            style={{
              background:
                timeDonut,
            }}
          >
            <div>◷</div>
          </div>

          <div className="time-legend">
            {timeSpending.map(
              (item) => (
                <div
                  key={item.label}
                >
                  <i
                    className={
                      item.className
                    }
                  />

                  <span>
                    {item.label}
                    <small>
                      ({item.time})
                    </small>
                  </span>

                  <strong>
                    {
                      item.percentage
                    }
                    %
                  </strong>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="analysis-purple-tip">
          <span>🌙</span>

          <p>
            저녁 이후 지출이
            전체의
            <strong>
              {" "}
              {
                eveningAfterPercentage
              }
              %
            </strong>
            를 차지해요.
          </p>
        </div>
      </section>

      <section className="analysis-card">
        <h2>우리 소비 비교</h2>

        <div className="couple-comparison-grid">
          <div>
            <span>{myNickname}</span>

            <strong>
              {myExpense.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>

            <div className="couple-progress">
              <span
                style={{
                  width: `${
                    Math.max(
                      myExpense,
                      partnerExpense,
                    ) > 0
                      ? Math.round(
                          (myExpense /
                            Math.max(
                              myExpense,
                              partnerExpense,
                            )) *
                            100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div>
            <span>
              {partnerNickname}
            </span>

            <strong>
              {partnerExpense.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>

            <div className="couple-progress partner">
              <span
                style={{
                  width: `${
                    Math.max(
                      myExpense,
                      partnerExpense,
                    ) > 0
                      ? Math.round(
                          (partnerExpense /
                            Math.max(
                              myExpense,
                              partnerExpense,
                            )) *
                            100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        <p className="couple-comparison-message">
          {myExpense === partnerExpense
            ? "이번 달 소비 금액이 같아요."
            : myExpense > partnerExpense
              ? `${myNickname}님이 ${(
                  myExpense -
                  partnerExpense
                ).toLocaleString(
                  "ko-KR",
                )}원 더 많이 썼어요.`
              : `${partnerNickname}님이 ${(
                  partnerExpense -
                  myExpense
                ).toLocaleString(
                  "ko-KR",
                )}원 더 많이 썼어요.`}
        </p>
      </section>

      <section className="analysis-card treat-analysis-card">
        <div className="analysis-section-heading">
          <h2>
            🎁 이번 달 사주기 분석
          </h2>

          <small>
            총 {treatExpenses.length}건
          </small>
        </div>

        <div className="treat-total">
          <span>
            전체 사주기 금액
          </span>

          <strong>
            {treatTotal.toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <div className="treat-comparison">
          <div>
            <header>
              <span>{myNickname}</span>

              <strong>
                {myTreatAmount.toLocaleString(
                  "ko-KR",
                )}
                원
              </strong>
            </header>

            <div className="treat-progress">
              <span
                style={{
                  width: `${Math.round(
                    (myTreatAmount /
                      treatMaximum) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>

          <div>
            <header>
              <span>
                {partnerNickname}
              </span>

              <strong>
                {partnerTreatAmount.toLocaleString(
                  "ko-KR",
                )}
                원
              </strong>
            </header>

            <div className="treat-progress partner">
              <span
                style={{
                  width: `${Math.round(
                    (partnerTreatAmount /
                      treatMaximum) *
                      100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="treat-result">
          <span>🐶</span>
          <p>{treatMessage}</p>
        </div>

        {biggestTreat && (
          <div className="biggest-treat">
            <span>
              가장 큰 사주기
            </span>

            <div>
              <strong>
                {biggestTreat.title ||
                  biggestTreat.category}
              </strong>

              <b>
                {Number(
                  biggestTreat.amount,
                ).toLocaleString(
                  "ko-KR",
                )}
                원
              </b>
            </div>
          </div>
        )}
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

      <strong className={valueClass}>
        {value}
      </strong>

      {subValue && (
        <small>{subValue}</small>
      )}

      <div
        className={`summary-round-icon ${iconClass}`}
      >
        {icon}
      </div>
    </article>
  );
}