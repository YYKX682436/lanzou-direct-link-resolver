# 蓝奏云分享链接直链解析器

针对正常公开分享链接，将蓝奏云分享页解析为最终下载 URL，并返回文件名和大小。不处理权限绕过，也不接受任意站点 URL。

## 工作原理

解析分享页的移动端链接，或读取 iframe 中的签名并请求 `downprocess`；随后处理最终跳转和可能出现的 `acw_sc__v2` challenge。每次请求前检查 HTTPS 主机 allowlist，单次超时 15 秒，最多跟随 8 次跳转。

## Node.js API

需要 Node.js 22 或更新版本。

```sh
npm install
```

```js
const { resolveLanzouShare } = require("lanzou-direct-link-resolver");

const result = await resolveLanzouShare("https://wwx.lanzoua.com/example");
console.log(result);
// { downloadUrl: "https://...", name: "file.zip", fileSize: "12 MB" }
```

## CLI

```sh
node src/cli.js <lanzou-share-url>
```

CLI 会打印解析出的文件名、大小和最终 URL。

## 当前适配范围

适配目前常见的 `urlpt/link` 移动页流程，以及 iframe、`wp_sign`、`ajaxdata`、`ajaxm.php`、`downprocess` 和 acw challenge 流程。蓝奏云页面结构或接口变化可能导致解析失效。最终下载使用的 `lanosso.com` 域名在部分网络环境可能有 DNS 问题。

默认测试仅使用本地 fixture，不需要访问蓝奏云：

```sh
npm test
```
