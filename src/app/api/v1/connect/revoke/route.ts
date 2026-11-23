import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateApiKey } from "@/lib/api-auth";

// 撤销：用该密钥自身的 Bearer 调用，停用这枚密钥。外部平台解除连接时调用。
export async function POST(req: Request) {
  const auth = await authenticateApiKey(req);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  await prisma.apiKey.update({ where: { id: auth.key.id }, data: { enabled: false } });
  return NextResponse.json({ success: true });
}
