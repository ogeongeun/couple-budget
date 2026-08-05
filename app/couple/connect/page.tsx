"use client";

import { useRouter } from "next/navigation";
import "./connect.css";

export default function CoupleConnectPage() {
  const router = useRouter();

  return (
    <main className="couple-connect-page">
      <header className="couple-connect-header">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
        >
          ←
        </button>

        <h1>커플 연결하기</h1>

        <span />
      </header>

      <section className="couple-connect-content">
        <h2>어떻게 연결할까요?</h2>

        <p>
          초대 코드를 만들거나 상대방에게 받은 코드를 입력해 주세요.
        </p>

        <button
          type="button"
          className="connect-option"
          onClick={() => router.push("/couple/create")}
        >
          <span className="connect-icon">＋</span>

          <div>
            <strong>새 초대 코드 만들기</strong>
            <p>내가 가계부를 만들고 상대방을 초대해요.</p>
          </div>

          <b>›</b>
        </button>

        <button
          type="button"
          className="connect-option"
          onClick={() => router.push("/couple/join")}
        >
          <span className="connect-icon">⌨</span>

          <div>
            <strong>받은 초대 코드 입력하기</strong>
            <p>상대방이 만든 가계부에 참여해요.</p>
          </div>

          <b>›</b>
        </button>
      </section>
    </main>
  );
}