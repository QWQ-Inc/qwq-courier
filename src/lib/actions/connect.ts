"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/permissions";
import { getLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { METHOD_KEYS, type MethodKey } from "@/lib/constants";
import {
  validateRedirectUri,
  appendQuery,
  sha256hex,
  rateLimited,
} from "@/lib/connect";

export type ConnectState = { error?: string } | undefined;

function ipFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

/** 批准连接：生成一次性授权码并 302 回跳到 redirect_uri?code=&state= */
export async function approveConnectAction(_prev: ConnectState, fd: FormData): Promise<ConnectState> {
  const t = getDictionary(await getLocale()).connect;
  const h = await headers();
  if (rateLimited("connect-approve", ipFromHeaders(h), 20)) return { error: t.errRate };

  const user = await getCurrentUser();
  if (!user) return { error: t.errLogin };
  if (!canAccessFeature(user, "apiKeys")) return { error: t.errNoPerm };

  const clientName = String(fd.get("client_name") ?? "").slice(0, 120);
  const redirectUriRaw = String(fd.get("redirect_uri") ?? "");
  const state = String(fd.get("state") ?? "");
  const codeChallenge = String(fd.get("code_challenge") ?? "");
  const method = String(fd.get("code_challenge_method") ?? "");
  const keyName = (String(fd.get("key_name") ?? "").trim() || `${clientName} 连接`).slice(0, 120);
  const methods = fd
    .getAll("methods")
    .map(String)
    .filter((m) => METHOD_KEYS.includes(m as MethodKey));

  // 防御性再校验（页面已校验过）：任何不对都不回跳
  const redirectUri = validateRedirectUri(redirectUriRaw);
  if (!redirectUri || !codeChallenge || method !== "S256") return { error: t.errInvalid };
  if (methods.length === 0) return { error: t.errNoMethod };

  const code = randomBytes(32).toString("base64url");
  await prisma.connectCode.create({
    data: {
      codeHash: sha256hex(code),
      clientName: clientName || "External",
      redirectUri,
      codeChallenge,
      scopes: JSON.stringify(methods),
      keyName,
      approverId: user.id,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  redirect(appendQuery(redirectUri, state ? { code, state } : { code }));
}

/** 拒绝连接：回跳 access_denied */
export async function denyConnectAction(fd: FormData) {
  const redirectUri = validateRedirectUri(String(fd.get("redirect_uri") ?? ""));
  const state = String(fd.get("state") ?? "");
  if (!redirectUri) redirect("/");
  redirect(appendQuery(redirectUri, state ? { error: "access_denied", state } : { error: "access_denied" }));
}
