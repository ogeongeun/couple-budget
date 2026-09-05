"use client";

import Image from "next/image";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import ExpenseSheet from "@/components/ExpenseSheet";
import IncomeSheet from "@/components/IncomeSheet";
import SavingSheet from "@/components/SavingSheet";
import BottomNavigation from "@/components/BottomNavigation";
import { subscribeToPushNotifications } from "@/lib/push/client";
import { createClient } from "@/lib/supabase/client";
import { buildConsumptionExpenses } from "@/lib/expenseConsumption";

import "./home.css";

const supabase = createClient();

type ProfileData = {
  id: string;
  nickname: string | null;
  couple_id: string | null;
};

type CoupleData = {
  id: string;
  name: string;
};

type AmountData = {
  amount: number;
};

type ExpenseData = {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  use_type: string;
  payment_type: string | null;
  payer_id: string | null;
  my_share: number;
  partner_share: number;
  settled_amount: number;
  settlement_status: string;
  source_type: string | null;
};

type ChartCategory = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
};

type NotificationData = {
  id: string;
  recipient_id: string;
  actor_id: string;
  title: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

type SavingRecord = {
  id: string;
  user_id: string;
  type: "deposit" | "withdraw";
  amount: number;
  memo: string | null;
  saving_date: string;
  created_at: string;
};

type EquippedReward = {
  category: "hat" | "collar" | "bowl" | "piggy_bank";
  reward_items: { sprite_index: number } | { sprite_index: number }[] | null;
};

function RewardSprite({ index, className }: { index: number; className: string }) {
  return (
    <span
      className={`home-reward-sprite ${className}`}
      style={{
        backgroundPosition: `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * 50}%`,
      }}
      aria-hidden="true"
    />
  );
}

const collarAccessoryImages: Record<number, string> = {
  4: "/reward-accessories/mint-tag-v1.png",
  5: "/reward-accessories/red-bow-charm-v2.png",
  6: "/reward-accessories/blue-heart-v1.png",
  7: "/reward-accessories/star-pendant-v1.png",
};

const chartCategoryInfo = [
  {
    name: "식비",
    color: "#64c28a",
  },
  {
    name: "카페",
    color: "#d69a5c",
  },
  {
    name: "교통",
    color: "#48a3df",
  },
  {
    name: "쇼핑",
    color: "#956bcd",
  },
  {
    name: "문화",
    color: "#ffb23f",
  },
  {
    name: "생활비",
    color: "#ef8a8a",
  },
  {
    name: "의료",
    color: "#58b5ad",
  },
  {
  name: "미용",
  color: "#f39ab5",
},
  {
    name: "기타",
    color: "#bdbdbd",
  },
];

const knownCategories = chartCategoryInfo
  .filter(
    (category) =>
      category.name !== "기타",
  )
  .map((category) => category.name);

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

function getBudgetRange() {
  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth() - (now.getDate() < 5 ? 1 : 0),
    5,
  );
  const endDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    5,
  );

  return {
    label: `${startDate.getMonth() + 1}월 5일~${endDate.getMonth() + 1}월 4일`,
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
}

function getHomeStatsRange() {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth() - (now.getDate() < 5 ? 1 : 0),
    5,
  );
  return {
    start: formatDate(start),
    end: formatDate(new Date(start.getFullYear(), start.getMonth() + 1, 5)),
  };
}

function sumAmounts(
  data: AmountData[] | null,
) {
  return (
    data?.reduce(
      (total, item) =>
        total +
        Number(item.amount || 0),
      0,
    ) ?? 0
  );
}

function createChartCategories(
  expenses: ExpenseData[],
): ChartCategory[] {
  const total = expenses.reduce(
    (sum, expense) =>
      sum +
      Number(expense.amount || 0),
    0,
  );

  if (total <= 0) {
    return [];
  }

  return chartCategoryInfo
    .map((category) => {
      const amount = expenses
        .filter((expense) => {
          if (
            category.name === "기타"
          ) {
            return (
              expense.category ===
                "기타" ||
              !knownCategories.includes(
                expense.category,
              )
            );
          }

          return (
            expense.category ===
            category.name
          );
        })
        .reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0,
            ),
          0,
        );

      return {
        name: category.name,
        color: category.color,
        amount,
        percentage:
          amount > 0
            ? Math.round(
                (amount / total) * 100,
              )
            : 0,
      };
    })
    .filter(
      (category) =>
        category.amount > 0,
    );
}

export default function HomePage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] =
    useState(true);

  const [dataLoading, setDataLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [expenseOpen, setExpenseOpen] =
    useState(false);

  const [incomeOpen, setIncomeOpen] =
    useState(false);

  const [
    savingSheetOpen,
    setSavingSheetOpen,
  ] = useState(false);

  const [
    savingMenuOpen,
    setSavingMenuOpen,
  ] = useState(false);

  const [
    savingMode,
    setSavingMode,
  ] = useState<
    "deposit" | "withdraw"
  >("deposit");

  const [userId, setUserId] =
    useState<string | null>(null);

  const [partnerId, setPartnerId] =
    useState<string | null>(null);

  const [coupleId, setCoupleId] =
    useState<string | null>(null);

  const [equippedRewards, setEquippedRewards] =
    useState<Record<string, number>>({});

  const [coupleName, setCoupleName] =
    useState("우리의 가계부");

  const [nickname, setNickname] =
    useState("사용자");

  const [
    partnerNickname,
    setPartnerNickname,
  ] = useState("상대");

  const [budget, setBudget] =
    useState(0);

  const [savings, setSavings] =
    useState<SavingRecord[]>([]);

  const [used, setUsed] =
    useState(0);

  const [balanceAdjustment, setBalanceAdjustment] =
    useState(0);

  const [myStatsUsed, setMyStatsUsed] =
    useState(0);

  const [partnerUsed, setPartnerUsed] =
    useState(0);

  const [
    myChartCategories,
    setMyChartCategories,
  ] = useState<ChartCategory[]>([]);

  const [
    partnerChartCategories,
    setPartnerChartCategories,
  ] = useState<ChartCategory[]>([]);

  const [
    receivableAmount,
    setReceivableAmount,
  ] = useState(0);

  const [
    payableAmount,
    setPayableAmount,
  ] = useState(0);

  const [
    pendingSettlementCount,
    setPendingSettlementCount,
  ] = useState(0);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    notificationPermission,
    setNotificationPermission,
  ] =
    useState<NotificationPermission>(
      "default",
    );

  const budgetRange = getBudgetRange();
  const homeStatsRange = getHomeStatsRange();

  /*
   * 현재 브라우저 알림 권한 확인
   */
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      return;
    }

    setNotificationPermission(
      Notification.permission,
    );
  }, []);

  /*
   * 로그인 사용자, 커플, 상대방 정보 조회
   */
  useEffect(() => {
    let mounted = true;

    const loadUserData = async () => {
      setAuthLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

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

      if (!mounted) {
        return;
      }

      if (profileError) {
        console.error(
          "프로필 조회 오류:",
          profileError,
        );

        setMessage(
          "프로필 정보를 불러오지 못했어요.",
        );

        setAuthLoading(false);
        return;
      }

      const profile =
        profileResult as
          | ProfileData
          | null;

      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      setUserId(user.id);

      setNickname(
        profile.nickname ?? "사용자",
      );

      if (!profile.couple_id) {
        router.replace(
          "/couple/connect",
        );

        return;
      }

      setCoupleId(profile.couple_id);

      const [
        coupleResult,
        partnerResult,
      ] = await Promise.all([
        supabase
          .from("couples")
          .select("id, name")
          .eq(
            "id",
            profile.couple_id,
          )
          .maybeSingle(),

        supabase
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
          .maybeSingle(),
      ]);

      if (!mounted) {
        return;
      }

      if (coupleResult.error) {
        console.error(
          "가계부 조회 오류:",
          coupleResult.error,
        );
      }

      if (partnerResult.error) {
        console.error(
          "상대방 조회 오류:",
          partnerResult.error,
        );
      }

      const couple =
        coupleResult.data as
          | CoupleData
          | null;

      const partner =
        partnerResult.data as
          | ProfileData
          | null;

      if (couple?.name) {
        setCoupleName(couple.name);
      }

      if (partner) {
        setPartnerId(partner.id);

        setPartnerNickname(
          partner.nickname ?? "상대",
        );
      } else {
        setPartnerId(null);
        setPartnerNickname("상대");
      }

      setAuthLoading(false);
    };

    void loadUserData();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!coupleId) {
      setEquippedRewards({});
      return;
    }

    let mounted = true;
    const loadEquippedRewards = async () => {
      const { data, error } = await supabase
        .from("equipped_reward_items")
        .select("category, reward_items(sprite_index)")
        .eq("couple_id", coupleId);

      if (!mounted || error) return;
      const next: Record<string, number> = {};
      ((data as EquippedReward[] | null) ?? []).forEach((row) => {
        const item = Array.isArray(row.reward_items)
          ? row.reward_items[0]
          : row.reward_items;
        if (item) next[row.category] = item.sprite_index;
      });
      setEquippedRewards(next);
    };

    void loadEquippedRewards();
    return () => { mounted = false; };
  }, [coupleId]);

  /*
   * 실제 안 읽은 알림 개수 조회
   * 새 알림이 생기면 브라우저 알림 표시
   */
  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    let mounted = true;

    const loadUnreadCount =
      async () => {
        const {
          count,
          error,
        } = await supabase
          .from("notifications")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "recipient_id",
            userId,
          )
          .eq("is_read", false);

        if (!mounted) {
          return;
        }

        if (error) {
          console.error(
            "안 읽은 알림 조회 오류:",
            error,
          );

          setUnreadCount(0);
          return;
        }

        setUnreadCount(count ?? 0);
      };

    void loadUnreadCount();

    const channel = supabase
      .channel(
        `home-notifications-${userId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          void loadUnreadCount();

          const notification =
            payload.new as NotificationData;

          if (
            typeof window !==
              "undefined" &&
            "Notification" in window &&
            Notification.permission ===
              "granted"
          ) {
            try {
              new Notification(
                notification.title ||
                  "새로운 알림",
                {
                  body:
                    notification.message ||
                    "새로운 소비 기록이 등록됐어요.",

                  icon:
                    "/chorong-mint-collar-no-charm-v2.png",
                },
              );
            } catch (error) {
              console.error(
                "브라우저 알림 표시 오류:",
                error,
              );
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount();
        },
      )
      .subscribe((status) => {
        console.log(
          "알림 실시간 연결 상태:",
          status,
        );
      });

    return () => {
      mounted = false;

      void supabase.removeChannel(
        channel,
      );
    };
  }, [userId]);

  /*
   * 이번 달 소득, 소비, 저금, 그래프, 정산 조회
   */
  useEffect(() => {
    let mounted = true;

    const loadMonthlyData = async () => {
      if (!userId || !coupleId) {
        return;
      }

      setDataLoading(true);

      const incomeQuery = supabase
        .from("incomes")
        .select("amount")
        .eq("couple_id", coupleId)
        .eq("user_id", userId)
        .gte(
          "income_date",
          budgetRange.start,
        )
        .lt(
          "income_date",
          budgetRange.end,
        );

      const expenseQuery = supabase
        .from("expenses")
        .select(`
          id,
          user_id,
          amount,
          category,
          use_type,
          payment_type,
          payer_id,
          my_share,
          partner_share,
          settled_amount,
          settlement_status,
          source_type
        `)
        .eq("couple_id", coupleId)
        .gte(
          "expense_date",
          budgetRange.start,
        )
        .lt(
          "expense_date",
          budgetRange.end,
        );

      const savingsQuery = supabase
        .from("savings")
        .select(`
          id,
          user_id,
          type,
          amount,
          memo,
          saving_date,
          created_at
        `)
        .eq("couple_id", coupleId)
        .eq("user_id", userId)
        .order("saving_date", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

      const previousIncomeQuery = supabase
        .from("incomes")
        .select("amount")
        .eq("couple_id", coupleId)
        .eq("user_id", userId)
        .lt("income_date", budgetRange.start);

      const previousExpenseQuery = supabase
        .from("expenses")
        .select("amount")
        .eq("couple_id", coupleId)
        .eq("user_id", userId)
        .lt("expense_date", budgetRange.start);

      const pendingSettlementQuery = supabase
        .from("expenses")
        .select(`
          id,
          user_id,
          amount,
          category,
          use_type,
          payment_type,
          payer_id,
          my_share,
          partner_share,
          settled_amount,
          settlement_status
        `)
        .eq("couple_id", coupleId)
        .eq("use_type", "함께")
        .eq("payment_type", "나눠내기")
        .neq("settlement_status", "정산완료");

      const statsExpenseQuery = supabase
        .from("expenses")
        .select(`
          id, user_id, amount, category, use_type, payment_type,
          payer_id, my_share, partner_share, settled_amount,
          settlement_status, source_type
        `)
        .eq("couple_id", coupleId)
        .gte("expense_date", homeStatsRange.start)
        .lt("expense_date", homeStatsRange.end);

      const [
        incomeResult,
        expenseResult,
        savingsResult,
        previousIncomeResult,
        previousExpenseResult,
        pendingSettlementResult,
        statsExpenseResult,
      ] = await Promise.all([
        incomeQuery,
        expenseQuery,
        savingsQuery,
        previousIncomeQuery,
        previousExpenseQuery,
        pendingSettlementQuery,
        statsExpenseQuery,
      ]);

      if (!mounted) {
        return;
      }

      const loadedSavings =
        (savingsResult.data as
          | SavingRecord[]
          | null) ?? [];

      if (
        incomeResult.error ||
        previousIncomeResult.error ||
        previousExpenseResult.error ||
        savingsResult.error
      ) {
        console.error(
          "예산 및 이월 금액 조회 오류:",
          incomeResult.error ??
            previousIncomeResult.error ??
            previousExpenseResult.error ??
            savingsResult.error,
        );

        setBudget(0);
      } else {
        const previousNetSaving = loadedSavings
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

        const carryover =
          sumAmounts(previousIncomeResult.data as AmountData[] | null) -
          sumAmounts(previousExpenseResult.data as AmountData[] | null) -
          previousNetSaving;

        setBudget(
          carryover +
          sumAmounts(
            incomeResult.data as
              | AmountData[]
              | null,
          ),
        );
      }

      if (savingsResult.error) {
        console.error(
          "저금 조회 오류:",
          savingsResult.error,
        );

        setSavings([]);
      } else {
        setSavings(loadedSavings);
      }

      if (expenseResult.error) {
        console.error(
          "소비 조회 오류:",
          expenseResult.error,
        );

        setUsed(0);
        setBalanceAdjustment(0);
        setPartnerUsed(0);

        setMyChartCategories([]);
        setPartnerChartCategories([]);

        setReceivableAmount(0);
        setPayableAmount(0);
        setPendingSettlementCount(0);

        setDataLoading(false);
        return;
      }

      const allExpenses =
        (expenseResult.data as
          | ExpenseData[]
          | null) ?? [];

      const myExpenses =
        allExpenses.filter(
          (expense) =>
            expense.user_id === userId &&
            expense.source_type !== "balance_adjustment",
        );

      const myBalanceAdjustment = allExpenses
        .filter(
          (expense) =>
            expense.user_id === userId &&
            expense.source_type === "balance_adjustment",
        )
        .reduce(
          (sum, expense) => sum + Number(expense.amount || 0),
          0,
        );

      const partnerExpenses =
        partnerId
          ? allExpenses.filter(
              (expense) =>
                expense.user_id ===
                partnerId,
            )
          : [];

      const statsExpenses = buildConsumptionExpenses(
        (statsExpenseResult.data as ExpenseData[] | null) ?? [],
        [userId, partnerId ?? ""],
      );
      const myStatsExpenses = statsExpenses.filter(
        (expense) => expense.user_id === userId,
      );
      const partnerStatsExpenses = partnerId
        ? statsExpenses.filter((expense) => expense.user_id === partnerId)
        : [];

      const myUsedAmount =
        myExpenses.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0,
            ),
          0,
        );

      const partnerUsedAmount =
        partnerExpenses.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0,
            ),
          0,
        );

      setUsed(myUsedAmount);
      setBalanceAdjustment(myBalanceAdjustment);

      setPartnerUsed(
        sumAmounts(partnerStatsExpenses),
      );

      setMyStatsUsed(sumAmounts(myStatsExpenses));

      setMyChartCategories(
        createChartCategories(
          myStatsExpenses,
        ),
      );

      setPartnerChartCategories(
        createChartCategories(
          partnerStatsExpenses,
        ),
      );

      if (pendingSettlementResult.error) {
        console.error(
          "미정산 조회 오류:",
          pendingSettlementResult.error,
        );
      }

      const pendingSettlements =
        (pendingSettlementResult.data as
          | ExpenseData[]
          | null) ?? [];

      let nextReceivableAmount = 0;
      let nextPayableAmount = 0;
      let nextPendingSettlementCount = 0;

      pendingSettlements.forEach(
        (expense) => {
          const receiverId = expense.payer_id;

          if (!receiverId || !partnerId) {
            return;
          }

          const payerIsCreator =
            receiverId === expense.user_id;

          const debtorId = payerIsCreator
            ? expense.user_id === userId
              ? partnerId
              : userId
            : expense.user_id;

          const settlementAmount = payerIsCreator
            ? Number(expense.partner_share || 0)
            : Number(expense.my_share || 0);

          const settledAmount = Number(
            expense.settled_amount || 0,
          );

          const remainingAmount = Math.max(
            0,
            settlementAmount - settledAmount,
          );

          if (remainingAmount <= 0) {
            return;
          }

          nextPendingSettlementCount += 1;

          if (
            receiverId === userId
          ) {
            nextReceivableAmount +=
              remainingAmount;

            return;
          }

          if (
            debtorId === userId
          ) {
            nextPayableAmount +=
              remainingAmount;
          }
        },
      );

      setReceivableAmount(
        nextReceivableAmount,
      );

      setPayableAmount(
        nextPayableAmount,
      );

      setPendingSettlementCount(
        nextPendingSettlementCount,
      );

      setDataLoading(false);
    };

    void loadMonthlyData();

    return () => {
      mounted = false;
    };
  }, [
    userId,
    coupleId,
    partnerId,
    refreshKey,
    budgetRange.start,
    budgetRange.end,
    homeStatsRange.end,
    homeStatsRange.start,
  ]);

  const handleIncomeSave = () => {
    setRefreshKey(
      (current) => current + 1,
    );
  };

  const handleExpenseSave = () => {
    setExpenseOpen(false);

    setRefreshKey(
      (current) => current + 1,
    );
  };

  const handleSavingSave = () => {
    setSavingSheetOpen(false);

    setRefreshKey(
      (current) => current + 1,
    );
  };

  /*
   * 알림 버튼을 눌렀을 때 권한 요청
   */
  const openNotificationPage =
    async () => {
      if (
        typeof window !==
          "undefined" &&
        "Notification" in window &&
        notificationPermission !==
          "denied"
      ) {
        try {
          const permission = await subscribeToPushNotifications();

          setNotificationPermission(
            permission,
          );
        } catch (error) {
          console.error(
            "알림 권한 요청 오류:",
            error,
          );
        }
      }

      router.push("/notifications");
    };

  const totalSaved = savings
    .filter(
      (saving) =>
        saving.type === "deposit",
    )
    .reduce(
      (sum, saving) =>
        sum +
        Number(
          saving.amount || 0,
        ),
      0,
    );

  const totalWithdrawn = savings
    .filter(
      (saving) =>
        saving.type === "withdraw",
    )
    .reduce(
      (sum, saving) =>
        sum +
        Number(
          saving.amount || 0,
        ),
      0,
    );

  const savingBalance =
    totalSaved - totalWithdrawn;

  const netSavingThisMonth =
    savings
      .filter(
        (saving) =>
          saving.saving_date >=
            budgetRange.start &&
          saving.saving_date <
            budgetRange.end,
      )
      .reduce(
        (sum, saving) =>
          saving.type === "deposit"
            ? sum +
              Number(
                saving.amount || 0,
              )
            : sum -
              Number(
                saving.amount || 0,
              ),
        0,
      );

  const remaining =
    budget -
    used -
    netSavingThisMonth -
    balanceAdjustment;

  /*
   * 저금은 소비가 아니기 때문에
   * 예산 사용률에는 소비만 반영해요.
   */
  const usageRate =
    budget > 0
      ? Math.round(
          (used / budget) * 100,
        )
      : 0;

  const progressWidth = Math.min(
    Math.max(usageRate, 0),
    100,
  );

  const finalSettlementAmount =
    receivableAmount - payableAmount;

  const absoluteSettlementAmount =
    Math.abs(finalSettlementAmount);

  const settlementDirection =
    finalSettlementAmount > 0
      ? "받을 예정"
      : finalSettlementAmount < 0
        ? "보낼 예정"
        : "정산할 금액 없음";

  const openSettlementPage = () => {
    router.push("/settlement");
  };

  if (authLoading) {
    return (
      <main className="auth-loading">
        로그인 정보를 확인하고 있어요...
      </main>
    );
  }

  return (
    <main className="home">
      <header className="header">
        <div>
          <h1>
            {coupleName} ·{" "}
            {budgetRange.label}{" "}
            <span>❤️</span>
          </h1>

          <p>
            {nickname}님, 함께 아끼고
            행복해요 🐾
          </p>
        </div>

        <button
          type="button"
          className="home-notification-button"
          aria-label={`알림 보기${
            unreadCount > 0
              ? `, 안 읽은 알림 ${unreadCount}개`
              : ""
          }`}
          onClick={() => {
            void openNotificationPage();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18 8.5C18 5.46 15.54 3 12.5 3C9.46 3 7 5.46 7 8.5V11.2C7 12.68 6.46 14.11 5.48 15.22L4.5 16.33C4.03 16.86 4.41 17.7 5.12 17.7H19.88C20.59 17.7 20.97 16.86 20.5 16.33L19.52 15.22C18.54 14.11 18 12.68 18 11.2V8.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d="M10.2 20C10.62 20.62 11.41 21 12.5 21C13.59 21 14.38 20.62 14.8 20"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>

          {unreadCount > 0 && (
            <span className="home-notification-count">
              {unreadCount > 99
                ? "99+"
                : unreadCount}
            </span>
          )}
        </button>
      </header>

      {message && (
        <p className="home-message">
          {message}
        </p>
      )}

      <section className="budget-card">
        <div className="budget-header">
          <div className="budget-title">
            <span className="budget-icon">
              🗓️
            </span>

            내 예산 기간 잔액
          </div>

          <button
            type="button"
            className="budget-setting-button"
            onClick={() =>
              router.push("/income")
            }
          >
            수정하기 ›
          </button>
        </div>

        <div
          className={`budget-amount ${
            remaining < 0
              ? "negative"
              : ""
          }`}
        >
          {dataLoading
            ? "..."
            : remaining.toLocaleString(
                "ko-KR",
              )}

          <span>원</span>
        </div>

        <div className="progress-area">
          <div className="progress-bar">
            <div
              className="progress-value"
              style={{
                width: `${progressWidth}%`,
              }}
            />
          </div>

          <strong>{usageRate}%</strong>
        </div>

        <div className="budget-information">
          <div>
            <span>이월 포함 예산</span>

            <strong>
              {budget.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>
          </div>

          <div>
            <span>사용 금액</span>

            <strong className="used-amount">
              {used.toLocaleString(
                "ko-KR",
              )}
              원
            </strong>
          </div>

          <div>
            <span>예산 사용률</span>

            <strong className="rate">
              {usageRate}%
            </strong>
          </div>

        </div>
      </section>

      <section className="dog-card">
        <button type="button" className="reward-box-button" onClick={() => router.push("/rewards")}>
          <span>🎁</span><strong>초롱이 보물상자</strong><small>중복 없는 뽑기</small>
        </button>
        <button
          type="button"
          className="piggy-bank-button"
          aria-label="저금통 열기"
          aria-expanded={savingMenuOpen}
          onClick={() =>
            setSavingMenuOpen(
              (current) => !current,
            )
          }
        >
          <Image className="piggy-bank-image" src="/chorong-piggy-bank-v2.png" alt="" width={1254} height={1254} aria-hidden="true" unoptimized />

          {savingBalance > 0 && (
            <i aria-hidden="true" />
          )}
        </button>

        {savingMenuOpen && (
          <div className="piggy-bank-menu">
            <div className="piggy-bank-menu-top">
              <span>내 저금통</span>

              <strong>
                {dataLoading
                  ? "..."
                  : savingBalance.toLocaleString(
                      "ko-KR",
                    )}
                {!dataLoading && "원"}
              </strong>
            </div>

            <div className="piggy-bank-menu-actions">
              <button
                type="button"
                onClick={() => {
                  setSavingMode("deposit");
                  setSavingMenuOpen(false);
                  setSavingSheetOpen(true);
                }}
              >
                ＋ 저금
              </button>

              <button
                type="button"
                disabled={
                  savingBalance <= 0
                }
                onClick={() => {
                  setSavingMode("withdraw");
                  setSavingMenuOpen(false);
                  setSavingSheetOpen(true);
                }}
              >
                🔨 깨기
              </button>
            </div>
          </div>
        )}

        <div className="speech-bubble">
          오늘도
          <br />
          수고했어!
        </div>

        <button
          type="button"
          className="dog-button"
          onClick={() => {
            setSavingMenuOpen(false);
            setExpenseOpen(true);
          }}
          aria-label="소비 기록하기"
        >
          <Image
            className="chorong-original"
            src="/chorong-mint-collar-no-charm-v2.png"
            alt="초롱이"
            width={1254}
            height={1254}
            priority
            unoptimized
          />
          {equippedRewards.hat !== undefined && <span className={`wearable-overlay wearable-hairpin hairpin-${equippedRewards.hat}`} aria-hidden="true" />}
          {equippedRewards.collar !== undefined && collarAccessoryImages[equippedRewards.collar] && (
            <>
              <span className="collar-gold-hook" aria-hidden="true" />
              <img
                className={`collar-accessory collar-accessory-${equippedRewards.collar}`}
                src={collarAccessoryImages[equippedRewards.collar]}
                alt=""
                aria-hidden="true"
              />
            </>
          )}
        </button>

        <button
          type="button"
          className="expense-button"
          onClick={() => {
            setSavingMenuOpen(false);
            setExpenseOpen(true);
          }}
        >
          <span className="plus">
            ＋
          </span>

          <strong>
            소비 기록하기
          </strong>

          <small>
            강아지를 눌러서
            <br />
            기록해보세요!
          </small>
        </button>

        <button
          type="button"
          className="bowl-button"
          onClick={() => {
            setSavingMenuOpen(false);
            setIncomeOpen(true);
          }}
        >
          <Image className="food-bowl-image" src="/chorong-food-bowl-v2.png" alt="" width={1254} height={1254} aria-hidden="true" unoptimized />

          <small>소득 추가</small>
        </button>
      </section>

      <section
        className="settlement-card settlement-card-clickable"
        role="button"
        tabIndex={0}
        onClick={openSettlementPage}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();

            openSettlementPage();
          }
        }}
      >
        <div className="settlement-icon">
          💰
        </div>

        <div className="settlement-content">
          <span>
            미정산 요약
          </span>

          <div className="home-settlement-money-row">
            <small className="receive">
              받을 돈

              <strong>
                {dataLoading
                  ? "..."
                  : receivableAmount.toLocaleString(
                      "ko-KR",
                    )}

                {!dataLoading && "원"}
              </strong>
            </small>

            <small className="pay">
              줄 돈

              <strong>
                {dataLoading
                  ? "..."
                  : payableAmount.toLocaleString(
                      "ko-KR",
                    )}

                {!dataLoading && "원"}
              </strong>
            </small>
          </div>

          <strong className="home-final-settlement">
            {dataLoading
              ? "..."
              : absoluteSettlementAmount.toLocaleString(
                  "ko-KR",
                )}

            {!dataLoading && "원"}

            <small>
              {" "}
              {settlementDirection}
            </small>
          </strong>

          <em>
            미정산{" "}
            {dataLoading
              ? "..."
              : pendingSettlementCount}
            건
          </em>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();

            openSettlementPage();
          }}
        >
          정산하러 가기 ›
        </button>
      </section>

      <section className="chart-section">
        <SpendingChart
          title="내 소비 현황"
          total={myStatsUsed}
          categories={
            myChartCategories
          }
          loading={dataLoading}
          onDetail={() =>
            router.push(
              "/spending?view=me",
            )
          }
        />

        <SpendingChart
          title={`${partnerNickname} 소비 현황`}
          total={partnerUsed}
          categories={
            partnerChartCategories
          }
          loading={dataLoading}
          onDetail={() =>
            router.push(
              "/spending?view=partner",
            )
          }
        />
      </section>

      <ExpenseSheet
        open={expenseOpen}
        onClose={() =>
          setExpenseOpen(false)
        }
        coupleId={coupleId}
        partnerId={partnerId}
        onSave={handleExpenseSave}
      />

      <IncomeSheet
        open={incomeOpen}
        onClose={() =>
          setIncomeOpen(false)
        }
        coupleId={coupleId}
        currentBudget={budget - netSavingThisMonth - balanceAdjustment}
        usedAmount={used}
        onSave={handleIncomeSave}
      />

      <SavingSheet
        open={savingSheetOpen}
        mode={savingMode}
        onClose={() =>
          setSavingSheetOpen(false)
        }
        coupleId={coupleId}
        userId={userId}
        currentBalance={savingBalance}
        availableBudget={Math.max(
          remaining,
          0,
        )}
        onSave={handleSavingSave}
      />

      {!expenseOpen &&
        !incomeOpen &&
        !savingSheetOpen && (
          <BottomNavigation active="home" />
        )}
    </main>
  );
}

type SpendingChartProps = {
  title: string;
  total: number;
  categories: ChartCategory[];
  loading: boolean;
  onDetail: () => void;
};

function SpendingChart({
  title,
  total,
  categories,
  loading,
  onDetail,
}: SpendingChartProps) {
  const categoryTotal =
    categories.reduce(
      (sum, category) =>
        sum + category.amount,
      0,
    );

  let currentPercentage = 0;

  const visibleCategories = categories.filter(
    (category) => category.amount > 0,
  );

  const gradientParts =
    visibleCategories.map((category, index) => {
      const exactPercentage =
        categoryTotal > 0
          ? (category.amount /
              categoryTotal) *
            100
          : 0;

      const start =
        currentPercentage;

      const end =
        index === visibleCategories.length - 1
          ? 100
          : Math.min(100, currentPercentage + exactPercentage);

      currentPercentage = end;

      return `${category.color} ${start}% ${end}%`;
    });

  const donutBackground =
    visibleCategories.length > 0
      ? `conic-gradient(${gradientParts.join(
          ", ",
        )})`
      : "#eeeeee";

  return (
    <article
      className="chart-card clickable"
      role="button"
      tabIndex={0}
      onClick={onDetail}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onDetail();
        }
      }}
    >
      <h2>{title}</h2>

      <div className="chart-content">
        <div
          className="donut-chart"
          style={{
            background:
              donutBackground,
          }}
        >
          <div className="donut-center">
            <span>총 지출</span>

            <strong>
              {loading
                ? "..."
                : `${total.toLocaleString(
                    "ko-KR",
                  )}원`}
            </strong>
          </div>
        </div>

        <div className="chart-percentages">
          {loading ? (
            <span className="chart-empty-text">
              불러오는 중...
            </span>
          ) : categories.length === 0 ? (
            <span className="chart-empty-text">
              소비 기록 없음
            </span>
          ) : (
            categories.map(
              (category) => (
                <span
                  key={category.name}
                  title={`${category.name} ${category.amount.toLocaleString(
                    "ko-KR",
                  )}원`}
                >
                  <i
                    style={{
                      background:
                        category.color,
                    }}
                  />

                  <b>
                    {category.name}
                  </b>

                  {category.percentage}%
                </span>
              ),
            )
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDetail();
        }}
      >
        더 자세히 보기 ›
      </button>
    </article>
  );
}
