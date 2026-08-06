"use client";

import Image from "next/image";
import {
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import ExpenseSheet from "@/components/ExpenseSheet";
import IncomeSheet from "@/components/IncomeSheet";
import BottomNavigation from "@/components/BottomNavigation";
import { createClient } from "@/lib/supabase/client";

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

  settlement_status: string;
};

type ChartCategory = {
  name: string;
  amount: number;
  percentage: number;
  color: string;
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
    name: "생활",
    color: "#ef8a8a",
  },
  {
    name: "의료",
    color: "#58b5ad",
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

function getMonthRange() {
  const now = new Date();

  const year = now.getFullYear();
  const month = now.getMonth();

  const startDate = new Date(
    year,
    month,
    1,
  );

  const nextMonthDate = new Date(
    year,
    month + 1,
    1,
  );

  return {
    month: month + 1,
    start: formatDate(startDate),
    end: formatDate(nextMonthDate),
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

  const [userId, setUserId] =
    useState<string | null>(null);

  const [partnerId, setPartnerId] =
    useState<string | null>(null);

  const [coupleId, setCoupleId] =
    useState<string | null>(null);

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

  const [used, setUsed] =
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

  const monthRange = getMonthRange();

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

  /*
   * 이번 달 소득, 소비, 그래프, 정산 조회
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
          monthRange.start,
        )
        .lt(
          "income_date",
          monthRange.end,
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
          settlement_status
        `)
        .eq("couple_id", coupleId)
        .gte(
          "expense_date",
          monthRange.start,
        )
        .lt(
          "expense_date",
          monthRange.end,
        );

      const [
        incomeResult,
        expenseResult,
      ] = await Promise.all([
        incomeQuery,
        expenseQuery,
      ]);

      if (!mounted) {
        return;
      }

      if (incomeResult.error) {
        console.error(
          "소득 조회 오류:",
          incomeResult.error,
        );

        setBudget(0);
      } else {
        setBudget(
          sumAmounts(
            incomeResult.data as
              | AmountData[]
              | null,
          ),
        );
      }

      if (expenseResult.error) {
        console.error(
          "소비 조회 오류:",
          expenseResult.error,
        );

        setUsed(0);
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

      /*
       * 내 소비와 상대 소비 분리
       */
      const myExpenses =
        allExpenses.filter(
          (expense) =>
            expense.user_id === userId,
        );

      const partnerExpenses =
        partnerId
          ? allExpenses.filter(
              (expense) =>
                expense.user_id ===
                partnerId,
            )
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

      setPartnerUsed(
        partnerUsedAmount,
      );

      setMyChartCategories(
        createChartCategories(
          myExpenses,
        ),
      );

      setPartnerChartCategories(
        createChartCategories(
          partnerExpenses,
        ),
      );

      /*
       * 정산대기 기록 계산
       *
       * 내가 결제:
       * 상대방 몫을 내가 받을 돈으로 계산
       *
       * 상대가 결제:
       * 내 몫을 내가 줄 돈으로 계산
       */
      const pendingSettlements =
        allExpenses.filter(
          (expense) =>
            expense.use_type ===
              "함께" &&
            expense.payment_type ===
              "나눠내기" &&
            expense.settlement_status ===
              "정산대기",
        );

      let nextReceivableAmount = 0;
      let nextPayableAmount = 0;

      pendingSettlements.forEach(
        (expense) => {
          if (
            expense.payer_id === userId
          ) {
            nextReceivableAmount +=
              Number(
                expense.partner_share ||
                  0,
              );

            return;
          }

          if (
            partnerId &&
            expense.payer_id ===
              partnerId
          ) {
            nextPayableAmount +=
              Number(
                expense.my_share || 0,
              );
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
        pendingSettlements.length,
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
    monthRange.start,
    monthRange.end,
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

  const remaining = budget - used;

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
            {monthRange.month}월{" "}
            <span>❤️</span>
          </h1>

          <p>
            {nickname}님, 함께 아끼고
            행복해요 🐾
          </p>
        </div>

        <button
          type="button"
          className="notification-button"
          aria-label="알림 확인"
        >
          🔔

          <span className="notification-count">
            3
          </span>
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

            내 이번 달 예산
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
    remaining < 0 ? "negative" : ""
  }`}
>
  {dataLoading
    ? "..."
    : remaining.toLocaleString("ko-KR")}

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
    <span>이번 달 예산</span>

    <strong>
      {budget.toLocaleString("ko-KR")}원
    </strong>
  </div>

  <div>
  <span>사용 금액</span>

  <strong className="used-amount">
    {used.toLocaleString("ko-KR")}원
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
        <div className="speech-bubble">
          오늘도
          <br />
          수고했어!
        </div>

        <button
          type="button"
          className="dog-button"
          onClick={() =>
            setExpenseOpen(true)
          }
          aria-label="소비 기록하기"
        >
          <Image
            src="/chorong-v2.png"
            alt="초롱이"
            width={210}
            height={210}
            priority
          />
        </button>

        <button
          type="button"
          className="expense-button"
          onClick={() =>
            setExpenseOpen(true)
          }
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
          onClick={() =>
            setIncomeOpen(true)
          }
        >
          <div className="bowl">
            <span>🐾</span>
          </div>

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
            이번 달 정산 요약
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
          total={used}
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
        currentBudget={budget}
        usedAmount={used}
        onSave={handleIncomeSave}
      />

      {!expenseOpen &&
        !incomeOpen && (
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

  const gradientParts =
    categories.map((category) => {
      const exactPercentage =
        categoryTotal > 0
          ? (category.amount /
              categoryTotal) *
            100
          : 0;

      const start =
        currentPercentage;

      const end =
        currentPercentage +
        exactPercentage;

      currentPercentage = end;

      return `${category.color} ${start}% ${end}%`;
    });

  const donutBackground =
    categories.length > 0
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