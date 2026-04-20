import "./globals.css";

import type { ReactNode } from "react";

import { TelegramAuthBridge } from "@/app/components/telegram-auth-bridge";

export const metadata = {
  title: "Business Diagnosis Mini App",
  description: "MVP v0.1 for business diagnosis",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <TelegramAuthBridge />
        {children}
      </body>
    </html>
  );
}
