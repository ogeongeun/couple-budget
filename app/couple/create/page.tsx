"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "./create.css";

const supabase = createClient();

function createInviteCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array.from({ length: 6 }, () => {
    const index = Math.floor(
      Math.random() * characters.length,
    );

    return characters[index];
  }).join("");
}

export default function CreateCouplePage() {
  const router = useRouter();

  const [name, setName] =
    useState("우리의 가계부");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const handleCreate = async () => {
    setMessage("");

    if (!name.trim()) {
      setMessage("가계부 이름을 입력해 주세요.");
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

    const inviteCode = createInviteCode();

    const {
      data: couple,
      error: coupleError,
    } = await supabase
      .from("couples")
      .insert({
        name: name.trim(),
        invite_code: inviteCode,
        created_by: user.id,
      })
      .select("id, invite_code")
      .single();

    if (coupleError || !couple) {
      setLoading(false);
      setMessage(
        coupleError?.message ??
          "가계부를 만들지 못했어요.",
      );
      return;
    }

    const { error: profileError } =
      await supabase
        .from("profiles")
        .update({
          couple_id: couple.id,
        })
        .eq("id", user.id);

    if (profileError) {
      setLoading(false);
      setMessage(profileError.message);
      return;
    }

    setLoading(false);

    router.replace(
      `/couple/complete?code=${couple.invite_code}`,
    );
  };

  return (
    <main className="create-couple-page">
      <header className="create-couple-header">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          ←
        </button>

        <h1>새 가계부 만들기</h1>

        <span />
      </header>

      <section className="create-couple-card">
        <Image
          src="/chorong-v2.png"
          alt="초롱이"
          width={180}
          height={180}
          priority
        />

        <h2>둘만의 가계부를 만들어봐요</h2>

        <p>
          가계부를 만든 뒤 초대 코드를
          <br />
          상대방에게 전달할 수 있어요.
        </p>

        <label>
          가계부 이름

          <input
            type="text"
            value={name}
            maxLength={20}
            placeholder="예: 건근이와 초롱이의 가계부"
            onChange={(event) =>
              setName(event.target.value)
            }
          />
        </label>

        {message && (
          <p className="create-couple-message">
            {message}
          </p>
        )}

        <button
          type="button"
          className="create-couple-submit"
          disabled={loading}
          onClick={handleCreate}
        >
          {loading
            ? "만드는 중..."
            : "가계부 만들기"}
        </button>
      </section>
    </main>
  );
}