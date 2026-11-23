"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";
import { useI18n } from "../i18n-provider";
import { inputCls } from "../ui/field";
import { useFormValues } from "../ui/use-form-values";
import {
  approveConnectAction,
  denyConnectAction,
  type ConnectState,
} from "@/lib/actions/connect";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function AuthorizeForm({
  clientName,
  host,
  scope,
  redirectUri,
  state,
  codeChallenge,
  methodKeys,
  defaultKeyName,
}: {
  clientName: string;
  host: string;
  scope: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  methodKeys: string[];
  defaultKeyName: string;
}) {
  const { dict } = useI18n();
  const t = dict.connect;
  const [methods, setMethods] = useState<string[]>([]);
  const { bind } = useFormValues({ key_name: defaultKeyName });
  const [st, action, pending] = useActionState<ConnectState, FormData>(approveConnectAction, undefined);

  const toggle = (m: string) =>
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const hidden = (
    <>
      <input type="hidden" name="client_name" value={clientName} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="code_challenge" value={codeChallenge} />
      <input type="hidden" name="code_challenge_method" value="S256" />
    </>
  );

  return (
    <div className="space-y-4">
      {/* 谁在申请 + 回跳到哪 */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">{t.clientLabel}</span>
          <span className="font-medium text-slate-900">{clientName}</span>
        </div>
        <div className="mt-1.5 flex justify-between gap-3">
          <span className="text-slate-500">{t.callbackLabel}</span>
          <code className="font-medium text-indigo-600">{host}</code>
        </div>
        {scope && (
          <div className="mt-1.5 flex justify-between gap-3">
            <span className="text-slate-500">{t.scopesLabel}</span>
            <span className="text-right text-xs text-slate-500">{scope}</span>
          </div>
        )}
      </div>

      <form action={action} className="space-y-4">
        {hidden}

        {/* 选择允许的分发方式 */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">{t.methodsLabel}</p>
          <p className="mb-2 text-xs text-slate-400">{t.methodsHint}</p>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
            {methodKeys.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="methods"
                  value={m}
                  checked={methods.includes(m)}
                  onChange={() => toggle(m)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {dict.methods[m as keyof Dictionary["methods"]] ?? m}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t.keyNameLabel}</label>
          <input name="key_name" {...bind("key_name")} className={inputCls} />
        </div>

        {st?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{st.error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={pending || methods.length === 0}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {pending ? t.approving : t.approve}
          </button>
        </div>
      </form>

      {/* 拒绝：独立表单，直接回跳 access_denied */}
      <form action={denyConnectAction}>
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          {t.deny}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400">{t.footerNote}</p>
    </div>
  );
}
