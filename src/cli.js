#!/usr/bin/env node
"use strict";
const { resolveLanzouShare } = require("./lanzou");

async function main() {
  const shareUrl = process.argv[2];
  if (!shareUrl) { console.error("用法: node src/cli.js <lanzou-share-url>"); process.exitCode = 2; return; }
  try {
    const result = await resolveLanzouShare(shareUrl);
    console.log(`文件名：${result.name}`);
    console.log(`文件大小：${result.fileSize}`);
    console.log(`最终下载地址：${result.downloadUrl}`);
  } catch (error) { console.error(`解析失败：${error.message}`); process.exitCode = 1; }
}
main();
