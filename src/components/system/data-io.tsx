"use client";

import { useActionState, useState } from "react";
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { importDataAction, type ImportState } from "@/lib/actions/data-io";

export function DataIo() {
  const { dict } = useI18n();
  const t = dict.system.dataio;
  const [logs, setLogs] = useState(false);
  const [state, action, pending] = useActionState<ImportState, FormData>(importDataAction, undefined);

  const exportHref = `/api/export/data${logs ? "?logs=1" : ""}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{t.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{t.desc}</p>

      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t.warn}
      </p>

      {/* 导出 */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-800">{t.exportTitle}</h3>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={logs}
            onChange={(e) => setLogs(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          {t.includeLogs}
        </label>
        <a
          href={exportHref}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Download className="h-4 w-4" />
          {t.exportBtn}
        </a>
      </div>

      {/* 导入 */}
      <form action={action} className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-medium text-slate-800">{t.importTitle}</h3>
        <p className="mt-1 text-xs text-slate-500">{t.importHint}</p>

        <input
          type="file"
          name="file"
          accept="application/json,.json"
          required
          className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />

        <label className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          <input type="checkbox" name="replace" className="mt-0.5 h-4 w-4 rounded border-red-300" />
          <span>
            <span className="font-medium">{t.replace}</span>
            <span className="mt-0.5 block text-xs text-red-500">{t.replaceHint}</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={pending}
          onClick={(e) => {
            if (!confirm(t.confirmImport)) e.preventDefault();
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {pending ? t.importing : t.importBtn}
        </button>

        {state && !state.ok && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}
        {state && state.ok && (
          <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <p className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {t.importDone}
            </p>
            <p className="mt-1 text-xs">
              {Object.entries(state.imported ?? {})
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </p>
            {Object.values(state.skipped ?? {}).some((n) => n > 0) && (
              <p className="mt-0.5 text-xs text-amber-600">
                {t.skipped}
                {Object.entries(state.skipped ?? {})
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
