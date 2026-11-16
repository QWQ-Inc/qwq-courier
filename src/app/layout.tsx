import type { Metadata } from "next";
import "./globals.css";
import { getI18n } from "@/lib/i18n/server";
import { LOCALE_HTML_LANG } from "@/lib/i18n/config";
import { I18nProvider } from "@/components/i18n-provider";

export const metadata: Metadata = {
  title: "QWQCourier · 消息分发",
  description: "QWQCourier —— 统一通知消息分发平台 / Unified notification platform",
};

// 首屏前按 localStorage / 系统设置定主题，避免深浅色闪烁
const themeInit = `(function(){try{var p=localStorage.getItem('theme');var d=p?p==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { locale, dict } = await getI18n();
  return (
    <html lang={LOCALE_HTML_LANG[locale]} className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
