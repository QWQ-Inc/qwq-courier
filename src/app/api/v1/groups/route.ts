import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey, keyAllowsMethod } from "@/lib/api-auth";

// 读取分组（只读）：只列当前密钥有权限的 method 下、已启用的分组。不返回渠道明细/凭证。
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const key = auth.key;

  const rows = await prisma.channelGroup.findMany({
    where: { enabled: true },
    orderBy: [{ method: "asc" }, { createdAt: "asc" }],
  });

  const groups = rows
    .filter((g) => keyAllowsMethod(key, g.method))
    .map((g) => ({ code: g.code, name: g.name, method: g.method, strategy: g.strategy }));

  return NextResponse.json({ success: true, groups });
}
