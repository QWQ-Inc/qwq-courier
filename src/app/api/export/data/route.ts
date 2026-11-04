import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/permissions";
import { exportAllData } from "@/lib/data-io";

// 导出全站数据为 JSON：/api/export/data?logs=1 包含日志。仅 OWNER/ADMIN(system 权限)。
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "system")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const includeLogs = new URL(req.url).searchParams.get("logs") === "1";
  const bundle = await exportAllData(includeLogs);
  const body = JSON.stringify(bundle);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="qwq-courier-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
