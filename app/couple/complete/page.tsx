"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./complete.css";

export default function CoupleCompletePage() {
  return (
    <Suspense fallback={<CompleteLoading />}>
      <CoupleCompleteContent />
    </Suspense>
  );
}

function CoupleCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const inviteCode =
    searchParams.get("code") ?? "코드 없음";

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = async () => {
    const shareText = [
      "우리 커플 가계부에 초대할게!",
      `초대 코드: ${inviteCode}`,
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "커플 가계부 초대",
          text: shareText,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setCopied(true);
    } catch (error) {
      console.error("공유 실패:", error);
    }
  };

  return (
    <main className="couple-complete-page">
      <section className="couple-complete-card">
        <div className="complete-check">✓</div>

        <Image
          src="/chorong-mint-collar-no-charm-v2.png"
          alt="초롱이"
          width={190}
          height={190}
          priority
        />

        <h1>가계부가 만들어졌어요!</h1>

        <p>
          상대방에게 아래 초대 코드를 전달해 주세요.
          <br />
          상대방이 코드를 입력하면 같은 가계부를 사용하게 돼요.
        </p>

        <div className="invite-code-box">
          <span>초대 코드</span>
          <strong>{inviteCode}</strong>

          <button
            type="button"
            onClick={handleCopy}
          >
            {copied ? "복사 완료" : "코드 복사"}
          </button>
        </div>

        <button
          type="button"
          className="share-button"
          onClick={handleShare}
        >
          초대 코드 공유하기
        </button>

        <button
          type="button"
          className="home-button"
          onClick={() => router.replace("/")}
        >
          홈으로 이동
        </button>

        <small>
          상대방은 회원가입 후
          <br />
          ‘초대 코드 입력하기’를 선택하면 돼요.
        </small>
      </section>
    </main>
  );
}

function CompleteLoading() {
  return (
    <main className="couple-complete-page">
      <section className="couple-complete-card">
        초대 코드를 불러오고 있어요...
      </section>
    </main>
  );
}