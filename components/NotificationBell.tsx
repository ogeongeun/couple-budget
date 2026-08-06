"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import "./NotificationBell.css";

const supabase = createClient();

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 8.5C18 5.46 15.54 3 12.5 3C9.46 3 7 5.46 7 8.5V11.2C7 12.68 6.46 14.11 5.48 15.22L4.5 16.33C4.03 16.86 4.41 17.7 5.12 17.7H19.88C20.59 17.7 20.97 16.86 20.5 16.33L19.52 15.22C18.54 14.11 18 12.68 18 11.2V8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M10.2 20C10.62 20.62 11.41 21 12.5 21C13.59 21 14.38 20.62 14.8 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function NotificationBell() {
  const router = useRouter();

  const [userId, setUserId] =
    useState<string | null>(null);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const loadUnreadCount =
    useCallback(async (id: string) => {
      const {
        count,
        error,
      } = await supabase
        .from("notifications")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("recipient_id", id)
        .eq("is_read", false);

      if (error) {
        console.error(
          "알림 개수 조회 오류:",
          error,
        );
        return;
      }

      setUnreadCount(count ?? 0);
    }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        return;
      }

      setUserId(user.id);
      await loadUnreadCount(user.id);
    };

    void initialize();

    return () => {
      mounted = false;
    };
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(
        `notification-bell-${userId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          setUnreadCount(
            (current) => current + 1,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadUnreadCount, userId]);

  return (
    <button
      type="button"
      className="notification-bell"
      aria-label="알림 보기"
      onClick={() =>
        router.push("/notifications")
      }
    >
      <span className="notification-bell-icon">
        <BellIcon />
      </span>

      {unreadCount > 0 && (
        <span className="notification-count">
          {unreadCount > 99
            ? "99+"
            : unreadCount}
        </span>
      )}
    </button>
  );
}