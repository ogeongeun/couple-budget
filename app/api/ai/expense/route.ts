import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const categories = new Set([
  "식비",
  "카페",
  "교통",
  "쇼핑",
  "문화",
  "생활비",
  "의료",
  "미용",
  "기타",
]);

type ExpenseDraft = {
  amount?: unknown;
  category?: unknown;
  title?: unknown;
  expenseDate?: unknown;
};

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase 설정을 확인해주세요." }, { status: 500 });
  }

  let draft: ExpenseDraft;
  try {
    draft = (await request.json()) as ExpenseDraft;
  } catch {
    return NextResponse.json({ error: "소비 정보가 올바르지 않아요." }, { status: 400 });
  }

  const amount = Number(draft.amount);
  const category = typeof draft.category === "string" ? draft.category : "";
  const title = typeof draft.title === "string" ? draft.title.trim().slice(0, 80) : "";
  const expenseDate = typeof draft.expenseDate === "string" ? draft.expenseDate : "";

  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000_000) {
    return NextResponse.json({ error: "소비 금액을 다시 확인해주세요." }, { status: 400 });
  }
  if (!categories.has(category)) {
    return NextResponse.json({ error: "소비 카테고리를 다시 확인해주세요." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    return NextResponse.json({ error: "소비 날짜를 다시 확인해주세요." }, { status: 400 });
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
    .select("couple_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.couple_id) {
    return NextResponse.json({ error: "커플 정보를 불러오지 못했어요." }, { status: 400 });
  }

  const { data: insertedExpense, error: insertError } = await supabase
    .from("expenses")
    .insert({
      couple_id: profile.couple_id,
      user_id: user.id,
      amount,
      category,
      title: title || category,
      memo: null,
      expense_date: expenseDate,
      use_type: "혼자",
      payment_type: null,
      payer_id: user.id,
      my_share: amount,
      partner_share: 0,
      settlement_status: "해당없음",
      settled_at: null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("AI 소비 저장 오류:", insertError);
    return NextResponse.json({ error: "소비 기록을 저장하지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({
    message: `${title || category} ${amount.toLocaleString("ko-KR")}원이 소비 기록에 추가됐어요.`,
    expenseId: insertedExpense.id,
  });
}
