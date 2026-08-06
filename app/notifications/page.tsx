"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import BottomNavigation from "@/components/BottomNavigation";
import { createClient } from "@/lib/supabase/client";

import "./notifications.css";

const supabase = createClient();

type NotificationRecord = {
  id: string;
  recipient_id: string;
  actor_id: string;
  expense_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

function formatNotificationTime(
  createdAt: string,
) {
  const date = new Date(createdAt);
  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  const minutes = Math.floor(
    difference / 60000,
  );

  if (minutes < 1) {
    return "방금 전";
  }

  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.floor(
    minutes / 60,
  );

  if (hours < 24) {
    return `${hours}시간 전`;
  }

  return date.toLocaleDateString(
    "ko-KR",
    {
      month: "long",
      day: "numeric",
    },
  );
}

export default function NotificationsPage() {
  const router = useRouter();

  const [userId, setUserId] =
    useState<string | null>(null);

  const [
    notifications,
    setNotifications,
  ] = useState<NotificationRecord[]>([]);

  const [loading, setLoading] =
    useState(true);

  const loadNotifications =
    useCallback(async (id: string) => {
      const {
        data,
        error,
      } = await supabase
        .from("notifications")
        .select(`
          id,
          recipient_id,
          actor_id,
          expense_id,
          type,
          title,
          message,
          is_read,
          created_at
        `)
        .eq("recipient_id", id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100);

      if (error) {
        console.error(
          "알림 조회 오류:",
          error,
        );

        setLoading(false);
        return;
      }

      setNotifications(
        (data as NotificationRecord[]) ??
          [],
      );

      setLoading(false);
    }, []);

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      await loadNotifications(user.id);
    };

    void initialize();
  }, [loadNotifications, router]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(
        `notifications-page-${userId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification =
            payload.new as NotificationRecord;

          setNotifications(
            (current) => [
              newNotification,
              ...current,
            ],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel,
      );
    };
  }, [userId]);

  const markAsRead = async (
    notificationId: string,
  ) => {
    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("id", notificationId);

    if (error) {
      console.error(
        "알림 읽음 처리 오류:",
        error,
      );

      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id ===
        notificationId
          ? {
              ...notification,
              is_read: true,
            }
          : notification,
      ),
    );
  };

  const markAllAsRead = async () => {
    if (!userId) {
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
      })
      .eq("recipient_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error(
        "전체 읽음 처리 오류:",
        error,
      );

      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      })),
    );
  };

  return (
    <main className="notifications-page">
      <header className="notifications-header">
        <button
          type="button"
          className="notifications-back"
          onClick={() =>
            router.back()
          }
          aria-label="뒤로가기"
        >
          ←
        </button>

        <h1>알림</h1>

        <button
          type="button"
          className="notifications-read-all"
          onClick={markAllAsRead}
        >
          모두 읽음
        </button>
      </header>

      {loading ? (
        <div className="notifications-state">
          알림을 불러오고 있어요...
        </div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          <span>🔔</span>

          <strong>
            아직 알림이 없어요
          </strong>

          <p>
            소비가 등록되면
            여기에 알려드릴게요.
          </p>
        </div>
      ) : (
        <section className="notifications-list">
          {notifications.map(
            (notification) => (
              <button
                type="button"
                key={notification.id}
                className={
                  notification.is_read
                    ? "notification-item"
                    : "notification-item unread"
                }
                onClick={() =>
                  markAsRead(
                    notification.id,
                  )
                }
              >
                <span className="notification-type-icon">
                  {notification.type ===
                  "treat"
                    ? "🎁"
                    : "💸"}
                </span>

                <span className="notification-copy">
                  <strong>
                    {
                      notification.title
                    }
                  </strong>

                  <p>
                    {
                      notification.message
                    }
                  </p>

                  <small>
                    {formatNotificationTime(
                      notification.created_at,
                    )}
                  </small>
                </span>

                {!notification.is_read && (
                  <i />
                )}
              </button>
            ),
          )}
        </section>
      )}

      <BottomNavigation active="home" />
    </main>
  );
}