import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import webpush from "web-push";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!supabaseUrl || !supabaseKey || !serviceKey || !vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "푸시 알림 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { expenseId?: unknown };
  const expenseId = typeof body.expenseId === "string" ? body.expenseId : "";
  const { data: expense } = await supabase
    .from("expenses")
    .select("id, user_id, couple_id, amount, category, title")
    .eq("id", expenseId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!expense?.couple_id) {
    return NextResponse.json({ error: "소비 기록을 확인하지 못했어요." }, { status: 404 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: partners } = await admin
    .from("profiles")
    .select("id")
    .eq("couple_id", expense.couple_id)
    .neq("id", user.id);
  const partnerIds = (partners ?? []).map((partner) => partner.id);
  if (partnerIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", partnerIds);
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:dhfqorrldnjs@gmail.com",
    vapidPublic,
    vapidPrivate,
  );
  const payload = JSON.stringify({
    title: "새로운 소비 기록",
    body: `${expense.title || expense.category} ${Number(expense.amount || 0).toLocaleString("ko-KR")}원이 등록됐어요.`,
    url: "/notifications",
    tag: `expense-${expense.id}`,
  });

  let sent = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
        sent += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          console.error("웹 푸시 발송 오류:", error);
        }
      }
    }),
  );

  return NextResponse.json({ ok: true, sent });
}
