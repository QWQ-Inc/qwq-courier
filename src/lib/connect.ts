import "server-only";
import { createHash } from "crypto";
import { getSystemConfig } from "@/lib/system-config";

// 外部平台「一键连接」(OAuth 2.0 授权码 + PKCE) 公共逻辑。

export const CONNECT_SCOPES = ["send", "templates:read", "groups:read"] as const;

/** 对外可见的应用根地址：系统设置 appUrl > x-forwarded 头 > host */
export async function getPublicBase(req: Request): Promise<string> {
  try {
    const { appUrl } = await getSystemConfig();
    let configured = (appUrl || "").trim().replace(/\/+$/, "");
    if (configured) {
      if (!/^https?:\/\//i.test(configured)) configured = `https://${configured}`;
      return configured;
    }
  } catch {
    /* ignore */
  }
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

/** sha256 十六进制 */
export function sha256hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** base64url(sha256(verifier))，用于 PKCE S256 校验 */
export function pkceChallengeOf(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * 校验 redirect_uri：必须 https；本机 http://localhost 或 http://127.0.0.1 例外（便于开发）；
 * 不得带 `#` 片段。合法返回规范化后的字符串，非法返回 null。
 */
export function validateRedirectUri(raw: string): string | null {
  const uri = (raw || "").trim();
  if (!uri || uri.includes("#")) return null;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return null;
  }
  const isLocal =
    u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.protocol === "https:") return uri;
  if (u.protocol === "http:" && isLocal) return uri;
  return null;
}

/** 回跳地址：拼接 query 到 redirect_uri（已带 ? 或无都兼容） */
export function appendQuery(redirectUri: string, params: Record<string, string>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// ---------- 简单内存限速（每 IP 每分钟 N 次）----------
const buckets = new Map<string, number[]>();

export function rateLimited(bucket: string, ip: string, limit: number, windowMs = 60_000): boolean {
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return true;
  }
  arr.push(now);
  buckets.set(key, arr);
  return false;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
