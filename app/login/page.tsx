"use client";

import Image from "next/image";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./login.css";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [mode, setMode] =
    useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [
    passwordConfirm,
    setPasswordConfirm,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [isError, setIsError] =
    useState(false);

 useEffect(() => {
  let mounted = true;

  const checkSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!mounted) {
      return;
    }

    if (session) {
      router.replace("/");
      router.refresh();
    }
  };

  void checkSession();

  return () => {
    mounted = false;
  };
}, [router, supabase]);
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setMessage("");
    setIsError(false);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage("이메일을 입력해 주세요.");
      setIsError(true);
      return;
    }

    if (password.length < 6) {
      setMessage(
        "비밀번호는 6자 이상 입력해 주세요.",
      );
      setIsError(true);
      return;
    }

    if (
      mode === "signup" &&
      password !== passwordConfirm
    ) {
      setMessage(
        "비밀번호가 일치하지 않아요.",
      );
      setIsError(true);
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error } =
          await supabase.auth.signInWithPassword(
            {
              email: trimmedEmail,
              password,
            },
          );

        if (error) {
          throw error;
        }

        router.replace("/");
        router.refresh();
        return;
      }

      const { data, error } =
        await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error(
          "회원가입은 완료됐지만 로그인 세션이 생성되지 않았어요. Supabase에서 이메일 확인 설정이 꺼져 있는지 확인해 주세요.",
        );
      }

      router.replace("/onboarding");
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "로그인 처리 중 오류가 발생했어요.";

      setMessage(
        translateAuthError(errorMessage),
      );
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (
    nextMode: AuthMode,
  ) => {
    setMode(nextMode);
    setMessage("");
    setIsError(false);
    setPassword("");
    setPasswordConfirm("");
  };

  return (
    <main className="login-page">
      <section className="login-container">
        <div className="login-visual">
          <div className="login-logo">
            <span>초롱이와</span>
            <strong>
              같이 쓰는 가계부
            </strong>
          </div>

          <div className="login-dog-wrap">
            <div className="login-speech">
              우리 같이
              <br />
              알뜰하게 써봐요!
            </div>

            <Image
              src="/chorong-mint-collar-no-charm-v2.png"
              alt="초롱이"
              width={220}
              height={220}
              priority
            />
          </div>
        </div>

        <div className="login-card">
          <div className="login-tabs">
            <button
              type="button"
              className={
                mode === "login"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeMode("login")
              }
              disabled={loading}
            >
              로그인
            </button>

            <button
              type="button"
              className={
                mode === "signup"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeMode("signup")
              }
              disabled={loading}
            >
              회원가입
            </button>
          </div>

          <form
            className="login-form"
            onSubmit={handleSubmit}
          >
            <label>
              이메일
              <input
                type="email"
                value={email}
                placeholder="example@email.com"
                autoComplete="email"
                disabled={loading}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              비밀번호
              <input
                type="password"
                value={password}
                placeholder="6자 이상 입력"
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                disabled={loading}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
              />
            </label>

            {mode === "signup" && (
              <label>
                비밀번호 확인
                <input
                  type="password"
                  value={passwordConfirm}
                  placeholder="비밀번호 다시 입력"
                  autoComplete="new-password"
                  disabled={loading}
                  onChange={(event) =>
                    setPasswordConfirm(
                      event.target.value,
                    )
                  }
                />
              </label>
            )}

            {message && (
              <p
                className={
                  isError
                    ? "login-message error"
                    : "login-message success"
                }
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading
                ? "처리 중..."
                : mode === "login"
                  ? "로그인"
                  : "회원가입"}
            </button>
          </form>

          <p className="login-description">
            둘만의 소비와 정산 내역을
            <br />
            안전하게 기록해 보세요.
          </p>
        </div>
      </section>
    </main>
  );
}

function translateAuthError(
  message: string,
) {
  const normalizedMessage =
    message.toLowerCase();

  if (
    normalizedMessage.includes(
      "invalid login credentials",
    )
  ) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }

  if (
    normalizedMessage.includes(
      "user already registered",
    ) ||
    normalizedMessage.includes(
      "already been registered",
    )
  ) {
    return "이미 가입된 이메일이에요.";
  }

  if (
    normalizedMessage.includes(
      "password should be at least",
    )
  ) {
    return "비밀번호는 6자 이상이어야 해요.";
  }

  if (
    normalizedMessage.includes(
      "email not confirmed",
    )
  ) {
    return "Supabase에서 이메일 확인 설정을 꺼 주세요.";
  }

  return message;
}