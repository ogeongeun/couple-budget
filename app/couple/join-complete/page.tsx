"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import "./join-complete.css";

export default function JoinCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const coupleName =
    searchParams.get("name") ?? "우리의 가계부";

  return (
    <main className="join-complete-page">
      <section className="join-complete-card">
        <div className="join-complete-check">
          ✓
        </div>

        <Image
          src="/chorong-v2.png"
          alt="초롱이"
          width={190}
          height={190}
          priority
        />

        <h1>가계부에 참여했어요!</h1>

        <p>
          이제 상대방과 함께
          <br />
          같은 가계부를 사용할 수 있어요.
        </p>

        <div className="joined-couple-name">
          <span>참여한 가계부</span>
          <strong>{coupleName}</strong>
        </div>

        <button
          type="button"
          onClick={() => router.replace("/")}
        >
          가계부 시작하기
        </button>
      </section>
    </main>
  );
}