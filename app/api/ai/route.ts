import { GoogleGenAI } from "@google/genai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AiResult = {
  answer: string;
  action: {
    kind: "none" | "add_expense";
    amount: number;
    category: string;
    title: string;
    expenseDate: string;
  };
};

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

  const range = getMonthRange();
  const [profilesResult, expensesResult, incomesResult] = await Promise.all([
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
  ]);

  if (profilesResult.error || expensesResult.error || incomesResult.error) {
    console.error("AI 데이터 조회 오류", {
      profiles: profilesResult.error?.message,
      expenses: expensesResult.error?.message,
      incomes: incomesResult.error?.message,
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
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Seoul",
  });

  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      config: {
        systemInstruction: `너는 커플 가계부 앱 '둘의 하루'의 AI 소비 도우미야. 현재 로그인한 사용자는 '${profile.nickname ?? "사용자"}'이고 오늘은 ${today}이야.
제공된 데이터만 근거로 한국어로 쉽고 다정하게 답해. '내', '나', '내가'라고 물으면 반드시 로그인한 사용자 개인 기록만 분석해. 상대방 이름이나 둘/우리/커플을 명시한 경우에만 상대방 또는 합산 기록을 분석해.
사용자가 개인 소비 추가를 명확하게 요청하면 action.kind를 add_expense로 설정하고 금액, 카테고리, 내용, 날짜를 정리해. '오늘'은 ${today}로 변환해. 음료수/커피/카페 음료는 카페, 식사/음식은 식비로 분류해. 저장은 하지 말고 확인할 초안이라고 안내해. 소비 추가 요청이 아니면 action.kind는 none이고 나머지 action 값은 빈 값이나 0으로 둬.
금액은 원 단위로 정확히 계산하고 데이터에 없는 사실은 추측하지 마. 모바일에서 읽기 좋게 짧게 답하되 결론과 근거를 포함해. 현재 분석 기간은 ${range.label}이야.\n\n이번 달 커플 데이터:\n${JSON.stringify({ incomes, expenses })}`,
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
                kind: { type: "string", enum: ["none", "add_expense"] },
                amount: { type: "integer", minimum: 0 },
                category: { type: "string", enum: [...expenseCategories] },
                title: { type: "string" },
                expenseDate: { type: "string" },
              },
              required: ["kind", "amount", "category", "title", "expenseDate"],
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
