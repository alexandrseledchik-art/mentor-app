"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export function TelegramAuthBridge() {
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) {
      return;
    }

    didRun.current = true;

    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData;

    webApp?.ready?.();
    webApp?.expand?.();

    if (!initData) {
      return;
    }

    void fetch("/api/auth/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initData }),
    })
      .then((response) => {
        if (response.ok) {
          router.refresh();
        } else {
          console.error("TELEGRAM MINI APP AUTH FAILED", response.status);
        }
      })
      .catch((error) => {
        console.error("TELEGRAM MINI APP AUTH ERROR", error);
      });
  }, [router]);

  return null;
}
