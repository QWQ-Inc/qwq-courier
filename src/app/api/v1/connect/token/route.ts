import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateApiKey, encryptSecret } from "@/lib/hash";
import { logOperation } from "@/lib/audit";
import {
  getPublicBase,
  sha256hex,
  pkceChallengeOf,
  rateLimited,
  clientIp,
} from "@/lib/connect";

function invalidGrant() {
  return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
}

// 用授权码 + PKCE code_verifier 换取一枚受限密钥。
export async function POST(req: Request) {
  if (rateLimited("connect-token", clientIp(req), 20)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 兼容 JSON 与表单
  let input: Record<string, string> = {};
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = (await req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j ?? {})) if (v != null) input[k] = String(v);
    } else {
      const f = await req.formData();
      f.forEach((v, k) => (input[k] = String(v)));
    }
  } catch {
    return invalidGrant();
  }

  if (input.grant_type !== "authorization_code" || !input.code || !input.redirect_uri || !input.code_verifier) {
    return invalidGrant();
  }

  const rec = await prisma.connectCode.findUnique({ where: { codeHash: sha256hex(input.code) } });
  if (!rec) return invalidGrant();

  // 无论成败，该码一经尝试即作废（单次使用）
  const invalidate = () => prisma.connectCode.delete({ where: { id: rec.id } }).catch(() => {});

  if (rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
    await invalidate();
    return invalidGrant();
  }
  if (rec.redirectUri !== input.redirect_uri) {
    await invalidate();
    return invalidGrant();
  }
  if (pkceChallengeOf(input.code_verifier) !== rec.codeChallenge) {
    await invalidate();
    return invalidGrant();
  }

  // 校验通过：以批准人身份签发受限生产密钥
  let methods: string[] = [];
  try {
    methods = JSON.parse(rec.scopes || "[]");
  } catch {
    methods = [];
  }

  const gen = generateApiKey("PRODUCTION");
  const key = await prisma.apiKey.create({
    data: {
      userId: rec.approverId,
      name: rec.keyName,
      type: "PRODUCTION",
      keyPrefix: gen.prefix,
      keyHash: gen.hash,
      keyEnc: encryptSecret(gen.raw), // 受限密钥加密留存，可在后台重复查看
      scopeType: "SCOPED",
      scopes: JSON.stringify(methods),
      allowedIps: "[]",
      allowIam: false,
      connectClient: rec.clientName,
    },
  });

  await prisma.connectCode.delete({ where: { id: rec.id } }).catch(() => {});

  const approver = await prisma.user.findUnique({ where: { id: rec.approverId } });
  if (approver) {
    await logOperation(
      approver,
      "apikey.create",
      `外部平台连接「${rec.clientName}」· 方式 ${methods.join("/") || "无"}`,
    );
  }

  const base = await getPublicBase(req);
  return NextResponse.json({
    api_key: gen.raw,
    key_id: key.id,
    scopes: methods,
    api_base: `${base}/api/v1`,
  });
}
