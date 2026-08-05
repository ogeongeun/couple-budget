"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./join.css";

const supabase = createClient();

export default function JoinCouplePage() {
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleCodeChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);

    setInviteCode(value);
    setMessage("");
  };

  const handleJoin = async () => {
    setMessage("");

    if (inviteCode.length !== 6) {
      setMessage("초대 코드 6자리를 입력해 주세요.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    const {
      data: profile,
      error: profileCheckError,
    } = await supabase
      .from("profiles")
      .select("couple_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileCheckError) {
      setLoading(false);
      setMessage(profileCheckError.message);
      return;
    }

    if (profile?.couple_id) {
      setLoading(false);
      setMessage("이미 참여 중인 가계부가 있어요.");
      return;
    }

    const {
      data: couple,
      error: coupleError,
    } = await supabase
      .from("couples")
      .select("id, name, invite_code, created_by")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (coupleError) {
      setLoading(false);
      setMessage(coupleError.message);
      return;
    }

    if (!couple) {
      setLoading(false);
      setMessage("일치하는 초대 코드를 찾지 못했어요.");
      return;
    }

    if (couple.created_by === user.id) {
      setLoading(false);
      setMessage("내가 만든 가계부에는 다시 참여할 수 없어요.");
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        couple_id: couple.id,
      })
      .eq("id", user.id);

    if (updateError) {
      setLoading(false);
      setMessage(updateError.message);
      return;
    }

    setLoading(false);

    router.replace(
      `/couple/join-complete?name=${encodeURIComponent(
        couple.name,
      )}`,
    );
  };

  return (
    <main className="join-couple-page">
      <header className="join-couple-header">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          ←
        </button>

        <h1>초대 코드 입력</h1>

        <span />
      </header>

      <section className="join-couple-card">
        <Image
          src="/chorong-v2.png"
          alt="초롱이"
          width={180}
          height={180}
          priority
        />

        <h2>함께 사용할 가계부에 참여해요</h2>

        <p>
          상대방에게 받은
          <br />
          초대 코드 6자리를 입력해 주세요.
        </p>

        <label className="invite-code-field">
          초대 코드

          <input
            type="text"
            value={inviteCode}
            maxLength={6}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={handleCodeChange}
          />
        </label>

        <div className="code-length">
          {inviteCode.length}/6
        </div>

        {message && (
          <p className="join-couple-message">
            {message}
          </p>
        )}

        <button
          type="button"
          className="join-couple-submit"
          disabled={
            loading || inviteCode.length !== 6
          }
          onClick={handleJoin}
        >
          {loading
            ? "참여하는 중..."
            : "가계부 참여하기"}
        </button>
      </section>
    </main>
  );
}