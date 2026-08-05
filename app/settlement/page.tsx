"use client";

import { useRouter } from "next/navigation";

export default function SettlementPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "24px",
        background: "#fffdf9",
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
      >
        ←
      </button>

      <h1>정산</h1>

      <p>정산 화면 준비 중입니다.</p>
    </main>
  );
}