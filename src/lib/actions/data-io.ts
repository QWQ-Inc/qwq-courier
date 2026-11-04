"use server";

import { requireUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/permissions";
import { logOperation } from "@/lib/audit";
import { importAllData, type ExportBundle, type ImportResult } from "@/lib/data-io";
import { revalidatePath } from "next/cache";

export type ImportState = ImportResult | undefined;

// 导入全站数据（上传 JSON 文件）。仅 OWNER/ADMIN(system 权限)。
export async function importDataAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireUser();
  if (!canAccessFeature(user, "system")) {
    return { ok: false, error: "没有权限 / no permission" };
  }

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "请选择要导入的 JSON 文件 / choose a JSON file" };
  }
  if (file.size > 100 * 1024 * 1024) {
    return { ok: false, error: "文件过大（上限 100MB）/ file too large (max 100MB)" };
  }

  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(await file.text()) as ExportBundle;
  } catch {
    return { ok: false, error: "文件不是合法 JSON / invalid JSON" };
  }

  const replace = String(fd.get("replace") ?? "") === "on";
  const result = await importAllData(bundle, { replace });

  if (result.ok) {
    const total = Object.values(result.imported ?? {}).reduce((a, b) => a + b, 0);
    await logOperation(user, "setting.update", `导入全站数据（${total} 条${replace ? "，清空后导入" : ""}）`);
    revalidatePath("/system");
  }
  return result;
}
