import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { APP_VERSION } from "@/lib/version";

// 查看当前密钥：供外部平台保存连接后自检。
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const k = auth.key;

  let scopes: string[] = [];
  try {
    scopes = JSON.parse(k.scopes || "[]");
  } catch {
    scopes = [];
  }

  return NextResponse.json({
    success: true,
    key: {
      id: k.id,
      name: k.name,
      type: k.type,
      scopeType: k.scopeType,
      scopes,
      prefix: k.keyPrefix,
      createdAt: k.createdAt.toISOString(),
      source: k.connectClient ?? null,
    },
    instance: { version: APP_VERSION },
  });
}
