import { redirect } from "next/navigation";
import { Link2, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/permissions";
import { getI18n } from "@/lib/i18n/server";
import { validateRedirectUri } from "@/lib/connect";
import { METHOD_KEYS } from "@/lib/constants";
import { AuthorizeForm } from "@/components/connect/authorize-form";

type SP = {
  client_name?: string;
  redirect_uri?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-card p-7 shadow-xl ring-1 ring-slate-200/70">
        {children}
      </div>
    </div>
  );
}

export default async function ConnectAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const { dict } = await getI18n();
  const t = dict.connect;

  // 1) 校验请求本身（失败只显示错误页，绝不回跳）
  const redirectUri = validateRedirectUri(sp.redirect_uri ?? "");
  const okRequest =
    !!redirectUri && !!sp.code_challenge && sp.code_challenge_method === "S256";
  if (!okRequest) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-red-600">
          <ShieldAlert className="h-5 w-5" />
          <h1 className="text-base font-semibold">{t.invalidTitle}</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">{t.invalidDesc}</p>
      </Shell>
    );
  }

  // 2) 未登录 → 走现有登录，登录后回到本页（带完整参数）
  const user = await getCurrentUser();
  if (!user) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, v as string);
    redirect(`/login?next=${encodeURIComponent(`/connect/authorize?${qs.toString()}`)}`);
  }

  // 3) 无 API 管理权限 → 显示无权限
  if (!canAccessFeature(user, "apiKeys")) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-slate-800">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h1 className="text-base font-semibold">{t.noPermTitle}</h1>
        </div>
        <p className="mt-2 text-sm text-slate-500">{t.noPermDesc}</p>
      </Shell>
    );
  }

  const clientName = (sp.client_name ?? "").slice(0, 120) || "External";
  let host = redirectUri!;
  try {
    host = new URL(redirectUri!).host;
  } catch {
    /* ignore */
  }

  return (
    <Shell>
      <div className="mb-5 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
          <Link2 className="h-6 w-6" />
        </div>
        <h1 className="mt-3 text-lg font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
      </div>

      <AuthorizeForm
        clientName={clientName}
        host={host}
        scope={sp.scope ?? ""}
        redirectUri={redirectUri!}
        state={sp.state ?? ""}
        codeChallenge={sp.code_challenge!}
        methodKeys={METHOD_KEYS as unknown as string[]}
        defaultKeyName={`${clientName} 连接`}
      />
    </Shell>
  );
}
