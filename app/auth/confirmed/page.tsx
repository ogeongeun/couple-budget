import Image from "next/image";
import "./confirmed.css";

export default function EmailConfirmedPage() {
  return (
    <main className="confirmed-page">
      <section className="confirmed-card">
        <div className="confirmed-icon">✓</div>

        <Image
          src="/chorong-v2.png"
          alt="초롱이"
          width={170}
          height={170}
          priority
        />

        <h1>이메일 인증이 완료되었습니다</h1>

        <p>
          회원가입이 정상적으로 완료되었어요.
          <br />
          이 창을 닫고 기존 로그인 화면으로 돌아가
          <br />
          로그인해 주세요.
        </p>

        <div className="confirmed-guide">
          이제 이 페이지를 닫아도 됩니다.
        </div>
      </section>
    </main>
  );
}