# 示例 / Examples

## connect-demo.mjs — 「一键连接」端到端示例

模拟外部平台走完整的连接流程：**发现文档 → PKCE → 浏览器授权 → 换取受限密钥 →
调用 whoami / groups / send →（可选）撤销**。纯 Node（18+），零依赖。

```bash
node examples/connect-demo.mjs <实例地址> [要发送的分组编号]

# 例：对本地实例、并向分组 ops-alert 发一条测试
node examples/connect-demo.mjs http://localhost:3000 ops-alert
```

运行后脚本会打印一个**授权链接**，在浏览器打开、用有「API 管理」权限的账号登录并批准；
批准后浏览器回跳到脚本起的本地回调地址，脚本自动换取密钥并调用接口。

对接细节见 [API.md 第 15 节](../API.md#15-外部平台连接一键连接--发现)。
