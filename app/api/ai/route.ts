import { GoogleGenAI } from "@google/genai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant"; content: string };

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

  try {
    const response = await new GoogleGenAI({ apiKey }).models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      config: {
        systemInstruction: `너는 커플 가계부 앱 '둘의 하루'의 AI 소비 도우미야. 제공된 데이터만 근거로 한국어로 쉽고 다정하게 답해. 금액은 원 단위로 정확히 계산하고 데이터에 없는 사실은 추측하지 마. 모바일에서 읽기 좋게 짧게 답하되 결론과 근거를 포함해. 현재 분석 기간은 ${range.label}이야.\n\n이번 달 커플 데이터:\n${JSON.stringify({ incomes, expenses })}`,
        maxOutputTokens: 600,
        temperature: 0.3,
      },
    });

    if (!response.text) {
      throw new Error("Gemini가 빈 응답을 반환했습니다.");
    }

    return NextResponse.json({ answer: response.text });
  } catch (error) {
    console.error("Gemini 응답 오류:", error);
    return NextResponse.json(
      { error: "AI 답변을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }
}
