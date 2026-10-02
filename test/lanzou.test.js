"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseAllowedHttpsUrl, parseSharePage, solveAcwChallenge, resolveLanzouShare } = require("../src/lanzou");

test("accepts HTTPS Lanzou hosts and rejects other hosts or schemes", () => {
  assert.equal(parseAllowedHttpsUrl("https://wwx.lanzoua.com/i123").hostname, "wwx.lanzoua.com");
  for (const url of ["https://example.com/", "http://lanzoua.com/", "https://lanzoua.com.evil.example/", "https://user@lanzoua.com/", "https://127.0.0.1/"]) {
    assert.throws(() => parseAllowedHttpsUrl(url), /Only HTTPS Lanzou Cloud URLs/);
  }
});

test("solves a fixed acw challenge input", () => {
  assert.equal(solveAcwChallenge("0000000000000000000000000000000000000000"), "3000176000856006061501533003690027800375");
});

test("extracts name, size and iframe from an HTML fixture", () => {
  const html = fs.readFileSync(path.join(__dirname, "fixtures", "share-page.html"), "utf8");
  assert.deepEqual(parseSharePage(html), { name: "测试文件.zip - 蓝奏云", fileSize: "12.5 MB", mobileBase: undefined, mobileLink: undefined, iframe: "https://wwx.lanzoua.com/fn?x=1" });
});

test("rejects a non-Lanzou URL before making a request", async () => {
  await assert.rejects(resolveLanzouShare("https://example.com/share"), /Only HTTPS Lanzou Cloud URLs/);
});
