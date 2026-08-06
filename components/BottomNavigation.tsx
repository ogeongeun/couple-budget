"use client";

import { useRouter } from "next/navigation";
import "./BottomNavigation.css";

type BottomNavigationProps = {
  active:
    | "home"
    | "calendar"
    | "statistics"
    | "profile";
};

export default function BottomNavigation({
  active,
}: BottomNavigationProps) {
  const router = useRouter();

  return (
    <nav className="bottom-navigation">
      <button
        type="button"
        className={
          active === "home" ? "active" : ""
        }
        onClick={() => router.push("/")}
      >
        <span>🏠</span>
        홈
      </button>

      <button
        type="button"
        className={
          active === "calendar" ? "active" : ""
        }
        onClick={() =>
          router.push("/calendar")
        }
      >
        <span>🗓️</span>
        캘린더
      </button>

      <button
        type="button"
        className={
          active === "statistics"
            ? "active"
            : ""
        }
        onClick={() =>
          router.push("/statistics")
        }
      >
        <span>📊</span>
        통계
      </button>

      <button
        type="button"
        className={
          active === "profile"
            ? "active"
            : ""
        }
        onClick={() =>
          router.push("/profile")
        }
      >
        <span>👤</span>
        마이
      </button>
    </nav>
  );
}