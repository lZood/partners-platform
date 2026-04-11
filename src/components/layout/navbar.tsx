"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchModal } from "@/components/layout/search-modal";
import {
  Search,
  Bell,
  FileText,
  CreditCard,
  Wallet,
  UserPlus,
  DollarSign,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  type AppNotification,
} from "@/actions/notifications";
import { displayName } from "@/lib/utils";

interface NavbarProps {
  userName?: string;
  userRole?: string;
  partnerName?: string;
  userId?: string;
  unreadCount?: number;
}

const notifIcons: Record<string, typeof Bell> = {
  report_generated: FileText,
  payment_registered: CreditCard,
  payment_received: Wallet,
  user_assigned: UserPlus,
  concept_added: DollarSign,
};

const notifColors: Record<string, string> = {
  report_generated: "text-blue-500",
  payment_registered: "text-green-500",
  payment_received: "text-emerald-500",
  user_assigned: "text-amber-500",
  concept_added: "text-violet-500",
};

export function Navbar({
  userName = "Admin",
  userRole = "admin",
  partnerName = "Partner",
  userId = "",
  unreadCount = 0,
}: NavbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [localUnread, setLocalUnread] = useState(unreadCount);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const openPanel = async () => {
    setPanelOpen(true);
    if (notifications.length === 0) {
      setLoadingNotifs(true);
      const data = await getNotifications(userId, 15);
      setNotifications(data);
      setLoadingNotifs(false);
    }
  };

  const handleMarkRead = async (notif: AppNotification) => {
    if (notif.isRead) return;
    await markAsRead(notif.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    setLocalUnread((c) => Math.max(0, c - 1));
    if (notif.link) {
      setPanelOpen(false);
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setLocalUnread(0);
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}sem`;
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-end bg-background px-4 lg:px-6">
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-[18px] w-[18px]" />
        </Button>

        {/* Notifications bell */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground"
            onClick={() => (panelOpen ? setPanelOpen(false) : openPanel())}
          >
            <Bell className="h-[18px] w-[18px]" />
            {localUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {localUnread > 99 ? "99+" : localUnread}
              </span>
            )}
          </Button>

          {/* Notification panel */}
          {panelOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPanelOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-xl border bg-card shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Notificaciones</h3>
                  {localUnread > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Marcar todas leidas
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-[400px] overflow-y-auto">
                  {loadingNotifs ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Cargando...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Bell className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">Sin notificaciones</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const Icon = notifIcons[notif.type] ?? Bell;
                      const color =
                        notifColors[notif.type] ?? "text-muted-foreground";
                      return (
                        <div
                          key={notif.id}
                          onClick={() => handleMarkRead(notif)}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                            !notif.isRead ? "bg-primary/5" : ""
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              !notif.isRead ? "bg-primary/10" : "bg-muted"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 ${
                                !notif.isRead ? color : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className={`text-xs leading-relaxed ${
                                  !notif.isRead
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {notif.title}
                              </p>
                              {!notif.isRead && (
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                            {timeAgo(notif.createdAt)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
