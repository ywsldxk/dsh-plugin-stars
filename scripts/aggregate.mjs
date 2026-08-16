#!/usr/bin/env node
/**
 * Aggregate public GitHub repositories tagged with topic:dsh-plugin.
 * Node 18+; no external dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const MIN_STARS = Number(process.env.MIN_STARS || "100");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const EXCLUDE_REPOS = (process.env.EXCLUDE_REPOS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const OUTPUT = path.resolve(process.cwd(), "data/plugins.json");
const TMP_OUTPUT = `${OUTPUT}.tmp`;
const README_PATH = path.resolve(process.cwd(), "README.md");
const README_TMP_PATH = `${README_PATH}.tmp`;
const RANKING_START_MARKER = "<!-- RANKING:START -->";
const RANKING_END_MARKER = "<!-- RANKING:END -->";
const README_TOP_N = 50;

function validateEnv() {
  if (Number.isNaN(MIN_STARS) || !Number.isFinite(MIN_STARS) || MIN_STARS < 0) {
    throw new Error(`Invalid MIN_STARS: ${process.env.MIN_STARS}`);
  }
  if (typeof GITHUB_TOKEN !== "string") {
    throw new Error("GITHUB_TOKEN must be a string");
  }
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Request timeout: ${url}`));
    });
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function checkRateLimit(response, url) {
  const remaining = response.headers["x-ratelimit-remaining"];
  const limit = response.headers["x-ratelimit-limit"];
  if (remaining != null && Number(remaining) <= 0) {
    const reset = response.headers["x-ratelimit-reset"];
    const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : "unknown";
    throw new Error(`GitHub API rate limit exceeded (remaining=${remaining}, limit=${limit}, reset=${resetAt}) for ${url}`);
  }
}

async function searchRepositories(page) {
  const params = new URLSearchParams({
    q: `topic:dsh-plugin stars:>=${MIN_STARS} fork:false archived:false`,
    sort: "stars",
    order: "desc",
    per_page: "100",
    page: String(page),
  });
  const url = `https://api.github.com/search/repositories?${params}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "dsh-plugin-stars-aggregator",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const res = await requestJson(url, { method: "GET", headers });
  checkRateLimit(res, url);

  if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) {
    throw new Error(`GitHub API authorization or rate-limit error (${res.statusCode}) for ${url}: ${res.body}`);
  }
  if (res.statusCode === 422) {
    throw new Error(`GitHub API validation error (${res.statusCode}) for ${url}: ${res.body}`);
  }
  if (res.statusCode !== 200) {
    throw new Error(`GitHub API error (${res.statusCode}) for ${url}: ${res.body}`);
  }

  try {
    return JSON.parse(res.body);
  } catch (err) {
    throw new Error(`Failed to parse GitHub API response for ${url}: ${err.message}`);
  }
}

async function fetchPackageJson(owner, repo) {
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/HEAD/package.json`;
  try {
    const res = await requestJson(url, { method: "GET" });
    if (res.statusCode !== 200) {
      return "";
    }
    const data = JSON.parse(res.body);
    return typeof data.name === "string" ? data.name.trim() : "";
  } catch {
    return "";
  }
}

function normalizeRepo(repo) {
  const owner = repo.owner && typeof repo.owner.login === "string" ? repo.owner.login : "";
  const license = repo.license || {};
  return {
    id: String(repo.id || ""),
    name: String(repo.name || ""),
    fullName: String(repo.full_name || ""),
    owner: String(owner),
    description: String(repo.description || ""),
    htmlUrl: String(repo.html_url || ""),
    homepage: String(repo.homepage || ""),
    npmUrl: "",
    npmName: "",
    stars: Number(repo.stargazers_count) || 0,
    updatedAt: String(repo.updated_at || ""),
    license: String(license.spdx_id || license.name || ""),
    topics: Array.isArray(repo.topics) ? repo.topics.filter((t) => typeof t === "string") : [],
  };
}

function looksLikePlugin(repo) {
  // Topics can be misapplied by repository owners. This lightweight,
  // public-metadata second filter reduces false positives but is not a
  // security or endorsement check.
  const haystack = `${repo.name || ""} ${repo.description || ""}`.toLowerCase();
  const englishMarkers = /\b(plugin|skill|extension|preset|integration)\b/;
  const chineseMarkers = ["插件", "技能", "扩展", "预设", "集成"];
  return englishMarkers.test(haystack) || chineseMarkers.some((m) => haystack.includes(m));
}

function formatDateTime(isoString) {
  if (!isoString) return "未知";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "未知";
    return date.toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "未知";
  }
}

function escapeTableCell(text) {
  return String(text || "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function generateReadmeSection(output) {
  const plugins = Array.isArray(output.plugins) ? output.plugins : [];
  const topPlugins = plugins
    .slice()
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, README_TOP_N);
  const generatedAt = formatDateTime(output.generatedAt);
  const total = plugins.length;
  const threshold = Number(output.threshold) || MIN_STARS;

  if (topPlugins.length === 0) {
    return [
      "",
      "暂无符合收录条件的插件。",
      "",
      `> 数据更新时间：${generatedAt} · 收录数：${total} · 最低 Star：${threshold} · [打开完整榜单](https://ywsldxk.github.io/dsh-plugin-stars/)`,
      "",
    ].join("\n");
  }

  const lines = [
    "",
    "| 排名 | 插件 | Stars | 简介 |",
    "| ---: | --- | ---: | --- |",
  ];

  for (let i = 0; i < topPlugins.length; i++) {
    const plugin = topPlugins[i];
    const rank = i + 1;
    const repoLink = `[${escapeTableCell(plugin.fullName)}](${plugin.htmlUrl || `https://github.com/${plugin.fullName}`})`;
    const stars = Number(plugin.stars) || 0;
    const description = escapeTableCell(plugin.description);
    lines.push(`| ${rank} | ${repoLink} | ${stars} | ${description} |`);
  }

  lines.push("");
  lines.push(`> 数据更新时间：${generatedAt} · 收录数：${total} · 最低 Star：${threshold} · [打开完整榜单](https://ywsldxk.github.io/dsh-plugin-stars/)`);
  lines.push("");

  return lines.join("\n");
}

function updateReadme(output) {
  if (!fs.existsSync(README_PATH)) {
    throw new Error(`README file not found: ${README_PATH}`);
  }

  const readme = fs.readFileSync(README_PATH, "utf8");
  const startIndex = readme.indexOf(RANKING_START_MARKER);
  const endIndex = readme.indexOf(RANKING_END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error(
      `README ranking markers not found: expected both "${RANKING_START_MARKER}" and "${RANKING_END_MARKER}"`
    );
  }
  if (endIndex <= startIndex) {
    throw new Error(
      `Invalid README ranking markers: end marker must appear after start marker`
    );
  }

  const prefix = readme.slice(0, startIndex + RANKING_START_MARKER.length);
  const suffix = readme.slice(endIndex);
  const section = generateReadmeSection(output);
  const nextReadme = `${prefix}${section}${suffix}`;

  if (nextReadme === readme) {
    console.log("README ranking section is up to date");
    return;
  }

  fs.writeFileSync(README_TMP_PATH, nextReadme, "utf8");
  fs.renameSync(README_TMP_PATH, README_PATH);
  console.log("README ranking section updated");
}

async function main() {
  validateEnv();

  const plugins = [];
  let page = 1;

  while (true) {
    const data = await searchRepositories(page);
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      break;
    }

    for (const repo of items) {
      if (!repo || typeof repo !== "object") continue;
      const fullName = String(repo.full_name || "").toLowerCase();
      if (EXCLUDE_REPOS.includes(fullName)) continue;
      if (repo.fork || repo.archived) continue;
      if ((repo.stargazers_count || 0) < MIN_STARS) continue;

      if (!looksLikePlugin(repo)) continue;

      const normalized = normalizeRepo(repo);
      const npmName = await fetchPackageJson(normalized.owner, normalized.name);
      if (npmName) {
        normalized.npmName = npmName;
        normalized.npmUrl = `https://www.npmjs.com/package/${encodeURIComponent(npmName)}`;
      }
      plugins.push(normalized);
    }

    if (items.length < 100) break;
    if (plugins.length >= 1000) break; // GitHub Search hard ceiling
    page += 1;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "github-search-topic-dsh-plugin",
    threshold: MIN_STARS,
    note: "GitHub repository search returns at most 1,000 results. This list is the most popular matches within that window, not a complete census.",
    plugins,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(TMP_OUTPUT, JSON.stringify(output, null, 2) + "\n", "utf8");
  fs.renameSync(TMP_OUTPUT, OUTPUT);

  updateReadme(output);

  console.log(`Wrote ${plugins.length} plugins to ${OUTPUT} (threshold=${MIN_STARS})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
