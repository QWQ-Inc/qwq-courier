import "server-only";
import { prisma } from "@/lib/db";

// 全站数据导入导出（迁移/备份）。
// ⚠️ 导出内容含渠道凭证、API 密钥哈希、用户密码哈希等敏感数据，务必安全保管。

export const EXPORT_VERSION = 1;

export type ExportBundle = {
  app: "qwq-courier";
  version: number;
  exportedAt: string;
  includeLogs: boolean;
  data: Record<string, unknown[]>;
};

const DATE_FIELDS = ["createdAt", "updatedAt", "lastUsedAt"];

function reviveDates<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const f of DATE_FIELDS) {
    if (typeof out[f] === "string") out[f] = new Date(out[f] as string);
  }
  return out as T;
}

/** 导出全站数据。includeLogs=false 时不含调用/操作日志（量大） */
export async function exportAllData(includeLogs: boolean): Promise<ExportBundle> {
  const [users, folders, groups, channels, templates, apiKeys, settings] = await Promise.all([
    prisma.user.findMany(),
    prisma.folder.findMany(),
    prisma.channelGroup.findMany(),
    prisma.channel.findMany(),
    prisma.template.findMany(),
    prisma.apiKey.findMany(),
    prisma.setting.findMany(),
  ]);

  const data: Record<string, unknown[]> = {
    users,
    folders,
    channelGroups: groups,
    channels,
    templates,
    apiKeys,
    settings,
  };

  if (includeLogs) {
    const [callLogs, auditLogs] = await Promise.all([
      prisma.callLog.findMany(),
      prisma.auditLog.findMany(),
    ]);
    data.callLogs = callLogs;
    data.auditLogs = auditLogs;
  }

  return {
    app: "qwq-courier",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    includeLogs,
    data,
  };
}

export type ImportResult = {
  ok: boolean;
  error?: string;
  imported?: Record<string, number>;
  skipped?: Record<string, number>;
};

function rows(bundle: ExportBundle, key: string): Record<string, unknown>[] {
  const v = bundle.data?.[key];
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}

/** 逐条 upsert，返回成功与跳过计数 */
async function upsertRows(
  key: string,
  list: Record<string, unknown>[],
  idField: string,
  doUpsert: (row: Record<string, unknown>) => Promise<void>,
  imported: Record<string, number>,
  skipped: Record<string, number>,
) {
  imported[key] = 0;
  skipped[key] = 0;
  for (const raw of list) {
    if (!raw || raw[idField] == null) {
      skipped[key]++;
      continue;
    }
    try {
      await doUpsert(reviveDates(raw));
    } catch {
      skipped[key]++;
    }
  }
}

/** 导入全站数据。replace=true 时先清空现有数据（危险）。按外键依赖顺序、用户自引用分两趟。 */
export async function importAllData(
  bundle: ExportBundle,
  opts: { replace?: boolean } = {},
): Promise<ImportResult> {
  if (!bundle || bundle.app !== "qwq-courier" || !bundle.data) {
    return { ok: false, error: "文件格式不对，不是 qwq-courier 导出文件 / not a qwq-courier export" };
  }

  const imported: Record<string, number> = {};
  const skipped: Record<string, number> = {};

  if (opts.replace) {
    // 反依赖顺序清空
    await prisma.auditLog.deleteMany({});
    await prisma.callLog.deleteMany({});
    await prisma.apiKey.deleteMany({});
    await prisma.template.deleteMany({});
    await prisma.channel.deleteMany({});
    await prisma.channelGroup.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.setting.deleteMany({});
  }

  // 1) Settings
  await upsertRows(
    "settings",
    rows(bundle, "settings"),
    "key",
    (r) =>
      prisma.setting
        .upsert({ where: { key: String(r.key) }, create: r as never, update: r as never })
        .then(() => undefined),
    imported,
    skipped,
  );

  // 2) Folders
  await upsertRows(
    "folders",
    rows(bundle, "folders"),
    "id",
    (r) =>
      prisma.folder
        .upsert({ where: { id: String(r.id) }, create: r as never, update: r as never })
        .then(() => undefined),
    imported,
    skipped,
  );

  // 3) Users —— 第一趟不带 parentId（自引用，防 FK）
  const userList = rows(bundle, "users");
  await upsertRows(
    "users",
    userList,
    "id",
    (r) => {
      const base = { ...r, parentId: null };
      return prisma.user
        .upsert({ where: { id: String(r.id) }, create: base as never, update: base as never })
        .then(() => undefined);
    },
    imported,
    skipped,
  );
  // 第二趟补 parentId
  for (const r of userList) {
    if (r?.id && r.parentId) {
      await prisma.user
        .update({ where: { id: String(r.id) }, data: { parentId: String(r.parentId) } })
        .catch(() => {});
    }
  }

  // 4) ChannelGroups
  await upsertRows(
    "channelGroups",
    rows(bundle, "channelGroups"),
    "id",
    (r) =>
      prisma.channelGroup
        .upsert({ where: { id: String(r.id) }, create: r as never, update: r as never })
        .then(() => undefined),
    imported,
    skipped,
  );

  // 5) Channels
  await upsertRows(
    "channels",
    rows(bundle, "channels"),
    "id",
    (r) =>
      prisma.channel
        .upsert({ where: { id: String(r.id) }, create: r as never, update: r as never })
        .then(() => undefined),
    imported,
    skipped,
  );

  // 6) Templates
  await upsertRows(
    "templates",
    rows(bundle, "templates"),
    "id",
    (r) =>
      prisma.template
        .upsert({ where: { id: String(r.id) }, create: r as never, update: r as never })
        .then(() => undefined),
    imported,
    skipped,
  );

  // 7) ApiKeys
  await upsertRows(
    "apiKeys",
    rows(bundle, "apiKeys"),
    "id",
    (r) =>
      prisma.apiKey
        .upsert({ where: { id: String(r.id) }, create: r as never, update: r as never })
        .then(() => undefined),
    imported,
    skipped,
  );

  // 8) 日志（可选，存在才导）
  if (rows(bundle, "callLogs").length) {
    await upsertRows(
      "callLogs",
      rows(bundle, "callLogs"),
      "id",
      (r) =>
        prisma.callLog
          .upsert({ where: { id: String(r.id) }, create: r as never, update: r as never })
          .then(() => undefined),
      imported,
      skipped,
    );
  }
  if (rows(bundle, "auditLogs").length) {
    await upsertRows(
      "auditLogs",
      rows(bundle, "auditLogs"),
      "id",
      (r) =>
        prisma.auditLog
          .upsert({ where: { id: String(r.id) }, create: r as never, update: r as never })
          .then(() => undefined),
      imported,
      skipped,
    );
  }

  return { ok: true, imported, skipped };
}
