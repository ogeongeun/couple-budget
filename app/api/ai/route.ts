import { GoogleGenAI } from "@google/genai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AiResult = {
  answer: string;
  action: {
    kind: "none" | "add_expense" | "show_chart";
    amount: number;
    category: string;
    title: string;
    expenseDate: string;
    groupBy: "day" | "week" | "category";
    period: "this_week" | "this_month";
    scope: "me" | "partner" | "couple";
    metric: "expense" | "income" | "net";
  };
};

type ChartPoint = { label: string; value: number };

function getMonday(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

const expenseCategories = [
  "식비",
  "카페",
  "교통",
  "쇼핑",
  "문화",
  "생활비",
  "의료",
  "미용",
  "기타",
] as const;

function getMonthRange() {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

  return {
    start: format(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: format(nextMonth),
    label: `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
  };
}

function getWeekRange(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (current.getUTCDay() + 6) % 7;
  const start = new Date(current);
  start.setUTCDate(current.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API 키가 아직 설정되지 않았어요." },
      { status: 503 },
    );
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 설정을 확인해주세요." }, { status: 500 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = (await request.json()) as { messages?: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: "질문 형식이 올바르지 않아요." }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (message): message is ChatMessage =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 500),
    }));

  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {}
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nickname, couple_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.couple_id) {
    return NextResponse.json({ error: "커플 정보를 불러오지 못했어요." }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Seoul",
  });
  const range = getMonthRange();
  const weekRange = getWeekRange(today);
  const [profilesResult, expensesResult, incomesResult, weeklyExpensesResult] = await Promise.all([
    supabase.from("profiles").select("id, nickname").eq("couple_id", profile.couple_id),
    supabase
      .from("expenses")
      .select("user_id, amount, category, title, expense_date, use_type, payment_type, payer_id")
      .eq("couple_id", profile.couple_id)
      .gte("expense_date", range.start)
      .lt("expense_date", range.end)
      .order("expense_date", { ascending: false })
      .limit(300),
    supabase
      .from("incomes")
      .select("user_id, amount, category, memo, income_date")
      .eq("couple_id", profile.couple_id)
      .gte("income_date", range.start)
      .lt("income_date", range.end)
      .order("income_date", { ascending: false })
      .limit(100),
    supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user.id)
      .gte("expense_date", weekRange.start)
      .lt("expense_date", weekRange.end),
  ]);

  if (
    profilesResult.error ||
    expensesResult.error ||
    incomesResult.error ||
    weeklyExpensesResult.error
  ) {
    console.error("AI 데이터 조회 오류", {
      profiles: profilesResult.error?.message,
      expenses: expensesResult.error?.message,
      incomes: incomesResult.error?.message,
      weeklyExpenses: weeklyExpensesResult.error?.message,
    });
    return NextResponse.json({ error: "소비 정보를 불러오지 못했어요." }, { status: 500 });
  }

  const nicknameById = Object.fromEntries(
    (profilesResult.data ?? []).map((item) => [item.id, item.nickname ?? "사용자"]),
  );
  const expenses = (expensesResult.data ?? []).map((expense) => ({
    사용자: nicknameById[expense.user_id] ?? "사용자",
    금액: Number(expense.amount || 0),
    카테고리: expense.category,
    내용: expense.title || expense.category,
    날짜: expense.expense_date,
    사용방식: expense.use_type,
    결제방식: expense.payment_type,
    결제자: expense.payer_id ? nicknameById[expense.payer_id] ?? "사용자" : null,
  }));
  const incomes = (incomesResult.data ?? []).map((income) => ({
    사용자: nicknameById[income.user_id] ?? "사용자",
    금액: Number(income.amount || 0),
    카테고리: income.category,
    내용: income.memo || income.category,
    날짜: income.income_date,
  }));
  const myExpenses = (expensesResult.data ?? [])
    .filter((expense) => expense.user_id === user.id)
    .map((expense) => ({
      금액: Number(expense.amount || 0),
      카테고리: expense.category,
      내용: expense.title || expense.category,
      날짜: expense.expense_date,
      사용방식: expense.use_type,
      결제방식: expense.payment_type,
    }));
  const myIncomes = (incomesResult.data ?? [])
    .filter((income) => income.user_id === user.id)
    .map((income) => ({
      금액: Number(income.amount || 0),
      카테고리: income.category,
      내용: income.memo || income.category,
      날짜: income.income_date,
    }));
  const summarizeExpenses = (items: typeof myExpenses) => {
    const categoryTotals: Record<string, number> = {};
    let total = 0;

    for (const item of items) {
      total += item.금액;
      categoryTotals[item.카테고리] =
        (categoryTotals[item.카테고리] ?? 0) + item.금액;
    }

    return {
      총소비: total,
      카테고리별소비: Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => ({ category, amount })),
    };
  };
  const mySummary = {
    ...summarizeExpenses(myExpenses),
    총소득: myIncomes.reduce((sum, income) => sum + income.금액, 0),
  };
  const weeklyBudget = Math.round(mySummary.총소득 / 4);
  const weeklyLimit = weeklyBudget;
  const weeklySpent = (weeklyExpensesResult.data ?? []).reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0,
  );
  const weeklyRemaining = Math.max(weeklyLimit - weeklySpent, 0);
  const weeklySummary = {
    주간예산: weeklyBudget,
    기준비율: 100,
    목표한도: weeklyLimit,
    이번주사용: weeklySpent,
    더쓸수있는금액: weeklyRemaining,
  };
  const latestQuestion = messages.at(-1)?.content ?? "";
  const asksWeeklyRemaining =
    /이번\s*주/.test(latestQuestion) &&
    /(얼마.*(더|써|사용)|더.*(써|사용)|남은.*(예산|금액))/.test(latestQuestion);

  if (asksWeeklyRemaining) {
    const answer =
      weeklySpent <= weeklyLimit
        ? `이번 주에는 ${weeklyRemaining.toLocaleString("ko-KR")}원 더 써도 돼. 주간 예산 ${weeklyBudget.toLocaleString("ko-KR")}원 중 지금까지 ${weeklySpent.toLocaleString("ko-KR")}원을 썼어.`
        : `이번 주 예산을 이미 ${(weeklySpent - weeklyLimit).toLocaleString("ko-KR")}원 넘었어. 주간 예산은 ${weeklyBudget.toLocaleString("ko-KR")}원이고, 지금까지 ${weeklySpent.toLocaleString("ko-KR")}원을 썼어.`;

    return NextResponse.json({ answer, action: null });
  }

  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      config: {
        systemInstruction: `너는 커플 가계부 앱 '둘의 하루'의 AI 소비 도우미야. 현재 로그인한 사용자는 '${profile.nickname ?? "사용자"}'이고 오늘은 ${today}이야.
제공된 데이터만 근거로 한국어로 쉽고 다정하게 답해. '내', '나', '내가'라고 물으면 반드시 아래의 '로그인 사용자 개인 요약'과 '로그인 사용자 개인 기록'만 사용해. 개인 소비 합계와 카테고리 합계는 직접 다시 계산하지 말고 개인 요약의 숫자를 그대로 답해. 이때 로그인한 사용자의 닉네임을 제3자처럼 부르지 말고 '이번 달에는', '가장 많이 쓴 항목은'처럼 사용자에게 직접 말해. 'OO님이', '내가 물어보신', '본인이' 같은 표현은 사용하지 마. 상대방 이름이나 둘/우리/커플을 명시한 경우에만 아래의 커플 전체 기록을 분석해.
사용자가 개인 소비 추가를 명확하게 요청하면 action.kind를 add_expense로 설정하고 금액, 카테고리, 내용, 날짜를 정리해. '오늘'은 ${today}로 변환해. 음료수/커피/카페 음료는 카페, 식사/음식은 식비로 분류해. 저장은 하지 말고 확인할 초안이라고 안내해. 소비 추가 요청이 아니면 action.kind는 none이고 나머지 action 값은 빈 값이나 0으로 둬.
사용자가 그래프나 차트로 보여달라고 요청하면 action.kind를 show_chart로 설정해. 날짜별/일별은 groupBy day, 주별은 week, 카테고리별은 category야. 이번 주와 이번 달만 지원해. '내'는 scope me, 애인/상대방은 partner, 둘/우리/커플은 couple이야. 소비는 expense, 소득은 income, 소득에서 소비를 뺀 금액은 net이야. 그래프 요청이면 답변에는 어떤 그래프를 준비했는지만 짧게 안내해.
금액은 원 단위로 정확히 답하고 데이터에 없는 사실은 추측하지 마. 모바일에서 읽기 좋게 짧게 답하되 결론과 근거를 포함해. 현재 분석 기간은 ${range.label}이야.\n\n로그인 사용자 개인 요약(서버에서 계산한 확정값):\n${JSON.stringify(mySummary)}\n\n로그인 사용자 이번 주 요약(월 소득을 4로 나눈 주간 예산의 100% 기준):\n${JSON.stringify(weeklySummary)}\n\n로그인 사용자 개인 기록:\n${JSON.stringify({ incomes: myIncomes, expenses: myExpenses })}\n\n이번 달 커플 전체 기록(상대방 또는 둘을 명시했을 때만 사용):\n${JSON.stringify({ incomes, expenses })}`,
        maxOutputTokens: 600,
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            action: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["none", "add_expense", "show_chart"] },
                amount: { type: "integer", minimum: 0 },
                category: { type: "string", enum: [...expenseCategories] },
                title: { type: "string" },
                expenseDate: { type: "string" },
                groupBy: { type: "string", enum: ["day", "week", "category"] },
                period: { type: "string", enum: ["this_week", "this_month"] },
                scope: { type: "string", enum: ["me", "partner", "couple"] },
                metric: { type: "string", enum: ["expense", "income", "net"] },
              },
              required: ["kind", "amount", "category", "title", "expenseDate", "groupBy", "period", "scope", "metric"],
            },
          },
          required: ["answer", "action"],
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini가 빈 응답을 반환했습니다.");
    }

    const result = JSON.parse(response.text) as AiResult;
    if (result.action.kind === "show_chart") {
      const { groupBy, period, scope, metric } = result.action;
      const inPeriod = (date: string) =>
        period === "this_week"
          ? date >= weekRange.start && date < weekRange.end
          : date >= range.start && date < range.end;
      const inScope = (ownerId: string) =>
        scope === "couple"
          ? true
          : scope === "me"
            ? ownerId === user.id
            : ownerId !== user.id;
      const totals = new Map<string, number>();
      const addPoint = (date: string, category: string, amount: number) => {
        const key =
          groupBy === "category"
            ? category
            : groupBy === "week"
              ? getMonday(date)
              : date;
        totals.set(key, (totals.get(key) ?? 0) + amount);
      };

      if (metric === "expense" || metric === "net") {
        for (const expense of expensesResult.data ?? []) {
          if (inPeriod(expense.expense_date) && inScope(expense.user_id)) {
            addPoint(
              expense.expense_date,
              expense.category,
              Number(expense.amount || 0) * (metric === "net" ? -1 : 1),
            );
          }
        }
      }
      if (metric === "income" || metric === "net") {
        for (const income of incomesResult.data ?? []) {
          if (inPeriod(income.income_date) && inScope(income.user_id)) {
            addPoint(income.income_date, income.category, Number(income.amount || 0));
          }
        }
      }

      const formatLabel = (key: string) => {
        if (groupBy === "category") return key;
        const [, month, day] = key.split("-");
        return groupBy === "week"
          ? `${Number(month)}/${Number(day)} 주`
          : `${Number(month)}/${Number(day)}`;
      };
      const points: ChartPoint[] = [...totals.entries()]
        .sort(groupBy === "category" ? ([, a], [, b]) => Math.abs(b) - Math.abs(a) : ([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label: formatLabel(label), value }));
      const scopeLabel = scope === "me" ? "내" : scope === "partner" ? "애인" : "둘의";
      const metricLabel = metric === "expense" ? "소비" : metric === "income" ? "소득" : "잔액";
      const periodLabel = period === "this_week" ? "이번 주" : "이번 달";

      return NextResponse.json({
        answer: result.answer,
        action: {
          kind: "show_chart",
          title: `${periodLabel} ${scopeLabel} ${metricLabel}`,
          points,
        },
      });
    }
    const action =
      result.action.kind === "add_expense" &&
      result.action.amount > 0 &&
      expenseCategories.includes(
        result.action.category as (typeof expenseCategories)[number],
      )
        ? result.action
        : null;

    return NextResponse.json({ answer: result.answer, action });
  } catch (error) {
    console.error("Gemini 응답 오류:", error);
    return NextResponse.json(
      { error: "AI 답변을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }
}
