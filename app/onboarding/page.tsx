"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./onboarding.css";

const supabase = createClient();

export default function OnboardingPage() {
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, couple_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.couple_id) {
        router.replace("/");
        return;
      }

      if (profile?.nickname) {
        setNickname(profile.nickname);
      }

      setLoading(false);
    };

    checkUser();
  }, [router]);

  const saveProfile = async () => {
    setMessage("");

    if (!nickname.trim()) {
      setMessage("닉네임을 입력해 주세요.");
      return false;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return false;
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        nickname: nickname.trim(),
      });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return false;
    }

    return true;
  };

  const goToCreate = async () => {
    const success = await saveProfile();

    if (success) {
      router.push("/couple/create");
    }
  };

  const goToJoin = async () => {
    const success = await saveProfile();

    if (success) {
      router.push("/couple/join");
    }
  };

  if (loading) {
    return (
      <main className="onboarding-loading">
        로그인 정보를 확인하고 있어요...
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <Image
          src="/chorong-mint-collar-no-charm-v2.png"
          alt="초롱이"
          width={185}
          height={185}
          priority
        />

        <h1>가계부를 시작해 볼까요?</h1>

        <p>
          먼저 앱에서 사용할 닉네임을 입력해 주세요.
        </p>

        <label className="nickname-field">
          닉네임

          <input
            type="text"
            value={nickname}
            maxLength={12}
            placeholder="예: 건근"
            onChange={(event) =>
              setNickname(event.target.value)
            }
          />
        </label>

        {message && (
          <p className="onboarding-message">
            {message}
          </p>
        )}

        <div className="onboarding-actions">
          <button
            type="button"
            className="create-couple-button"
            disabled={saving}
            onClick={goToCreate}
          >
            <span>🏠</span>

            <div>
              <strong>새 가계부 만들기</strong>
              <small>
                초대 코드를 만들어 상대방을 초대해요
              </small>
            </div>

            <b>›</b>
          </button>

          <button
            type="button"
            className="join-couple-button"
            disabled={saving}
            onClick={goToJoin}
          >
            <span>💌</span>

            <div>
              <strong>초대 코드 입력하기</strong>
              <small>
                상대방에게 받은 코드로 참여해요
              </small>
            </div>

            <b>›</b>
          </button>
        </div>
      </section>
    </main>
  );
}