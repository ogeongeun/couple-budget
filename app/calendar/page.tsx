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

const BUDGET_START_DAY = 1;

type ViewType = "me" | "partner";

type ProfileData = {
  id: string;
  nickname: string | null;
  couple_id: string | null;
};

type IncomeRecord = {
  id: string;
  amount: number;
  category: string;
  memo: string | null;
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

type SavingRecord = {
  id: string;
  user_id: string;

  type:
    | "deposit"
    | "withdraw";

  amount: number;
  memo: string | null;
  saving_date: string;
  created_at: string;
};

type SavingBalanceRecord = {
  type:
    | "deposit"
    | "withdraw";

  amount: number;
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

  incomeAmount: number;

  savingDifference: number;

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

  생활비: {
    icon: "🏠",
    color: "#e98a8a",
  },

  의료: {
    icon: "💊",
    color: "#59b2aa",
  },

  미용: {
    icon: "💄",
    color: "#f39ab5",
  },

  기타: {
    icon: "•••",
    color: "#aaa5a0",
  },
};

function formatDate(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
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
  const date =
    new Date(
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

  return weekdays[
    date.getDay()
  ];
}

function formatTime(
  dateString: string,
) {
  const date =
    new Date(
      dateString,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
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
>(
  items: T[],
) {
  return items.reduce(
    (
      sum,
      item,
    ) =>
      sum +
      Number(
        item.amount ||
          0,
      ),
    0,
  );
}

export default function CalendarPage() {
  const router =
    useRouter();

  const now =
    new Date();

  const [
    view,
    setView,
  ] =
    useState<ViewType>(
      "me",
    );

  const [
    year,
    setYear,
  ] =
    useState(
      now.getFullYear(),
    );

  const [
    month,
    setMonth,
  ] =
    useState(
      now.getMonth(),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    userId,
    setUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    coupleId,
    setCoupleId,
  ] =
    useState<
      string | null
    >(null);

  const [
    partnerId,
    setPartnerId,
  ] =
    useState<
      string | null
    >(null);

  const [
    myNickname,
    setMyNickname,
  ] =
    useState("나");

  const [
    partnerNickname,
    setPartnerNickname,
  ] =
    useState(
      "상대",
    );

  const [
    incomes,
    setIncomes,
  ] =
    useState<
      IncomeRecord[]
    >([]);

  const [
    expenses,
    setExpenses,
  ] =
    useState<
      ExpenseRecord[]
    >([]);

  const [
    savings,
    setSavings,
  ] =
    useState<
      SavingRecord[]
    >([]);

  const [
    currentSavingBalance,
    setCurrentSavingBalance,
  ] =
    useState(0);

  const [
    budgetCarryover,
    setBudgetCarryover,
  ] = useState(0);

  const [
    snapshots,
    setSnapshots,
  ] =
    useState<
      DailySnapshot[]
    >([]);

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState(
      formatDate(
        now,
      ),
    );

  const [
    detailOpen,
    setDetailOpen,
  ] =
    useState(
      false,
    );

  const [
    expenseOpen,
    setExpenseOpen,
  ] =
    useState(
      false,
    );

  const [
    refreshKey,
    setRefreshKey,
  ] =
    useState(0);

  const budgetRange =
    useMemo(
      () => {
        const today = new Date();
        const isCurrentMonth =
          year === today.getFullYear() &&
          month === today.getMonth();
        const anchor = new Date(year, month, 1);

        if (
          isCurrentMonth &&
          today.getDate() < BUDGET_START_DAY
        ) {
          anchor.setMonth(anchor.getMonth() - 1);
        }

        return getBudgetCycleRange(
          anchor.getFullYear(),
          anchor.getMonth(),
        );
      },
      [year, month],
    );

  const budgetDataRange =
    useMemo(
      () =>
        getCalendarBudgetDataRange(
          year,
          month,
        ),
      [year, month],
    );

  const selectedNickname =
    view === "me"
      ? myNickname
      : partnerNickname;

  const budgetPeriodEnd = new Date(
    `${budgetRange.end}T00:00:00`,
  );
  budgetPeriodEnd.setDate(budgetPeriodEnd.getDate() - 1);

  const budgetPeriodLabel = `${Number(
    budgetRange.start.slice(5, 7),
  )}월 ${Number(
    budgetRange.start.slice(8, 10),
  )}일~${budgetPeriodEnd.getMonth() + 1}월 ${budgetPeriodEnd.getDate()}일`;

  const isMyCalendar =
    view === "me";

  const loadCalendarData =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setMessage(
          "",
        );

        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          router.replace(
            "/login",
          );

          return;
        }

        const {
          data:
            profileData,
          error:
            profileError,
        } =
          await supabase
            .from(
              "profiles",
            )
            .select(
              "id, nickname, couple_id",
            )
            .eq(
              "id",
              user.id,
            )
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

          setLoading(
            false,
          );

          return;
        }

        const profile =
          profileData as ProfileData;

        if (
          !profile.couple_id
        ) {
          router.replace(
            "/couple/connect",
          );

          return;
        }

        setUserId(
          user.id,
        );

        setCoupleId(
          profile.couple_id,
        );

        setMyNickname(
          profile.nickname ??
            "나",
        );

        const {
          data:
            partnerData,
          error:
            partnerError,
        } =
          await supabase
            .from(
              "profiles",
            )
            .select(
              "id, nickname, couple_id",
            )
            .eq(
              "couple_id",
              profile.couple_id,
            )
            .neq(
              "id",
              user.id,
            )
            .limit(
              1,
            )
            .maybeSingle();

        if (
          partnerError
        ) {
          console.error(
            "상대방 조회 오류:",
            partnerError,
          );
        }

        const partner =
          partnerData as
            | ProfileData
            | null;

        const resolvedPartnerId =
          partner?.id ??
          null;

        setPartnerId(
          resolvedPartnerId,
        );

        setPartnerNickname(
          partner?.nickname ??
            "상대",
        );

        const targetUserId =
          view === "me"
            ? user.id
            : resolvedPartnerId;

        if (
          !targetUserId
        ) {
          setIncomes(
            [],
          );

          setExpenses(
            [],
          );

          setSavings(
            [],
          );

          setSnapshots(
            [],
          );

          setCurrentSavingBalance(
            0,
          );

          setBudgetCarryover(0);

          setLoading(
            false,
          );

          return;
        }

        const [
          incomeResult,
          expenseResult,
          savingResult,
          savingBalanceResult,
          snapshotResult,
          previousIncomeResult,
          previousExpenseResult,
          previousSavingResult,
        ] =
          await Promise.all([
            /*
             * 이번 달 예산
             */
            supabase
              .from(
                "incomes",
              )
              .select(
                "id, amount, category, memo, income_date",
              )
              .eq(
                "user_id",
                targetUserId,
              )
              .eq(
                "couple_id",
                profile.couple_id,
              )
              .gte(
                "income_date",
                budgetDataRange.start,
              )
              .lt(
                "income_date",
                budgetDataRange.end,
              ),

            /*
             * 이번 달 소비
             */
            supabase
              .from(
                "expenses",
              )
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
              .eq(
                "user_id",
                targetUserId,
              )
              .eq(
                "couple_id",
                profile.couple_id,
              )
              .gte(
                "expense_date",
                budgetDataRange.start,
              )
              .lt(
                "expense_date",
                budgetDataRange.end,
              )
              .order(
                "expense_date",
                {
                  ascending:
                    true,
                },
              )
              .order(
                "created_at",
                {
                  ascending:
                    true,
                },
              ),

            /*
             * 이번 달 저금 기록
             * 캘린더 표시용
             */
            supabase
              .from(
                "savings",
              )
              .select(`
                id,
                user_id,
                type,
                amount,
                memo,
                saving_date,
                created_at
              `)
              .eq(
                "user_id",
                targetUserId,
              )
              .eq(
                "couple_id",
                profile.couple_id,
              )
              .gte(
                "saving_date",
                budgetDataRange.start,
              )
              .lt(
                "saving_date",
                budgetDataRange.end,
              )
              .order(
                "saving_date",
                {
                  ascending:
                    true,
                },
              )
              .order(
                "created_at",
                {
                  ascending:
                    true,
                },
              ),

            /*
             * 전체 저금 기록
             * 현재 저금통 잔액 계산용
             */
            supabase
              .from(
                "savings",
              )
              .select(
                "type, amount",
              )
              .eq(
                "user_id",
                targetUserId,
              )
              .eq(
                "couple_id",
                profile.couple_id,
              ),

            /*
             * 하루 권장 한도
             */
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
              .eq(
                "user_id",
                targetUserId,
              )
              .gte(
                "budget_date",
                budgetDataRange.start,
              )
              .lt(
                "budget_date",
                budgetDataRange.end,
              ),

            supabase
              .from("incomes")
              .select("amount")
              .eq("user_id", targetUserId)
              .eq("couple_id", profile.couple_id)
              .lt("income_date", budgetDataRange.start),

            supabase
              .from("expenses")
              .select("amount")
              .eq("user_id", targetUserId)
              .eq("couple_id", profile.couple_id)
              .lt("expense_date", budgetDataRange.start),

            supabase
              .from("savings")
              .select("type, amount")
              .eq("user_id", targetUserId)
              .eq("couple_id", profile.couple_id)
              .lt("saving_date", budgetDataRange.start),
          ]);

        if (
          incomeResult.error
        ) {
          console.error(
            "소득 조회 오류:",
            incomeResult.error,
          );
        }

        if (
          expenseResult.error
        ) {
          console.error(
            "소비 조회 오류:",
            expenseResult.error,
          );
        }

        if (
          savingResult.error
        ) {
          console.error(
            "저금 조회 오류:",
            savingResult.error,
          );
        }

        if (
          savingBalanceResult.error
        ) {
          console.error(
            "저금통 잔액 조회 오류:",
            savingBalanceResult.error,
          );
        }

        if (
          snapshotResult.error
        ) {
          console.error(
            "권장 한도 조회 오류:",
            snapshotResult.error,
          );
        }

        if (
          previousIncomeResult.error ||
          previousExpenseResult.error ||
          previousSavingResult.error
        ) {
          console.error(
            "이월 금액 조회 오류:",
            previousIncomeResult.error ??
              previousExpenseResult.error ??
              previousSavingResult.error,
          );
        }

        const loadedIncomes =
          (
            incomeResult.data as
              | IncomeRecord[]
              | null
          ) ??
          [];

        const loadedExpenses =
          (
            expenseResult.data as
              | ExpenseRecord[]
              | null
          ) ??
          [];

        const loadedSavings =
          (
            savingResult.data as
              | SavingRecord[]
              | null
          ) ??
          [];

        const allSavings =
          (
            savingBalanceResult.data as
              | SavingBalanceRecord[]
              | null
          ) ??
          [];

        const loadedSnapshots =
          (
            snapshotResult.data as
              | DailySnapshot[]
              | null
          ) ??
          [];

        const previousSavings =
          (previousSavingResult.data as
            | SavingBalanceRecord[]
            | null) ?? [];

        const previousNetSaving = previousSavings.reduce(
          (sum, saving) =>
            saving.type === "deposit"
              ? sum + Number(saving.amount || 0)
              : sum - Number(saving.amount || 0),
          0,
        );

        const openingCarryover =
          sumAmounts(
            (previousIncomeResult.data as
              | { amount: number }[]
              | null) ?? [],
          ) -
          sumAmounts(
            (previousExpenseResult.data as
              | { amount: number }[]
              | null) ?? [],
          ) -
          previousNetSaving;

        const selectedCarryover =
          openingCarryover +
          sumAmounts(
            loadedIncomes.filter(
              (income) =>
                income.income_date < budgetRange.start,
            ),
          ) -
          sumAmounts(
            loadedExpenses.filter(
              (expense) =>
                expense.expense_date < budgetRange.start,
            ),
          ) -
          loadedSavings
            .filter(
              (saving) =>
                saving.saving_date < budgetRange.start,
            )
            .reduce(
              (sum, saving) =>
                saving.type === "deposit"
                  ? sum + Number(saving.amount || 0)
                  : sum - Number(saving.amount || 0),
              0,
            );

        setBudgetCarryover(selectedCarryover);

        setIncomes(
          loadedIncomes,
        );

        setExpenses(
          loadedExpenses,
        );

        setSavings(
          loadedSavings,
        );

        setSnapshots(
          loadedSnapshots,
        );

        /*
         * 현재 저금통 잔액
         *
         * 전체 저금
         * -
         * 전체 꺼낸 금액
         */
        const totalDeposits =
          allSavings
            .filter(
              (
                saving,
              ) =>
                saving.type ===
                "deposit",
            )
            .reduce(
              (
                total,
                saving,
              ) =>
                total +
                Number(
                  saving.amount ||
                    0,
                ),
              0,
            );

        const totalWithdrawals =
          allSavings
            .filter(
              (
                saving,
              ) =>
                saving.type ===
                "withdraw",
            )
            .reduce(
              (
                total,
                saving,
              ) =>
                total +
                Number(
                  saving.amount ||
                    0,
                ),
              0,
            );

        setCurrentSavingBalance(
          Math.max(
            0,
            totalDeposits -
              totalWithdrawals,
          ),
        );

        /*
         * 내 캘린더를 볼 때만
         * 권장 한도를 업데이트한다.
         */
        if (
          view === "me"
        ) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const dataStart = new Date(
            `${budgetDataRange.start}T00:00:00`,
          );
          const dataEnd = new Date(
            `${budgetDataRange.end}T00:00:00`,
          );
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const saveEnd =
            dataEnd < tomorrow
              ? dataEnd
              : tomorrow;

          if (dataStart < saveEnd) {
            const usedMap =
              new Map<
                string,
                number
              >();

            loadedExpenses.forEach(
              (
                expense,
              ) => {
                const previous =
                  usedMap.get(
                    expense.expense_date,
                  ) ??
                  0;

                usedMap.set(
                  expense.expense_date,
                  previous +
                    Number(
                      expense.amount ||
                        0,
                    ),
                );
              },
            );

            const savingMap =
              new Map<
                string,
                number
              >();

            loadedSavings.forEach(
              (
                saving,
              ) => {
                const previous =
                  savingMap.get(
                    saving.saving_date,
                  ) ??
                  0;

                /*
                 * 저금 +
                 * 꺼내기 -
                 *
                 * 즉 저금통으로 이동한
                 * 순금액
                 */
                const change =
                  saving.type ===
                  "deposit"
                    ? Number(
                        saving.amount ||
                          0,
                      )
                    : -Number(
                        saving.amount ||
                          0,
                      );

                savingMap.set(
                  saving.saving_date,
                  previous +
                    change,
                );
              },
            );

            let usableAmount = openingCarryover;
            let cycleEnd = new Date(dataStart);

            const snapshotRows: DailySnapshot[] =
              [];

            for (
              const cursor = new Date(dataStart);
              cursor < saveEnd;
              cursor.setDate(cursor.getDate() + 1)
            ) {
              const date = formatDate(cursor);

              if (cursor.getDate() === BUDGET_START_DAY) {
                cycleEnd = new Date(
                  cursor.getFullYear(),
                  cursor.getMonth() + 1,
                  BUDGET_START_DAY,
                );

                const cycleStartString = formatDate(cursor);
                const cycleEndString = formatDate(cycleEnd);

                usableAmount += sumAmounts(
                  loadedIncomes.filter(
                    (income) =>
                      income.income_date >= cycleStartString &&
                      income.income_date < cycleEndString,
                  ),
                );
              }

              const remainingDays =
                getCalendarDayCount(cursor, cycleEnd);

              const calculatedRecommended =
                remainingDays >
                0
                  ? Math.max(
                      0,
                      Math.floor(
                        usableAmount /
                          remainingDays,
                      ),
                    )
                  : 0;

              const usedAmount =
                usedMap.get(
                  date,
                ) ??
                0;

              const savingDifference =
                savingMap.get(
                  date,
                ) ??
                0;

              snapshotRows.push(
                {
                  user_id:
                    user.id,

                  couple_id:
                    profile.couple_id,

                  budget_date:
                    date,

                  recommended_amount:
                    calculatedRecommended,

                  used_amount:
                    usedAmount,
                },
              );

              /*
               * 사용 가능 예산:
               *
               * 소비하면 감소
               * 저금하면 감소
               * 꺼내면 증가
               */
              usableAmount -=
                usedAmount;

              usableAmount -=
                savingDifference;
            }

            const {
              error:
                upsertError,
            } =
              await supabase
                .from(
                  "daily_budget_snapshots",
                )
                .upsert(
                  snapshotRows,
                  {
                    onConflict:
                      "user_id,budget_date",
                  },
                );

            if (
              upsertError
            ) {
              console.error(
                "권장 한도 저장 오류:",
                upsertError,
              );
            } else {
              setSnapshots(
                snapshotRows.filter(
                  (snapshot) =>
                    snapshot.budget_date >= budgetDataRange.start &&
                    snapshot.budget_date < budgetDataRange.end,
                ),
              );
            }
          }
        }

        setLoading(
          false,
        );
      },
      [
        month,
        budgetDataRange.end,
        budgetDataRange.start,
        budgetRange.start,
        refreshKey,
        router,
        view,
        year,
      ],
    );

  useEffect(
    () => {
      void loadCalendarData();
    },
    [
      loadCalendarData,
    ],
  );

  /*
   * 이번 예산 기간(5일~다음 달 4일) 기록
   */
  const budgetIncomes =
    useMemo(
      () =>
        incomes.filter(
          (income) =>
            income.income_date >= budgetRange.start &&
            income.income_date < budgetRange.end,
        ),
      [budgetRange.end, budgetRange.start, incomes],
    );

  const budgetExpenses =
    useMemo(
      () =>
        expenses.filter(
          (expense) =>
            expense.expense_date >= budgetRange.start &&
            expense.expense_date < budgetRange.end,
        ),
      [budgetRange.end, budgetRange.start, expenses],
    );

  const budgetSavings =
    useMemo(
      () =>
        savings.filter(
          (saving) =>
            saving.saving_date >= budgetRange.start &&
            saving.saving_date < budgetRange.end,
        ),
      [budgetRange.end, budgetRange.start, savings],
    );

  const monthlyBudget =
    useMemo(
      () =>
        sumAmounts(
          budgetIncomes,
        ),
      [
        budgetIncomes,
      ],
    );

  /*
   * 이번 달 소비
   */
  const monthlyUsed =
    useMemo(
      () =>
        sumAmounts(
          budgetExpenses,
        ),
      [
        budgetExpenses,
      ],
    );

  /*
   * 이번 달 저금한 금액
   */
  const monthlySaved =
    useMemo(
      () =>
        budgetSavings
          .filter(
            (
              saving,
            ) =>
              saving.type ===
              "deposit",
          )
          .reduce(
            (
              total,
              saving,
            ) =>
              total +
              Number(
                saving.amount ||
                  0,
              ),
            0,
          ),
      [
        budgetSavings,
      ],
    );

  /*
   * 이번 달 꺼낸 금액
   */
  const monthlyWithdrawn =
    useMemo(
      () =>
        budgetSavings
          .filter(
            (
              saving,
            ) =>
              saving.type ===
              "withdraw",
          )
          .reduce(
            (
              total,
              saving,
            ) =>
              total +
              Number(
                saving.amount ||
                  0,
              ),
            0,
          ),
      [
        budgetSavings,
      ],
    );

  /*
   * 현재 사용 가능 예산
   *
   * 이번 달 예산
   * - 이번 달 소비
   * - 이번 달 저금
   * + 이번 달 꺼낸 돈
   */
  const remainingAmount =
    budgetCarryover +
    monthlyBudget -
    monthlyUsed -
    monthlySaved +
    monthlyWithdrawn;

  /*
   * 날짜별 소비
   */
  const usedByDate =
    useMemo(
      () => {
        const result =
          new Map<
            string,
            number
          >();

        expenses.forEach(
          (
            expense,
          ) => {
            const current =
              result.get(
                expense.expense_date,
              ) ??
              0;

            result.set(
              expense.expense_date,
              current +
                Number(
                  expense.amount ||
                    0,
                ),
            );
          },
        );

        return result;
      },
      [
        expenses,
      ],
    );

  /*
   * 날짜별 수익
   */
  const incomeByDate =
    useMemo(
      () => {
        const result =
          new Map<string, number>();

        incomes.forEach((income) => {
          const current =
            result.get(income.income_date) ?? 0;

          result.set(
            income.income_date,
            current + Number(income.amount || 0),
          );
        });

        return result;
      },
      [incomes],
    );

  /*
   * 날짜별 저금 차액
   *
   * deposit  +금액
   * withdraw -금액
   *
   * 예:
   * 저금 50,000
   * 꺼냄 20,000
   * = +30,000
   */
  const savingDifferenceByDate =
    useMemo(
      () => {
        const result =
          new Map<
            string,
            number
          >();

        savings.forEach(
          (
            saving,
          ) => {
            const current =
              result.get(
                saving.saving_date,
              ) ??
              0;

            const difference =
              saving.type ===
              "deposit"
                ? Number(
                    saving.amount ||
                      0,
                  )
                : -Number(
                    saving.amount ||
                      0,
                  );

            result.set(
              saving.saving_date,
              current +
                difference,
            );
          },
        );

        return result;
      },
      [
        savings,
      ],
    );

  /*
   * 최고 소비 날짜
   */
  const highestDay =
    useMemo(
      () => {
        let result = {
          date: "",
          amount: 0,
        };

        usedByDate.forEach(
          (
            amount,
            date,
          ) => {
            if (
              date < budgetRange.start ||
              date >= budgetRange.end
            ) {
              return;
            }

            if (
              amount >
              result.amount
            ) {
              result = {
                date,
                amount,
              };
            }
          },
        );

        return result;
      },
      [
        budgetRange.end,
        budgetRange.start,
        usedByDate,
      ],
    );

  const snapshotMap =
    useMemo(
      () =>
        new Map(
          snapshots.map(
            (
              snapshot,
            ) => [
              snapshot.budget_date,
              snapshot,
            ],
          ),
        ),
      [
        snapshots,
      ],
    );

  const todayString =
    formatDate(
      new Date(),
    );

  /*
   * 오늘 권장 한도
   */
  const currentRecommendedAmount =
    useMemo(
      () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayDate = formatDate(today);

        if (
          todayDate < budgetRange.start ||
          todayDate >= budgetRange.end
        ) {
          return 0;
        }

        const cycleEnd = new Date(
          `${budgetRange.end}T00:00:00`,
        );
        const remainingDays =
          getCalendarDayCount(today, cycleEnd);

        return remainingDays >
          0
          ? Math.max(
              0,
              Math.floor(
                remainingAmount /
                  remainingDays,
              ),
            )
          : 0;
      },
      [
        budgetRange.end,
        budgetRange.start,
        remainingAmount,
      ],
    );

  /*
   * 달력 데이터
   */
  const calendarDays =
    useMemo<
      CalendarDayData[]
    >(
      () => {
        const daysInMonth =
          getDaysInMonth(
            year,
            month,
          );

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

        /*
         * 이전 달
         */
        for (
          let index =
            firstWeekday -
            1;
          index >=
          0;
          index -=
          1
        ) {
          result.push(
            {
              day:
                previousMonthDays -
                index,

              date: "",

              currentMonth:
                false,

              usedAmount:
                0,

              incomeAmount:
                0,

              savingDifference:
                0,

              recommendedAmount:
                0,

              difference:
                0,

              status:
                "none",
            },
          );
        }

        /*
         * 현재 달
         */
        for (
          let day = 1;
          day <=
          daysInMonth;
          day += 1
        ) {
          const date =
            formatDate(
              new Date(
                year,
                month,
                day,
              ),
            );

          const usedAmount =
            usedByDate.get(
              date,
            ) ??
            0;

          const incomeAmount =
            incomeByDate.get(date) ?? 0;

          const savingDifference =
            savingDifferenceByDate.get(
              date,
            ) ??
            0;

          const snapshot =
            snapshotMap.get(
              date,
            );

          const isFuture =
            date >
            todayString;

          const recommendedAmount =
            snapshot
              ?.recommended_amount ??
            (
              isFuture &&
              date >= budgetRange.start &&
              date < budgetRange.end
                ? currentRecommendedAmount
                : 0
            );

          const difference =
            recommendedAmount -
            usedAmount;

          let status: CalendarDayData["status"] =
            "none";

          if (
            isFuture
          ) {
            status =
              "future";
          } else if (
            recommendedAmount <=
            0
          ) {
            status =
              usedAmount >
              0
                ? "over"
                : "none";
          } else if (
            usedAmount >
            recommendedAmount
          ) {
            status =
              "over";
          } else if (
            usedAmount >=
            recommendedAmount *
              0.8
          ) {
            status =
              "warning";
          } else {
            status =
              "safe";
          }

          result.push(
            {
              day,
              date,

              currentMonth:
                true,

              usedAmount,

              incomeAmount,

              savingDifference,

              recommendedAmount,

              difference,

              status,
            },
          );
        }

        /*
         * 다음 달
         */
        let nextDay =
          1;

        while (
          result.length %
            7 !==
          0
        ) {
          result.push(
            {
              day:
                nextDay,

              date: "",

              currentMonth:
                false,

              usedAmount:
                0,

              incomeAmount:
                0,

              savingDifference:
                0,

              recommendedAmount:
                0,

              difference:
                0,

              status:
                "none",
            },
          );

          nextDay +=
            1;
        }

        return result;
      },
      [
        currentRecommendedAmount,
        budgetRange.end,
        budgetRange.start,
        incomeByDate,
        month,
        savingDifferenceByDate,
        snapshotMap,
        todayString,
        usedByDate,
        year,
      ],
    );

  /*
   * 선택 날짜 소비
   */
  const selectedExpenses =
    useMemo(
      () =>
        expenses.filter(
          (
            expense,
          ) =>
            expense.expense_date ===
            selectedDate,
        ),
      [
        expenses,
        selectedDate,
      ],
    );

  const selectedIncomes =
    useMemo(
      () =>
        incomes.filter(
          (income) =>
            income.income_date === selectedDate,
        ),
      [incomes, selectedDate],
    );

  /*
   * 선택 날짜 저금 기록
   */
  const selectedSavings =
    useMemo(
      () =>
        savings.filter(
          (
            saving,
          ) =>
            saving.saving_date ===
            selectedDate,
        ),
      [
        savings,
        selectedDate,
      ],
    );

  const selectedUsedAmount =
    usedByDate.get(
      selectedDate,
    ) ??
    0;

  const selectedIncomeAmount =
    incomeByDate.get(selectedDate) ?? 0;

  const selectedSavingDifference =
    savingDifferenceByDate.get(
      selectedDate,
    ) ??
    0;

  const selectedSnapshot =
    snapshotMap.get(
      selectedDate,
    );

  const selectedRecommendedAmount =
    selectedSnapshot
      ?.recommended_amount ??
    (
      selectedDate >
      todayString
        ? currentRecommendedAmount
        : 0
    );

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
    const nextDate =
      new Date(
        year,
        month +
          amount,
        1,
      );

    setYear(
      nextDate.getFullYear(),
    );

    setMonth(
      nextDate.getMonth(),
    );

    setSelectedDate(
      formatDate(
        nextDate,
      ),
    );

    setDetailOpen(
      false,
    );

    setExpenseOpen(
      false,
    );
  };

  const changeView = (
    nextView: ViewType,
  ) => {
    if (
      nextView ===
        "partner" &&
      !partnerId
    ) {
      return;
    }

    setView(
      nextView,
    );

    setDetailOpen(
      false,
    );

    setExpenseOpen(
      false,
    );
  };

  const handleDayClick = (
    item: CalendarDayData,
  ) => {
    if (
      !item.currentMonth
    ) {
      return;
    }

    setSelectedDate(
      item.date,
    );
  };

  const openExpenseSheet =
    () => {
      if (
        !isMyCalendar
      ) {
        return;
      }

      if (
        !coupleId
      ) {
        setMessage(
          "커플 정보를 불러오는 중이에요.",
        );

        return;
      }

      setExpenseOpen(
        true,
      );
    };

  const handleExpenseSave =
    () => {
      setExpenseOpen(
        false,
      );

      setRefreshKey(
        (
          current,
        ) =>
          current +
          1,
      );
    };

  if (
    loading
  ) {
    return (
      <main className="calendar-loading">
        캘린더를 불러오고 있어요...
      </main>
    );
  }

  /*
   * 날짜 상세
   */
  if (
    detailOpen
  ) {
    return (
      <>
        <DayDetail
          date={
            selectedDate
          }
          expenses={
            selectedExpenses
          }
          incomes={
            selectedIncomes
          }
          savings={
            selectedSavings
          }
          usedAmount={
            selectedUsedAmount
          }
          incomeAmount={
            selectedIncomeAmount
          }
          savingDifference={
            selectedSavingDifference
          }
          recommendedAmount={
            selectedRecommendedAmount
          }
          difference={
            selectedDifference
          }
          nickname={
            selectedNickname
          }
          canAddExpense={
            isMyCalendar
          }
          onBack={() =>
            setDetailOpen(
              false,
            )
          }
          onAddExpense={
            openExpenseSheet
          }
        />

        {isMyCalendar && (
          <ExpenseSheet
            open={
              expenseOpen
            }
            onClose={() =>
              setExpenseOpen(
                false,
              )
            }
            coupleId={
              coupleId
            }
            partnerId={
              partnerId
            }
            initialDate={
              selectedDate
            }
            onSave={
              handleExpenseSave
            }
          />
        )}
      </>
    );
  }

  return (
    <main className="calendar-page">
      <header className="calendar-header">
        <span className="calendar-header-spacer" aria-hidden="true" />

        <div className="calendar-title">
          <strong>
            캘린더
          </strong>

          <span>
            {year}년{" "}
            {month + 1}월
          </span>
        </div>

        <div className="calendar-month-buttons">
          <button
            type="button"
            onClick={() =>
              changeMonth(
                -1,
              )
            }
            aria-label="이전 달"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() =>
              changeMonth(
                1,
              )
            }
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </header>

      {/* 나 / 상대 */}

      <div className="calendar-person-tabs">
        <button
          type="button"
          className={
            view ===
            "me"
              ? "active"
              : ""
          }
          onClick={() =>
            changeView(
              "me",
            )
          }
        >
          {myNickname}
        </button>

        <button
          type="button"
          disabled={
            !partnerId
          }
          className={
            view ===
            "partner"
              ? "active"
              : ""
          }
          onClick={() =>
            changeView(
              "partner",
            )
          }
        >
          {
            partnerNickname
          }
        </button>
      </div>

      {view ===
        "partner" && (
        <div className="partner-readonly-message">
          <span>
            👀
          </span>

          <p>
            {
              partnerNickname
            }
            님의 수익·소비와 저금 기록을
            보고 있어요.

            <strong>
              상대 기록은 조회만
              가능해요.
            </strong>
          </p>
        </div>
      )}

      {message && (
        <p className="calendar-message">
          {message}
        </p>
      )}

      {/* 초롱이 */}

      <section className="calendar-hero">
        <div>
          <h2>
            {
              selectedNickname
            }
            님의{" "}
            {budgetPeriodLabel}
            소비 계획 🐶
          </h2>

          <p>
            소비와 저금을 반영한
            남은 금액을 기준으로
            <br />
            하루 권장 한도를
            계산해요.
          </p>
        </div>

        <Image
          src="/chorong-mint-collar-no-charm-v2.png"
          alt="초롱이"
          width={145}
          height={145}
          priority
        />
      </section>

      {/* 권장 한도 */}

      <section className="daily-recommendation-card">
        <div>
          <span>
            현재 사용 가능 금액
          </span>

          <strong>
            {remainingAmount.toLocaleString(
              "ko-KR",
            )}

            <small>
              원
            </small>
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

            <small>
              원
            </small>
          </strong>
        </div>

        <p>
          저금한 금액은 소비로
          계산하지 않고 사용 가능한
          예산에서만 빠져요.
        </p>
      </section>

      {/* 월 요약 */}

      <section className="monthly-summary">
        <SummaryItem
          label="예산 기간 수익"
          value={`${monthlyBudget.toLocaleString(
            "ko-KR",
          )}원`}
          active
        />

        <SummaryItem
          label="예산 기간 소비"
          value={`${monthlyUsed.toLocaleString(
            "ko-KR",
          )}원`}
          coral
        />

        <SummaryItem
          label="현재 저금액"
          value={`${currentSavingBalance.toLocaleString(
            "ko-KR",
          )}원`}
          saving
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

      {/* 달력 */}

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
          ].map(
            (
              day,
              index,
            ) => (
              <span
                key={
                  day
                }
                className={
                  index ===
                  0
                    ? "sunday"
                    : index ===
                        6
                      ? "saturday"
                      : ""
                }
              >
                {day}
              </span>
            ),
          )}
        </div>

        <div className="calendar-grid">
          {calendarDays.map(
            (
              item,
              index,
            ) => {
              const selected =
                item.currentMonth &&
                item.date ===
                  selectedDate;

              const weekday =
                index %
                7;

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

                    weekday ===
                    0
                      ? "sunday"
                      : "",

                    weekday ===
                    6
                      ? "saturday"
                      : "",

                    item.status,
                  ].join(
                    " ",
                  )}
                  disabled={
                    !item.currentMonth
                  }
                  onClick={() =>
                    handleDayClick(
                      item,
                    )
                  }
                >
                  <span className="day-number">
                    {
                      item.day
                    }
                  </span>

                  {/* 수익 */}

                  {item.currentMonth &&
                    item.incomeAmount > 0 && (
                      <small className="day-income">
                        +{item.incomeAmount.toLocaleString("ko-KR")}
                      </small>
                    )}

                  {/* 소비 */}

                  {item.currentMonth &&
                    item.usedAmount >
                      0 && (
                      <small className="day-used">
                        -{item.usedAmount.toLocaleString(
                          "ko-KR",
                        )}
                      </small>
                    )}

                  {/* 저금통 차액 */}

                  {item.currentMonth &&
                    item.savingDifference !==
                      0 && (
                      <small
                        className={
                          item.savingDifference >
                          0
                            ? "day-saving deposit"
                            : "day-saving withdraw"
                        }
                      >
                        {item.savingDifference >
                        0
                          ? "🐷 +"
                          : "🔨 -"}

                        {Math.abs(
                          item.savingDifference,
                        ).toLocaleString(
                          "ko-KR",
                        )}
                      </small>
                    )}

                  {/* 권장 한도 */}

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

      {/* 선택 날짜 */}

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
            <span className="selected-income-amount">
              수익 +{selectedIncomeAmount.toLocaleString("ko-KR")}원
            </span>
            <span className="selected-used-amount">
              소비 -{selectedUsedAmount.toLocaleString("ko-KR")}원
            </span>
          </strong>
        </div>

        <div
          className={`selected-day-result ${
            selectedDifference <
            0
              ? "over"
              : "safe"
          }`}
        >
          <span>
            {selectedDifference <
            0
              ? "권장 한도보다"
              : "오늘 남은 소비 한도"}
          </span>

          <strong>
            {Math.abs(
              selectedDifference,
            ).toLocaleString(
              "ko-KR",
            )}
            원

            {selectedDifference <
            0
              ? " 초과"
              : ""}
          </strong>
        </div>

        {/* 저금 차액 */}

        {selectedSavingDifference !==
          0 && (
          <div
            className={
              selectedSavingDifference >
              0
                ? "selected-saving-change deposit"
                : "selected-saving-change withdraw"
            }
          >
            <span>
              {selectedSavingDifference >
              0
                ? "🐷 오늘 저금통에 넣은 금액"
                : "🔨 오늘 저금통에서 꺼낸 금액"}
            </span>

            <strong>
              {selectedSavingDifference >
              0
                ? "+"
                : "-"}

              {Math.abs(
                selectedSavingDifference,
              ).toLocaleString(
                "ko-KR",
              )}
              원
            </strong>
          </div>
        )}

        <ExpenseList
          expenses={
            selectedExpenses
          }
          canManage={
            isMyCalendar
          }
          onManage={(expense) =>
            router.push(
              `/spending?view=me&expense=${expense.id}&from=calendar`,
            )
          }
        />

        <IncomeList
          incomes={selectedIncomes}
        />

        <SavingList
          savings={
            selectedSavings
          }
        />

        <div
          className={
            isMyCalendar
              ? "calendar-card-actions"
              : "calendar-card-actions single"
          }
        >
          <button
            type="button"
            className="calendar-detail-button"
            onClick={() =>
              setDetailOpen(
                true,
              )
            }
          >
            날짜 상세 보기
          </button>

          {isMyCalendar && (
            <button
              type="button"
              className="calendar-add-button"
              onClick={
                openExpenseSheet
              }
            >
              ＋ 소비 기록하기
            </button>
          )}
        </div>
      </section>

      {isMyCalendar && (
        <ExpenseSheet
          open={
            expenseOpen
          }
          onClose={() =>
            setExpenseOpen(
              false,
            )
          }
          coupleId={
            coupleId
          }
          partnerId={
            partnerId
          }
          initialDate={
            selectedDate
          }
          onSave={
            handleExpenseSave
          }
        />
      )}

      {!expenseOpen && (
        <BottomNavigation
          active="calendar"
        />
      )}
    </main>
  );
}

/* =========================
   월 요약
========================= */

function SummaryItem({
  label,
  value,
  sub,
  active,
  coral,
  saving,
}: {
  label: string;
  value: string;
  sub?: string;

  active?: boolean;
  coral?: boolean;
  saving?: boolean;
}) {
  let valueClass =
    "";

  if (
    coral
  ) {
    valueClass =
      "coral";
  }

  if (
    saving
  ) {
    valueClass =
      "saving";
  }

  return (
    <div
      className={
        active
          ? "summary-item active"
          : "summary-item"
      }
    >
      <span>
        {label}
      </span>

      <strong
        className={
          valueClass
        }
      >
        {value}
      </strong>

      {sub && (
        <small>
          {sub}
        </small>
      )}
    </div>
  );
}

/* =========================
   수익 목록
========================= */

function IncomeList({
  incomes,
}: {
  incomes: IncomeRecord[];
}) {
  if (incomes.length === 0) {
    return null;
  }

  return (
    <div className="calendar-income-list">
      <div className="calendar-record-title">수익</div>

      {incomes.map((income) => (
        <article className="calendar-income-item" key={income.id}>
          <div className="income-icon">💰</div>

          <div className="income-info">
            <strong>{income.category}</strong>
            {income.memo && <span>{income.memo}</span>}
          </div>

          <strong className="income-price">
            +{Number(income.amount).toLocaleString("ko-KR")}원
          </strong>
        </article>
      ))}
    </div>
  );
}

function getBudgetCycleRange(
  year: number,
  month: number,
) {
  return {
    start: formatDate(
      new Date(year, month, BUDGET_START_DAY),
    ),
    end: formatDate(
      new Date(year, month + 1, BUDGET_START_DAY),
    ),
  };
}

function getCalendarBudgetDataRange(
  year: number,
  month: number,
) {
  return {
    start: formatDate(
      new Date(year, month - 1, BUDGET_START_DAY),
    ),
    end: formatDate(
      new Date(year, month + 1, BUDGET_START_DAY),
    ),
  };
}

function getCalendarDayCount(
  start: Date,
  end: Date,
) {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );

  return Math.round(
    (endUtc - startUtc) / 86_400_000,
  );
}

/* =========================
   소비 목록
========================= */

function ExpenseList({
  expenses,
  canManage = false,
  onManage,
}: {
  expenses: ExpenseRecord[];
  canManage?: boolean;
  onManage?: (
    expense: ExpenseRecord,
  ) => void;
}) {
  if (
    expenses.length ===
    0
  ) {
    return (
      <p className="empty-expense">
        이 날짜에는 소비 기록이
        없어요.
      </p>
    );
  }

  return (
    <div className="calendar-expense-list">
      {expenses.map(
        (
          item,
        ) => {
          const info =
            categoryInfo[
              item.category
            ] ??
            categoryInfo.기타;

          return (
            <article
              className="calendar-expense-item"
              key={
                item.id
              }
            >
              <div
                className="expense-icon"
                style={{
                  background: `${info.color}1e`,
                }}
              >
                {
                  info.icon
                }
              </div>

              <div className="expense-info">
                <small>
                  {
                    item.category
                  }
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
                  <span>
                    정산전
                  </span>
                )}

                {item.settlement_status ===
                  "정산완료" && (
                  <span className="complete">
                    정산완료
                  </span>
                )}

                {canManage && onManage && (
                  <button
                    type="button"
                    className="calendar-expense-manage"
                    onClick={() => onManage(item)}
                  >
                    수정/삭제
                  </button>
                )}
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

/* =========================
   저금 목록
========================= */

function SavingList({
  savings,
}: {
  savings: SavingRecord[];
}) {
  if (
    savings.length ===
    0
  ) {
    return null;
  }

  return (
    <div className="calendar-saving-list">
      <div className="calendar-saving-title">
        저금 기록
      </div>

      {savings.map(
        (
          item,
        ) => {
          const isDeposit =
            item.type ===
            "deposit";

          return (
            <article
              className="calendar-saving-item"
              key={
                item.id
              }
            >
              <div
                className={
                  isDeposit
                    ? "saving-calendar-icon deposit"
                    : "saving-calendar-icon withdraw"
                }
              >
                {isDeposit
                  ? "🐷"
                  : "🔨"}
              </div>

              <div className="saving-calendar-info">
                <strong>
                  {isDeposit
                    ? "저금하기"
                    : "저금통 꺼내기"}
                </strong>

                {item.memo && (
                  <span>
                    {
                      item.memo
                    }
                  </span>
                )}
              </div>

              <strong
                className={
                  isDeposit
                    ? "saving-calendar-price deposit"
                    : "saving-calendar-price withdraw"
                }
              >
                {isDeposit
                  ? "+"
                  : "-"}

                {Number(
                  item.amount,
                ).toLocaleString(
                  "ko-KR",
                )}
                원
              </strong>
            </article>
          );
        },
      )}
    </div>
  );
}

/* =========================
   날짜 상세
========================= */

function DayDetail({
  date,
  expenses,
  incomes,
  savings,
  usedAmount,
  incomeAmount,
  savingDifference,
  recommendedAmount,
  difference,
  nickname,
  canAddExpense,
  onBack,
  onAddExpense,
}: {
  date: string;

  expenses: ExpenseRecord[];

  incomes: IncomeRecord[];

  savings: SavingRecord[];

  usedAmount: number;

  incomeAmount: number;

  savingDifference: number;

  recommendedAmount: number;

  difference: number;

  nickname: string;

  canAddExpense: boolean;

  onBack: () => void;

  onAddExpense: () => void;

}) {
  const dateObject =
    new Date(
      `${date}T00:00:00`,
    );

  const usageRate =
    recommendedAmount >
    0
      ? Math.round(
          (
            usedAmount /
            recommendedAmount
          ) *
            100,
        )
      : 0;

  const progressWidth =
    Math.min(
      Math.max(
        usageRate,
        0,
      ),
      100,
    );

  return (
    <main className="day-detail-page">
      <header className="day-detail-header">
        <button
          type="button"
          onClick={
            onBack
          }
          aria-label="뒤로 가기"
        >
          ←
        </button>

        <h1>
          {dateObject.getMonth() +
            1}
          월{" "}
          {dateObject.getDate()}
          일 (
          {getWeekdayLabel(
            date,
          )}
          )
        </h1>

        <span>
          🗓️
        </span>
      </header>

      {!canAddExpense && (
        <div className="day-detail-owner">
          {nickname}님의 수익 · 소비 ·
          저금 기록
        </div>
      )}

      <section className="day-budget-summary">
        <div>
          <span>
            오늘 권장 한도
          </span>

          <strong>
            {recommendedAmount.toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <div>
          <span>
            사용 금액
          </span>

          <strong className="used">
            {usedAmount.toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <div>
          <span>
            {difference <
            0
              ? "초과 금액"
              : "남은 소비 한도"}
          </span>

          <strong
            className={
              difference <
              0
                ? "over"
                : "remaining"
            }
          >
            {Math.abs(
              difference,
            ).toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </div>

        <div className="day-progress">
          <span
            style={{
              width: `${progressWidth}%`,
            }}
            className={
              usageRate >
              100
                ? "over"
                : usageRate >=
                    80
                  ? "warning"
                  : ""
            }
          />
        </div>

        <p>
          권장 한도의{" "}
          {usageRate}%를
          사용했어요.
        </p>
      </section>

      {incomeAmount > 0 && (
        <section className="day-income-net">
          <span>💰 오늘 수익</span>
          <strong>
            +{incomeAmount.toLocaleString("ko-KR")}원
          </strong>
        </section>
      )}

      {/* 해당 날짜 저금 차액 */}

      {savingDifference !==
        0 && (
        <section
          className={
            savingDifference >
            0
              ? "day-saving-net deposit"
              : "day-saving-net withdraw"
          }
        >
          <span>
            {savingDifference >
            0
              ? "🐷 오늘 저금"
              : "🔨 오늘 꺼냄"}
          </span>

          <strong>
            {savingDifference >
            0
              ? "+"
              : "-"}

            {Math.abs(
              savingDifference,
            ).toLocaleString(
              "ko-KR",
            )}
            원
          </strong>
        </section>
      )}

      {/* 소비 상세 */}

      <IncomeList incomes={incomes} />

      <section className="day-category-list">
        {expenses.length ===
        0 ? (
          <div className="day-detail-empty">
            <span>
              💸
            </span>

            <strong>
              소비 기록이 없어요
            </strong>
          </div>
        ) : (
          expenses.map(
            (
              item,
            ) => {
              const info =
                categoryInfo[
                  item.category
                ] ??
                categoryInfo.기타;

              return (
                <article
                  className="day-detail-item"
                  key={
                    item.id
                  }
                >
                  <div
                    className="expense-icon large"
                    style={{
                      background: `${info.color}1e`,
                    }}
                  >
                    {
                      info.icon
                    }
                  </div>

                  <div className="day-detail-info">
                    <strong>
                      {item.title ||
                        item.category}
                    </strong>

                    <span>
                      {
                        item.category
                      }{" "}
                      ·{" "}
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
                      <p>
                        {
                          item.memo
                        }
                      </p>
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
                      <span>
                        정산전
                      </span>
                    )}

                  </div>
                </article>
              );
            },
          )
        )}
      </section>

      {/* 저금 상세 */}

      {savings.length >
        0 && (
        <section className="day-detail-saving-section">
          <h2>
            저금 기록
          </h2>

          <SavingList
            savings={
              savings
            }
          />
        </section>
      )}

      <div className="day-detail-actions">
        {canAddExpense && (
          <button
            type="button"
            className="primary"
            onClick={
              onAddExpense
            }
          >
            ＋ 소비 기록하기
          </button>
        )}

        <button
          type="button"
          className="secondary"
          onClick={
            onBack
          }
        >
          캘린더로 돌아가기
        </button>
      </div>
    </main>
  );
}
