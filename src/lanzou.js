"use strict";

const axios = require("axios");
const USER_AGENT = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 8;
const SHARE_HOST = /^(?:[^.]+\.)?lanzou[a-z]*\.com$/i;
const INTERMEDIATE_HOST = /^(?:[^.]+\.)?lanosso\.com$/i;

function parseAllowedHttpsUrl(value, kind = "lanzou") {
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid Lanzou URL"); }
  const hostAllowed = kind === "download" ? SHARE_HOST.test(url.hostname) || INTERMEDIATE_HOST.test(url.hostname) : SHARE_HOST.test(url.hostname);
  if (url.protocol !== "https:" || !hostAllowed || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Only HTTPS Lanzou Cloud URLs are allowed");
  }
  return url;
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ")
    .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10)))
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").trim();
}

function parseSharePage(html) {
  const pageHtml = String(html || "");
  if (/文件取消分享了|来晚啦.*取消分享/.test(pageHtml)) throw new Error("Lanzou file is no longer shared");
  const nameMatch = pageHtml.match(/<div[^>]+class=["'][^"']*appname[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || pageHtml.match(/<div[^>]+class=["'][^"']*n_box_3fn[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || pageHtml.match(/<title>([\s\S]*?)<\/title>/i) || pageHtml.match(/var\s+filename\s*=\s*["']([^"']+)/i);
  const sizeMatch = pageHtml.match(/<div[^>]+class=["'][^"']*n_filesize[^"']*["'][^>]*>\s*(?:大小：)?([\s\S]*?)<\/div>/i)
    || pageHtml.match(/下载\s*\(\s*([^\)]+)\s*\)/i) || pageHtml.match(/文件大小[：:]\s*([^<]+)/i);
  return {
    name: cleanText(nameMatch?.[1]) || "Unknown", fileSize: cleanText(sizeMatch?.[1]) || "Unknown",
    mobileBase: pageHtml.match(/var\s+urlpt\s*=\s*["']([^"']+)/i)?.[1],
    mobileLink: pageHtml.match(/var\s+link\s*=\s*["']([^"']+)/i)?.[1],
    iframe: pageHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1]
  };
}

function solveAcwChallenge(arg1) {
  const positions = [15,35,29,24,33,16,1,38,10,9,19,31,40,27,22,23,25,13,6,11,39,18,20,8,14,21,32,26,2,30,7,4,17,5,3,28,34,37,12,36];
  const mask = "3000176000856006061501533003690027800375";
  const reordered = positions.map(position => arg1[position - 1] || "").join("");
  let result = "";
  for (let index = 0; index < Math.min(reordered.length, mask.length); index += 2) {
    const value = parseInt(reordered.slice(index, index + 2), 16) ^ parseInt(mask.slice(index, index + 2), 16);
    result += value.toString(16).padStart(2, "0");
  }
  return result;
}

async function requestWithRedirects(initialUrl, options = {}, kind = "lanzou") {
  let current = parseAllowedHttpsUrl(initialUrl, kind);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await axios.request({ url: current.toString(), method: options.method || "GET", data: options.data,
      headers: { "User-Agent": USER_AGENT, ...(options.headers || {}) }, timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 0, validateStatus: () => true });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location) throw new Error("Lanzou returned a redirect without a location");
      if (hop === MAX_REDIRECTS) throw new Error("Lanzou redirect limit exceeded");
      current = parseAllowedHttpsUrl(new URL(location, current).toString(), kind);
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`Lanzou request failed with HTTP ${response.status}`);
    return { response, url: current };
  }
  throw new Error("Lanzou redirect limit exceeded");
}

async function resolveFinalDownload(intermediateUrl) {
  const headers = { "User-Agent": USER_AGENT, Referer: "https://developer.lanzoug.com" };
  let current = parseAllowedHttpsUrl(intermediateUrl, "download");
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, { headers, redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Lanzou returned a redirect without a location");
      if (hop === MAX_REDIRECTS) throw new Error("Lanzou redirect limit exceeded");
      current = parseAllowedHttpsUrl(new URL(location, current).toString(), "download");
      continue;
    }
    const html = await response.text();
    const challenge = html.match(/var\s+arg1\s*=\s*["']([0-9a-f]+)["']/i)?.[1];
    if (!challenge) throw new Error("Lanzou final download redirect was not found");
    const challenged = await fetch(current, { headers: { ...headers, Cookie: `acw_sc__v2=${solveAcwChallenge(challenge)}` },
      redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const finalLocation = challenged.headers.get("location");
    if (!finalLocation || challenged.status < 300 || challenged.status >= 400) throw new Error("Lanzou security challenge did not return a download redirect");
    return parseAllowedHttpsUrl(new URL(finalLocation, current).toString(), "download").toString();
  }
  throw new Error("Lanzou redirect limit exceeded");
}

async function resolveLanzouShare(shareUrl) {
  const requestedUrl = parseAllowedHttpsUrl(shareUrl);
  const { response: pageResponse, url: finalPageUrl } = await requestWithRedirects(requestedUrl.toString());
  const page = parseSharePage(String(pageResponse.data || ""));
  let downloadUrl;
  if (page.mobileBase && page.mobileLink) {
    const base = parseAllowedHttpsUrl(page.mobileBase);
    downloadUrl = await resolveFinalDownload(parseAllowedHttpsUrl(new URL(page.mobileLink, base).toString()).toString());
  } else {
    if (!page.iframe) throw new Error("Lanzou download frame was not found");
    const iframeUrl = parseAllowedHttpsUrl(new URL(page.iframe, finalPageUrl).toString());
    const { response: frameResponse, url: finalFrameUrl } = await requestWithRedirects(iframeUrl.toString(), { headers: { Referer: finalPageUrl.toString() } });
    const frameHtml = String(frameResponse.data || "");
    const wpSign = frameHtml.match(/wp_sign\s*=\s*["']([^"']+)/i)?.[1];
    const ajaxData = frameHtml.match(/ajaxdata\s*=\s*["']([^"']+)/i)?.[1];
    const ajaxPaths = [...frameHtml.matchAll(/ajaxm\.php\?file=\d+/gi)].map(match => match[0]);
    if (!wpSign || !ajaxData || ajaxPaths.length === 0) throw new Error("Lanzou download signature was not found");
    const form = new URLSearchParams({ action: "downprocess", websignkey: ajaxData, signs: ajaxData, sign: wpSign, websign: "", kd: "1", ves: "1" });
    const ajaxUrl = parseAllowedHttpsUrl(new URL(ajaxPaths[1] || ajaxPaths[0], finalFrameUrl).toString());
    const { response: linkResponse } = await requestWithRedirects(ajaxUrl.toString(), { method: "POST", data: form.toString(),
      headers: { Referer: finalFrameUrl.toString(), "Content-Type": "application/x-www-form-urlencoded" } });
    let linkInfo;
    try { linkInfo = typeof linkResponse.data === "string" ? JSON.parse(linkResponse.data) : linkResponse.data; }
    catch { throw new Error("Lanzou returned an invalid download response"); }
    if (Number(linkInfo?.zt) !== 1 || !linkInfo.dom || !linkInfo.url) throw new Error(cleanText(linkInfo?.inf) || "Lanzou did not return a download link");
    const dom = parseAllowedHttpsUrl(linkInfo.dom, "download");
    const intermediate = `${dom.origin}/file/${linkInfo.url}`.replace(/([?&])pid=[^&]*&?/i, "$1");
    downloadUrl = await resolveFinalDownload(intermediate);
  }
  return { downloadUrl, name: page.name, fileSize: page.fileSize };
}

module.exports = { resolveLanzouShare, parseAllowedHttpsUrl, parseSharePage, solveAcwChallenge };
