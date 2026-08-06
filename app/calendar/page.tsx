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
import ExpenseSheet from "@/components/ExpenseSheet";
import { createClient } from "@/lib/supabase/client";

import "./calendar.css";

const supabase = createClient();

type ProfileData = {
  id: string;
  nickname: string | null;
  couple_id: string | null;
};

type IncomeRecord = {
  amount: number;
  income_date: string;
};

type ExpenseRecord = {
  id: string;
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
  settlement_status:
    | "해당없음"
    | "정산대기"
    | "정산완료";
  created_at: string;
};

type DailySnapshot = {
  id?: string;
  user_id: string;
  couple_id: string;
  budget_date: string;
  recommended_amount: number;
  used_amount: number;
};

type CalendarDayData = {
  day: number;
  date: string;
  currentMonth: boolean;
  usedAmount: number;
  recommendedAmount: number;
  difference: number;
  status:
    | "safe"
    | "warning"
    | "over"
    | "future"
    | "none";
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
    color: "#57ba7d",
  },
  카페: {
    icon: "☕",
    color: "#d6995d",
  },
  교통: {
    icon: "🚌",
    color: "#67a5df",
  },
  쇼핑: {
    icon: "🛍️",
    color: "#9c78cc",
  },
  문화: {
    icon: "🎬",
    color: "#f0aa42",
  },
  생활: {
    icon: "🏠",
    color: "#e98a8a",
  },
  의료: {
    icon: "💊",
    color: "#59b2aa",
  },
  기타: {
    icon: "•••",
    color: "#aaa5a0",
  },
};

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

function getDaysInMonth(
  year: number,
  month: number,
) {
  return new Date(
    year,
    month + 1,
    0,
  ).getDate();
}

function getWeekdayLabel(
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

  return weekdays[date.getDay()];
}

function formatTime(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(
    "ko-KR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function sumAmounts<
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

export default function CalendarPage() {
  const router = useRouter();

  const now = new Date();

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

  const [coupleId, setCoupleId] =
    useState<string | null>(null);

  const [partnerId, setPartnerId] =
    useState<string | null>(null);

  const [incomes, setIncomes] =
    useState<IncomeRecord[]>([]);

  const [expenses, setExpenses] =
    useState<ExpenseRecord[]>([]);

  const [snapshots, setSnapshots] =
    useState<DailySnapshot[]>([]);

  const [selectedDate, setSelectedDate] =
    useState(formatDate(now));

  const [detailOpen, setDetailOpen] =
    useState(false);

  const [expenseOpen, setExpenseOpen] =
    useState(false);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const monthRange = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const loadCalendarData =
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
      setCoupleId(profile.couple_id);

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

      const [
        incomeResult,
        expenseResult,
        snapshotResult,
      ] = await Promise.all([
        supabase
          .from("incomes")
          .select(
            "amount, income_date",
          )
          .eq("user_id", user.id)
          .eq(
            "couple_id",
            profile.couple_id,
          )
          .gte(
            "income_date",
            monthRange.start,
          )
          .lt(
            "income_date",
            monthRange.end,
          ),

        supabase
          .from("expenses")
          .select(`
            id,
            user_id,
            amount,
            category,
            title,
            memo,
            expense_date,
            use_type,
            payment_type,
            settlement_status,
            created_at
          `)
          .eq("user_id", user.id)
          .eq(
            "couple_id",
            profile.couple_id,
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
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          }),

        supabase
          .from(
            "daily_budget_snapshots",
          )
          .select(`
            id,
            user_id,
            couple_id,
            budget_date,
            recommended_amount,
            used_amount
          `)
          .eq("user_id", user.id)
          .gte(
            "budget_date",
            monthRange.start,
          )
          .lt(
            "budget_date",
            monthRange.end,
          ),
      ]);

      if (incomeResult.error) {
        console.error(
          "소득 조회 오류:",
          incomeResult.error,
        );
      }

      if (expenseResult.error) {
        console.error(
          "소비 조회 오류:",
          expenseResult.error,
        );
      }

      if (snapshotResult.error) {
        console.error(
          "권장 한도 조회 오류:",
          snapshotResult.error,
        );
      }

      const loadedIncomes =
        (incomeResult.data as
          | IncomeRecord[]
          | null) ?? [];

      const loadedExpenses =
        (expenseResult.data as
          | ExpenseRecord[]
          | null) ?? [];

      const loadedSnapshots =
        (snapshotResult.data as
          | DailySnapshot[]
          | null) ?? [];

      setIncomes(loadedIncomes);
      setExpenses(loadedExpenses);
      setSnapshots(loadedSnapshots);

      const daysInMonth =
        getDaysInMonth(year, month);

      const today = new Date();

      const selectedMonthStart =
        new Date(year, month, 1);

      const currentMonthStart =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          1,
        );

      let saveThroughDay = 0;

      if (
        selectedMonthStart <
        currentMonthStart
      ) {
        saveThroughDay =
          daysInMonth;
      } else if (
        year === today.getFullYear() &&
        month === today.getMonth()
      ) {
        saveThroughDay =
          today.getDate();
      }

      if (saveThroughDay > 0) {
        const monthlyBudget =
          sumAmounts(
            loadedIncomes,
          );

        const snapshotMap =
          new Map(
            loadedSnapshots.map(
              (snapshot) => [
                snapshot.budget_date,
                snapshot,
              ],
            ),
          );

        const usedByDate =
          new Map<string, number>();

        loadedExpenses.forEach(
          (expense) => {
            const previous =
              usedByDate.get(
                expense.expense_date,
              ) ?? 0;

            usedByDate.set(
              expense.expense_date,
              previous +
                Number(
                  expense.amount || 0,
                ),
            );
          },
        );

        let remainingAmount =
          monthlyBudget;

        const snapshotRows: DailySnapshot[] =
          [];

        for (
          let day = 1;
          day <= saveThroughDay;
          day += 1
        ) {
          const date = formatDate(
            new Date(
              year,
              month,
              day,
            ),
          );

          const existingSnapshot =
            snapshotMap.get(date);

          const remainingDays =
            daysInMonth - day + 1;

          const calculatedRecommended =
            remainingDays > 0
              ? Math.max(
                  0,
                  Math.floor(
                    remainingAmount /
                      remainingDays,
                  ),
                )
              : 0;

          const recommendedAmount =
            existingSnapshot
              ?.recommended_amount ??
            calculatedRecommended;

          const usedAmount =
            usedByDate.get(date) ?? 0;

          snapshotRows.push({
            user_id: user.id,
            couple_id:
              profile.couple_id,
            budget_date: date,
            recommended_amount:
              recommendedAmount,
            used_amount: usedAmount,
          });

          remainingAmount -=
            usedAmount;
        }

        const { error: upsertError } =
          await supabase
            .from(
              "daily_budget_snapshots",
            )
            .upsert(snapshotRows, {
              onConflict:
                "user_id,budget_date",
            });

        if (upsertError) {
          console.error(
            "권장 한도 저장 오류:",
            upsertError,
          );
        } else {
          setSnapshots(
            snapshotRows,
          );
        }
      }

      setLoading(false);
    }, [
      month,
      monthRange.end,
      monthRange.start,
      refreshKey,
      router,
      year,
    ]);

  useEffect(() => {
    void loadCalendarData();
  }, [loadCalendarData]);

  const monthlyBudget = useMemo(
    () => sumAmounts(incomes),
    [incomes],
  );

  const monthlyUsed = useMemo(
    () => sumAmounts(expenses),
    [expenses],
  );

  const remainingAmount =
    monthlyBudget - monthlyUsed;

  const recordedDates = useMemo(
    () =>
      new Set(
        expenses.map(
          (expense) =>
            expense.expense_date,
        ),
      ).size,
    [expenses],
  );

  const averageUsed =
    recordedDates > 0
      ? Math.round(
          monthlyUsed / recordedDates,
        )
      : 0;

  const usedByDate = useMemo(() => {
    const result =
      new Map<string, number>();

    expenses.forEach((expense) => {
      const current =
        result.get(
          expense.expense_date,
        ) ?? 0;

      result.set(
        expense.expense_date,
        current +
          Number(expense.amount || 0),
      );
    });

    return result;
  }, [expenses]);

  const highestDay = useMemo(() => {
    let result = {
      date: "",
      amount: 0,
    };

    usedByDate.forEach(
      (amount, date) => {
        if (amount > result.amount) {
          result = {
            date,
            amount,
          };
        }
      },
    );

    return result;
  }, [usedByDate]);

  const snapshotMap = useMemo(
    () =>
      new Map(
        snapshots.map((snapshot) => [
          snapshot.budget_date,
          snapshot,
        ]),
      ),
    [snapshots],
  );

  const todayString = formatDate(
    new Date(),
  );

  const currentRecommendedAmount =
    useMemo(() => {
      const today = new Date();

      const isCurrentMonth =
        year === today.getFullYear() &&
        month === today.getMonth();

      if (!isCurrentMonth) {
        return 0;
      }

      const remainingDays =
        getDaysInMonth(year, month) -
        today.getDate() +
        1;

      return remainingDays > 0
        ? Math.max(
            0,
            Math.floor(
              remainingAmount /
                remainingDays,
            ),
          )
        : 0;
    }, [
      month,
      remainingAmount,
      year,
    ]);

  const calendarDays =
    useMemo<CalendarDayData[]>(() => {
      const daysInMonth =
        getDaysInMonth(year, month);

      const firstWeekday =
        new Date(
          year,
          month,
          1,
        ).getDay();

      const previousMonthDays =
        getDaysInMonth(
          year,
          month - 1,
        );

      const result: CalendarDayData[] =
        [];

      for (
        let index = firstWeekday - 1;
        index >= 0;
        index -= 1
      ) {
        result.push({
          day:
            previousMonthDays -
            index,
          date: "",
          currentMonth: false,
          usedAmount: 0,
          recommendedAmount: 0,
          difference: 0,
          status: "none",
        });
      }

      for (
        let day = 1;
        day <= daysInMonth;
        day += 1
      ) {
        const date = formatDate(
          new Date(
            year,
            month,
            day,
          ),
        );

        const usedAmount =
          usedByDate.get(date) ?? 0;

        const snapshot =
          snapshotMap.get(date);

        const isFuture =
          date > todayString;

        const recommendedAmount =
          snapshot
            ?.recommended_amount ??
          (isFuture
            ? currentRecommendedAmount
            : 0);

        const difference =
          recommendedAmount -
          usedAmount;

        let status: CalendarDayData["status"] =
          "none";

        if (isFuture) {
          status = "future";
        } else if (
          recommendedAmount <= 0
        ) {
          status =
            usedAmount > 0
              ? "over"
              : "none";
        } else if (
          usedAmount >
          recommendedAmount
        ) {
          status = "over";
        } else if (
          usedAmount >=
          recommendedAmount * 0.8
        ) {
          status = "warning";
        } else {
          status = "safe";
        }

        result.push({
          day,
          date,
          currentMonth: true,
          usedAmount,
          recommendedAmount,
          difference,
          status,
        });
      }

      let nextDay = 1;

      while (result.length % 7 !== 0) {
        result.push({
          day: nextDay,
          date: "",
          currentMonth: false,
          usedAmount: 0,
          recommendedAmount: 0,
          difference: 0,
          status: "none",
        });

        nextDay += 1;
      }

      return result;
    }, [
      currentRecommendedAmount,
      month,
      snapshotMap,
      todayString,
      usedByDate,
      year,
    ]);

  const selectedExpenses =
    useMemo(
      () =>
        expenses.filter(
          (expense) =>
            expense.expense_date ===
            selectedDate,
        ),
      [expenses, selectedDate],
    );

  const selectedUsedAmount =
    usedByDate.get(selectedDate) ?? 0;

  const selectedSnapshot =
    snapshotMap.get(selectedDate);

  const selectedRecommendedAmount =
    selectedSnapshot
      ?.recommended_amount ??
    (selectedDate > todayString
      ? currentRecommendedAmount
      : 0);

  const selectedDifference =
    selectedRecommendedAmount -
    selectedUsedAmount;

  const selectedDateObject =
    new Date(
      `${selectedDate}T00:00:00`,
    );

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

    setSelectedDate(
      formatDate(nextDate),
    );

    setDetailOpen(false);
    setExpenseOpen(false);
  };

  const handleDayClick = (
    item: CalendarDayData,
  ) => {
    if (!item.currentMonth) {
      return;
    }

    setSelectedDate(item.date);
  };

  const openExpenseSheet = () => {
    if (!coupleId) {
      setMessage(
        "커플 정보를 불러오는 중이에요.",
      );
      return;
    }

    setExpenseOpen(true);
  };

  const handleExpenseSave = () => {
    setExpenseOpen(false);

    setRefreshKey(
      (current) => current + 1,
    );
  };

  if (loading) {
    return (
      <main className="calendar-loading">
        캘린더를 불러오고 있어요...
      </main>
    );
  }

  if (detailOpen) {
    return (
      <>
        <DayDetail
          date={selectedDate}
          expenses={selectedExpenses}
          usedAmount={
            selectedUsedAmount
          }
          recommendedAmount={
            selectedRecommendedAmount
          }
          difference={
            selectedDifference
          }
          onBack={() =>
            setDetailOpen(false)
          }
          onAddExpense={
            openExpenseSheet
          }
        />

        <ExpenseSheet
  open={expenseOpen}
  onClose={() =>
    setExpenseOpen(false)
  }
  coupleId={coupleId}
  partnerId={partnerId}
  initialDate={selectedDate}
  onSave={handleExpenseSave}
/>
      </>
    );
  }

  return (
    <main className="calendar-page">
      <header className="calendar-header">
        <button
          type="button"
          className="calendar-back-button"
          onClick={() =>
            router.back()
          }
          aria-label="뒤로 가기"
        >
          ←
        </button>

        <div className="calendar-title">
          <strong>캘린더</strong>

          <span>
            {year}년 {month + 1}월
          </span>
        </div>

        <div className="calendar-month-buttons">
          <button
            type="button"
            onClick={() =>
              changeMonth(-1)
            }
            aria-label="이전 달"
          >
            ‹
          </button>

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

      {message && (
        <p className="calendar-message">
          {message}
        </p>
      )}

      <section className="calendar-hero">
        <div>
          <h2>
            {month + 1}월 소비 계획 🐶
          </h2>

          <p>
            남은 금액을 기준으로
            <br />
            하루 권장 한도를 계산해요.
          </p>
        </div>

        <Image
          src="/chorong-v2.png"
          alt="초롱이"
          width={145}
          height={145}
          priority
        />
      </section>

      <section className="daily-recommendation-card">
        <div>
          <span>
            현재 남은 금액
          </span>

          <strong>
            {remainingAmount.toLocaleString(
              "ko-KR",
            )}
            <small>원</small>
          </strong>
        </div>

        <div>
          <span>
            오늘 권장 한도
          </span>

          <strong className="recommendation">
            {currentRecommendedAmount.toLocaleString(
              "ko-KR",
            )}
            <small>원</small>
          </strong>
        </div>

        <p>
          적게 쓰면 다음 날 한도가
          늘고, 많이 쓰면 다음 날
          한도가 줄어들어요.
        </p>
      </section>

      <section className="monthly-summary">
        <SummaryItem
          label="이번 달 예산"
          value={`${monthlyBudget.toLocaleString(
            "ko-KR",
          )}원`}
          active
        />

        <SummaryItem
          label="총소비"
          value={`${monthlyUsed.toLocaleString(
            "ko-KR",
          )}원`}
          coral
        />

        <SummaryItem
          label="일평균 소비"
          value={`${averageUsed.toLocaleString(
            "ko-KR",
          )}원`}
        />

        <SummaryItem
          label="최고 소비"
          value={`${highestDay.amount.toLocaleString(
            "ko-KR",
          )}원`}
          sub={
            highestDay.date
              ? `(${Number(
                  highestDay.date.slice(
                    5,
                    7,
                  ),
                )}/${Number(
                  highestDay.date.slice(
                    8,
                    10,
                  ),
                )})`
              : undefined
          }
          coral
        />
      </section>

      <section className="calendar-area">
        <div className="weekday-row">
          {[
            "일",
            "월",
            "화",
            "수",
            "목",
            "금",
            "토",
          ].map((day, index) => (
            <span
              key={day}
              className={
                index === 0
                  ? "sunday"
                  : index === 6
                    ? "saturday"
                    : ""
              }
            >
              {day}
            </span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map(
            (item, index) => {
              const selected =
                item.currentMonth &&
                item.date ===
                  selectedDate;

              const weekday =
                index % 7;

              return (
                <button
                  type="button"
                  key={`${item.day}-${index}`}
                  className={[
                    "calendar-cell",
                    !item.currentMonth
                      ? "muted"
                      : "",
                    selected
                      ? "selected"
                      : "",
                    weekday === 0
                      ? "sunday"
                      : "",
                    weekday === 6
                      ? "saturday"
                      : "",
                    item.status,
                  ].join(" ")}
                  disabled={
                    !item.currentMonth
                  }
                  onClick={() =>
                    handleDayClick(item)
                  }
                >
                  <span className="day-number">
                    {item.day}
                  </span>

                  {item.currentMonth &&
                    item.usedAmount >
                      0 && (
                      <small className="day-used">
                        {item.usedAmount.toLocaleString(
                          "ko-KR",
                        )}
                      </small>
                    )}

                  {item.currentMonth &&
                    item.recommendedAmount >
                      0 && (
                      <span className="day-limit">
                        권장{" "}
                        {Math.round(
                          item.recommendedAmount /
                            1000,
                        )}
                        천
                      </span>
                    )}

                  {item.currentMonth &&
                    item.date <=
                      todayString &&
                    item.recommendedAmount >
                      0 && (
                      <i
                        className={`day-status-dot ${item.status}`}
                      />
                    )}
                </button>
              );
            },
          )}
        </div>
      </section>

      <section className="selected-day-card">
        <div className="selected-day-heading">
          <div>
            <h2>
              {selectedDateObject.getMonth() +
                1}
              월{" "}
              {selectedDateObject.getDate()}
              일 (
              {getWeekdayLabel(
                selectedDate,
              )}
              )
            </h2>

            <span>
              권장 한도{" "}
              {selectedRecommendedAmount.toLocaleString(
                "ko-KR",
              )}
              원
            </span>
          </div>

          <strong>
            사용{" "}
            {selectedUsedAmount.toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <div
          className={`selected-day-result ${
            selectedDifference < 0
              ? "over"
              : "safe"
          }`}
        >
          <span>
            {selectedDifference < 0
              ? "권장 한도보다"
              : "오늘 남은 금액"}
          </span>

          <strong>
            {Math.abs(
              selectedDifference,
            ).toLocaleString("ko-KR")}
            원
            {selectedDifference < 0
              ? " 초과"
              : ""}
          </strong>
        </div>

        <ExpenseList
          expenses={selectedExpenses}
        />

        <div className="calendar-card-actions">
          <button
            type="button"
            className="calendar-detail-button"
            onClick={() =>
              setDetailOpen(true)
            }
          >
            날짜 상세 보기
          </button>

          <button
            type="button"
            className="calendar-add-button"
            onClick={
              openExpenseSheet
            }
          >
            ＋ 소비 기록하기
          </button>
        </div>
      </section>

      <ExpenseSheet
  open={expenseOpen}
  onClose={() =>
    setExpenseOpen(false)
  }
  coupleId={coupleId}
  partnerId={partnerId}
  initialDate={selectedDate}
  onSave={handleExpenseSave}
/>

      {!expenseOpen && (
        <BottomNavigation active="calendar" />
      )}
    </main>
  );
}

function SummaryItem({
  label,
  value,
  sub,
  active,
  coral,
}: {
  label: string;
  value: string;
  sub?: string;
  active?: boolean;
  coral?: boolean;
}) {
  return (
    <div
      className={
        active
          ? "summary-item active"
          : "summary-item"
      }
    >
      <span>{label}</span>

      <strong
        className={
          coral ? "coral" : ""
        }
      >
        {value}
      </strong>

      {sub && <small>{sub}</small>}
    </div>
  );
}

function ExpenseList({
  expenses,
}: {
  expenses: ExpenseRecord[];
}) {
  if (expenses.length === 0) {
    return (
      <p className="empty-expense">
        이 날짜에는 소비 기록이 없어요.
      </p>
    );
  }

  return (
    <div className="calendar-expense-list">
      {expenses.map((item) => {
        const info =
          categoryInfo[item.category] ??
          categoryInfo.기타;

        return (
          <article
            className="calendar-expense-item"
            key={item.id}
          >
            <div
              className="expense-icon"
              style={{
                background: `${info.color}1e`,
              }}
            >
              {info.icon}
            </div>

            <div className="expense-info">
              <small>
                {item.category}
              </small>

              <strong>
                {item.title ||
                  item.category}
              </strong>

              <span>
                {item.use_type ===
                "함께"
                  ? `둘이 함께 · ${
                      item.payment_type ??
                      ""
                    }`
                  : "나 혼자"}
              </span>
            </div>

            <div className="expense-price">
              <strong>
                {Number(
                  item.amount,
                ).toLocaleString(
                  "ko-KR",
                )}
                원
              </strong>

              {item.settlement_status ===
                "정산대기" && (
                <span>정산전</span>
              )}

              {item.settlement_status ===
                "정산완료" && (
                <span className="complete">
                  정산완료
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DayDetail({
  date,
  expenses,
  usedAmount,
  recommendedAmount,
  difference,
  onBack,
  onAddExpense,
}: {
  date: string;
  expenses: ExpenseRecord[];
  usedAmount: number;
  recommendedAmount: number;
  difference: number;
  onBack: () => void;
  onAddExpense: () => void;
}) {
  const dateObject = new Date(
    `${date}T00:00:00`,
  );

  const usageRate =
    recommendedAmount > 0
      ? Math.round(
          (usedAmount /
            recommendedAmount) *
            100,
        )
      : 0;

  const progressWidth = Math.min(
    Math.max(usageRate, 0),
    100,
  );

  return (
    <main className="day-detail-page">
      <header className="day-detail-header">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
        >
          ←
        </button>

        <h1>
          {dateObject.getMonth() + 1}
          월 {dateObject.getDate()}일 (
          {getWeekdayLabel(date)})
        </h1>

        <span>🗓️</span>
      </header>

      <section className="day-budget-summary">
        <div>
          <span>오늘 권장 한도</span>

          <strong>
            {recommendedAmount.toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <div>
          <span>사용 금액</span>

          <strong className="used">
            {usedAmount.toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <div>
          <span>
            {difference < 0
              ? "초과 금액"
              : "남은 금액"}
          </span>

          <strong
            className={
              difference < 0
                ? "over"
                : "remaining"
            }
          >
            {Math.abs(
              difference,
            ).toLocaleString("ko-KR")}
            원
          </strong>
        </div>

        <div className="day-progress">
          <span
            style={{
              width: `${progressWidth}%`,
            }}
            className={
              usageRate > 100
                ? "over"
                : usageRate >= 80
                  ? "warning"
                  : ""
            }
          />
        </div>

        <p>
          권장 한도의 {usageRate}%를
          사용했어요.
        </p>
      </section>

      <section className="day-category-list">
        {expenses.length === 0 ? (
          <div className="day-detail-empty">
            <span>💸</span>

            <strong>
              소비 기록이 없어요
            </strong>
          </div>
        ) : (
          expenses.map((item) => {
            const info =
              categoryInfo[
                item.category
              ] ??
              categoryInfo.기타;

            return (
              <article
                className="day-detail-item"
                key={item.id}
              >
                <div
                  className="expense-icon large"
                  style={{
                    background: `${info.color}1e`,
                  }}
                >
                  {info.icon}
                </div>

                <div className="day-detail-info">
                  <strong>
                    {item.title ||
                      item.category}
                  </strong>

                  <span>
                    {item.category} ·{" "}
                    {item.use_type ===
                    "함께"
                      ? "둘이 함께"
                      : "나 혼자"}
                  </span>

                  <small>
                    {formatTime(
                      item.created_at,
                    )}
                  </small>

                  {item.memo && (
                    <p>{item.memo}</p>
                  )}
                </div>

                <div className="day-detail-price">
                  <strong>
                    {Number(
                      item.amount,
                    ).toLocaleString(
                      "ko-KR",
                    )}
                    원
                  </strong>

                  {item.settlement_status ===
                    "정산대기" && (
                    <span>정산전</span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      <div className="day-detail-actions">
        <button
          type="button"
          className="primary"
          onClick={onAddExpense}
        >
          ＋ 소비 기록하기
        </button>

        <button
          type="button"
          className="secondary"
          onClick={onBack}
        >
          캘린더로 돌아가기
        </button>
      </div>
    </main>
  );
}