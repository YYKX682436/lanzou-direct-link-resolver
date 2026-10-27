# 蓝奏云直链解析器（Lanzou Direct Link Resolver）

一个基于 Node.js 的蓝奏云公开分享链接解析工具：从分享页获取文件信息，并尝试解析出最终下载 URL。可通过 Node.js API 或命令行使用。

## 功能特点

- 解析普通公开分享链接，返回下载 URL、文件名和文件大小。
- 支持常见的移动页和 iframe 下载流程，以及 `acw_sc__v2` challenge。
- 校验请求和跳转的 HTTPS 主机，限制请求超时和跳转次数。

## 环境要求

- Node.js 22 或更新版本（包含 npm）。
- 解析真实链接时需要能够访问蓝奏云及其下载域名。

## 快速开始

从源码运行，无需假定 npm 包已发布：

```sh
git clone https://github.com/YYKX682436/lanzou-direct-link-resolver.git
cd lanzou-direct-link-resolver
npm ci
node src/cli.js 'https://wwx.lanzoua.com/你的分享链接'
```

请将示例地址替换为实际的公开分享链接。

## Node.js API

以下示例在仓库根目录执行。`resolveLanzouShare` 返回 Promise；解析失败时会抛出错误。

```js
const { resolveLanzouShare } = require('./src/lanzou');

async function main() {
  try {
    const result = await resolveLanzouShare('https://wwx.lanzoua.com/你的分享链接');
    console.log(result);
    // 示例：{ downloadUrl: 'https://...', name: 'file.zip', fileSize: '12 MB' }
  } catch (error) {
    console.error('解析失败：', error.message);
  }
}

main();
```

无法从分享页识别文件名或大小时，对应字段为 `Unknown`。

## CLI

```sh
node src/cli.js 'https://wwx.lanzoua.com/你的分享链接'
```

CLI 打印文件名、文件大小和最终下载地址；解析失败时输出错误信息。

## 支持范围与已知限制

- 面向普通公开的单文件分享链接，不提供密码参数，也不处理权限绕过或任意网站 URL。
- 适配常见的 `urlpt`/`link` 移动页流程，以及 iframe、`wp_sign`、`ajaxdata`、`ajaxm.php`、`downprocess` 和 acw challenge 流程。蓝奏云页面结构或接口变化可能导致解析失效。
- 分享页请求只允许匹配 `lanzou[a-z]*.com` 及其一级子域名的 HTTPS 地址；下载流程额外允许 `lanosso.com` 及其一级子域名。每次请求超时 15 秒，最多跟随 8 次跳转。
- 最终下载所用域名在部分网络环境可能有 DNS 问题；返回的地址也可能受服务端有效期或访问限制影响。

## 工作原理与测试

解析器先读取分享页的移动端链接，或读取 iframe 中的签名并请求 `downprocess`；随后处理下载跳转和可能出现的 `acw_sc__v2` challenge。详细流程见 [docs/algorithm.md](docs/algorithm.md)。

现有测试使用本地 fixture，不需要访问蓝奏云：

```sh
npm test
npm run check
```

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
