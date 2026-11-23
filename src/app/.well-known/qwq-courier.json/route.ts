import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { getPublicBase, CONNECT_SCOPES } from "@/lib/connect";
import { METHOD_KEYS } from "@/lib/constants";

// 发现文档（公开、只读）：供外部平台发现「一键连接」入口。不返回任何业务数据。
export async function GET(req: Request) {
  const base = await getPublicBase(req);
  const body = {
    product: "qwq-courier",
    version: APP_VERSION,
    apiBase: `${base}/api/v1`,
    connect: {
      authorizeUrl: `${base}/connect/authorize`,
      tokenUrl: `${base}/api/v1/connect/token`,
      scopes: CONNECT_SCOPES,
    },
    methods: METHOD_KEYS,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "max-age=300", "Content-Type": "application/json; charset=utf-8" },
  });
}
