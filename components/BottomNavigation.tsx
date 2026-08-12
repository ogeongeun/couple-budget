"use client";

import { useRouter } from "next/navigation";
import "./BottomNavigation.css";

type NavigationId = "home" | "calendar" | "statistics" | "profile";

type BottomNavigationProps = {
  active: NavigationId;
};

export default function BottomNavigation({ active }: BottomNavigationProps) {
  const router = useRouter();
  const items: Array<{
    id: NavigationId;
    label: string;
    path: string;
    icon: string;
  }> = [
    { id: "home", label: "홈", path: "/", icon: "🏠" },
    { id: "calendar", label: "캘린더", path: "/calendar", icon: "🗓️" },
    { id: "statistics", label: "통계", path: "/statistics", icon: "📊" },
    { id: "profile", label: "마이", path: "/profile", icon: "👤" },
  ];

  return (
    <nav className="bottom-navigation" aria-label="주요 메뉴">
      {items.map((item) => (
        <button
          type="button"
          className={active === item.id ? "active" : ""}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => router.push(item.path)}
          key={item.id}
        >
          <span className="bottom-navigation-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
