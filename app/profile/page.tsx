"use client";

import Image from "next/image";
import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import "./profile.css";

const supabase = createClient();

type ProfileData = {
  id: string;
  nickname: string | null;
  couple_id: string | null;
  avatar_url: string | null;
};

type CoupleData = {
  name: string;
  invite_code: string;
};

type PartnerData = {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] =
    useState<ProfileData | null>(null);

  const [couple, setCouple] =
    useState<CoupleData | null>(null);

  const [partner, setPartner] =
    useState<PartnerData | null>(null);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [message, setMessage] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setCouple(null);
    setPartner(null);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    setEmail(user.email ?? "");

    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "id, nickname, couple_id, avatar_url",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "프로필 조회 오류:",
        profileError,
      );

      setMessage(
        "프로필을 불러오지 못했어요.",
      );

      setLoading(false);
      return;
    }

    if (!profileData) {
      router.replace("/onboarding");
      return;
    }

    setProfile(profileData);

    if (!profileData.couple_id) {
      setLoading(false);
      return;
    }

    const {
      data: coupleData,
      error: coupleError,
    } = await supabase
      .from("couples")
      .select("name, invite_code")
      .eq("id", profileData.couple_id)
      .maybeSingle();

    if (coupleError) {
      console.error(
        "가계부 조회 오류:",
        coupleError,
      );
    } else {
      setCouple(coupleData);
    }

    const {
      data: partnerData,
      error: partnerError,
    } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url")
      .eq(
        "couple_id",
        profileData.couple_id,
      )
      .neq("id", user.id)
      .maybeSingle();

    if (partnerError) {
      console.error(
        "상대방 프로필 조회 오류:",
        partnerError,
      );
    } else {
      setPartner(partnerData);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage(
        "이미지 파일만 업로드할 수 있어요.",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage(
        "이미지는 5MB 이하만 업로드할 수 있어요.",
      );
      return;
    }

    setUploading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setUploading(false);
      router.replace("/login");
      return;
    }

   const filePath = `${user.id}/avatar`;

const { error: uploadError } =
  await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

    if (uploadError) {
      console.error(
        "이미지 업로드 오류:",
        uploadError,
      );

      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: publicUrlData,
    } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

   const avatarUrl =
  `${publicUrlData.publicUrl}?v=${Date.now()}`;
    const {
      error: updateError,
    } = await supabase
      .from("profiles")
      .update({
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error(
        "프로필 이미지 저장 오류:",
        updateError,
      );

      setMessage(updateError.message);
      setUploading(false);
      return;
    }

    setProfile((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        avatar_url: avatarUrl,
      };
    });

    setMessage(
      "프로필 이미지가 변경됐어요.",
    );

    setUploading(false);

    event.target.value = "";
  };

  const handleLogout = async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

 if (loading) {
  return (
    <main className="profile-page">
      <p className="profile-loading">
        불러오는 중...
      </p>

      <BottomNavigation active="profile" />
    </main>
  );
}
  return (
    <main className="profile-page">
      <header className="profile-header">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          ←
        </button>

        <h1>마이프로필</h1>

        <span />
      </header>

      <section className="profile-user-card">
        <button
          type="button"
          className="profile-image-button"
          onClick={handleImageButtonClick}
          disabled={uploading}
          aria-label="프로필 이미지 변경"
        >
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="내 프로필 이미지"
              width={64}
              height={64}
              unoptimized
            />
          ) : (
            <span className="profile-avatar">
              {(
                profile?.nickname?.[0] ?? "나"
              ).toUpperCase()}
            </span>
          )}

          <span className="profile-camera">
            {uploading ? "…" : "✎"}
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleImageChange}
        />

        <div className="profile-user-info">
          <strong>
            {profile?.nickname ?? "사용자"}
          </strong>

          <p>{email}</p>

          <button
            type="button"
            onClick={handleImageButtonClick}
            disabled={uploading}
          >
            {uploading
              ? "업로드 중..."
              : "프로필 사진 변경"}
          </button>
        </div>
      </section>

      {message && (
        <p className="profile-message">
          {message}
        </p>
      )}

      <section className="profile-section">
        <h2>커플 연결</h2>

        {couple && partner ? (
          <div className="couple-connected-card">
            <span className="connection-badge">
              연결됨
            </span>

            <div className="partner-profile">
              <div className="partner-avatar">
                {partner.avatar_url ? (
                  <Image
                    src={partner.avatar_url}
                    alt="상대방 프로필 이미지"
                    width={70}
                    height={70}
                    unoptimized
                  />
                ) : (
                  <span>
                    {(
                      partner.nickname?.[0] ??
                      "상"
                    ).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <span>연결된 상대</span>

                <strong>
                  {partner.nickname ??
                    "상대방"}
                </strong>
              </div>
            </div>

            <div className="connected-couple-info">
              <span>함께 사용하는 가계부</span>
              <strong>{couple.name}</strong>
            </div>
          </div>
        ) : couple ? (
          <div className="couple-empty-card">
            <div className="couple-empty-icon">
              ♡
            </div>

            <strong>
              상대방 연결 대기 중이에요
            </strong>

            <p>
              상대방이 아래 초대 코드를
              입력하면 프로필이 표시돼요.
            </p>

            <div className="profile-invite-code">
              <span>초대 코드</span>
              <b>{couple.invite_code}</b>
            </div>

            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(
                  couple.invite_code,
                )
              }
            >
              초대 코드 복사
            </button>
          </div>
        ) : (
          <div className="couple-empty-card">
            <div className="couple-empty-icon">
              ♡
            </div>

            <strong>
              연결된 커플이 없어요
            </strong>

            <p>
              초대 코드를 만들거나 상대방에게
              받은 코드를 입력해 연결할 수 있어요.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push("/couple/connect")
              }
            >
              커플 연결하기
            </button>
          </div>
        )}
      </section>

      <section className="profile-section">
        <h2>계정</h2>

        <button
          type="button"
          className="profile-menu-button"
          onClick={() =>
            router.push("/profile/edit")
          }
        >
          <span>프로필 수정</span>
          <b>›</b>
        </button>

        <button
          type="button"
          className="profile-menu-button logout"
          onClick={handleLogout}
        >
          <span>로그아웃</span>
          <b>›</b>
        </button>
      </section>

    <BottomNavigation active="profile" />
    </main>
  );
}