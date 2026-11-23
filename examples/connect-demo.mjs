#!/usr/bin/env node
/*
 * QWQCourier「一键连接」端到端示例（模拟外部平台走完整流程）。
 * 纯 Node（18+，零依赖）。演示：发现 → PKCE → 浏览器授权 → 换取密钥 → 调用只读/发送 →（可选）撤销。
 *
 * 用法：
 *   node examples/connect-demo.mjs <实例地址> [要发送的分组编号]
 *   例：node examples/connect-demo.mjs https://courier.example.com ops-alert
 *   不传实例地址则用 http://localhost:3000。
 *
 * 脚本会打印一个「授权链接」，请在浏览器打开、用有权限的账号登录并批准；批准后浏览器
 * 回跳到本脚本起的本地回调地址，脚本自动换取受限密钥并调用接口，最后可选择撤销。
 */
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import readline from "node:readline";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");
const sendGroup = process.argv[3] || "";
const CLIENT_NAME = "Connect Demo";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const verifier = b64url(randomBytes(32)); // PKCE code_verifier
const challenge = createHash("sha256").update(verifier).digest("base64url"); // S256 challenge
const state = b64url(randomBytes(12));

async function getJson(url, token) {
  const r = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/** 起本地回调服务，返回 { code, redirectUri }（redirectUri 必须与换 token 时完全一致） */
function waitForCode(authorizeUrl, scope) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://localhost");
      if (u.pathname !== "/callback") return res.writeHead(404).end();
      const err = u.searchParams.get("error");
      const code = u.searchParams.get("code");
      const st = u.searchParams.get("state");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<meta charset=utf-8><body style="font:16px system-ui;padding:40px">${
          err ? "已拒绝，可关闭本页。" : "连接成功，回到终端查看结果，可关闭本页。"
        }</body>`,
      );
      server.close();
      if (err) return reject(new Error(`授权被拒绝：${err}`));
      if (st !== state) return reject(new Error("state 不匹配（可能的 CSRF），已中止"));
      if (!code) return reject(new Error("回调未带 code"));
      resolve({ code, redirectUri });
    });
    let redirectUri = "";
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      redirectUri = `http://localhost:${port}/callback`;
      const q = new URLSearchParams({
        client_name: CLIENT_NAME,
        redirect_uri: redirectUri,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        scope,
      });
      console.log("\n👉 在浏览器打开下面的链接，登录并批准连接：\n");
      console.log(`   ${authorizeUrl}?${q.toString()}\n`);
      console.log("（等待浏览器授权回调…）");
    });
  });
}

async function main() {
  // 1) 发现文档
  const disc = await getJson(`${base}/.well-known/qwq-courier.json`);
  if (disc.status !== 200 || disc.body.product !== "qwq-courier") {
    throw new Error(`发现文档获取失败，确认实例地址正确：${base}`);
  }
  const { authorizeUrl, tokenUrl, scopes } = disc.body.connect;
  const apiBase = disc.body.apiBase;
  console.log(`✓ 发现 ${disc.body.product} v${disc.body.version}  ·  apiBase ${apiBase}`);

  // 2) 浏览器授权，拿授权码
  const { code, redirectUri } = await waitForCode(authorizeUrl, (scopes || []).join(" "));

  // 3) 用授权码 + PKCE verifier 换取受限密钥
  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri, // 必须与发起授权时一致
      code_verifier: verifier,
    }),
  });
  const tok = await r.json().catch(() => ({}));
  if (r.status !== 200 || !tok.api_key) {
    throw new Error(`换取密钥失败（${r.status}）：${JSON.stringify(tok)}`);
  }
  const apiKey = tok.api_key;
  console.log(`\n✓ 已获得受限密钥  ${apiKey.slice(0, 16)}…  权限方式：${(tok.scopes || []).join("/")}`);

  // 4) 自检 + 读取分组
  const who = await getJson(`${apiBase}/whoami`, apiKey);
  console.log(`✓ whoami：${who.body?.key?.name}（${who.body?.key?.scopeType} ${JSON.stringify(who.body?.key?.scopes)}）`);
  const groups = await getJson(`${apiBase}/groups`, apiKey);
  console.log(`✓ 可用分组：${(groups.body?.groups || []).map((g) => `${g.code}(${g.method})`).join(", ") || "（无）"}`);

  // 5) 可选：发一条测试消息
  if (sendGroup) {
    const s = await fetch(`${apiBase}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ group: sendGroup, content: "Hello from connect-demo 👋" }),
    });
    const sb = await s.json().catch(() => ({}));
    console.log(`${s.status === 200 ? "✓" : "✗"} 发送到「${sendGroup}」：HTTP ${s.status}  ${JSON.stringify(sb)}`);
  }

  // 6) 可选：撤销（演示解除连接）
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((res) => rl.question("\n撤销这枚演示密钥吗？(y/N) ", res));
  rl.close();
  if (ans.trim().toLowerCase() === "y") {
    const rv = await fetch(`${apiBase}/connect/revoke`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    console.log(rv.status === 200 ? "✓ 已撤销，该密钥失效。" : `✗ 撤销失败 HTTP ${rv.status}`);
  } else {
    console.log(`保留密钥。撤销可随时调用：POST ${apiBase}/connect/revoke（Bearer 该密钥），或在后台「API 管理」停用。`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
