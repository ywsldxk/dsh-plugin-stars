/**
 * DSH Plugin Stars - browser frontend.
 * Loads data/plugins.json and renders an interactive table.
 */

const DATA_URL = "data/plugins.json";
const PAGE_SIZE = 25;

const els = {
  generatedAt: document.getElementById("generated-at"),
  totalCount: document.getElementById("total-count"),
  threshold: document.getElementById("threshold"),
  search: document.getElementById("search"),
  minStars: document.getElementById("min-stars"),
  sort: document.getElementById("sort"),
  statVisible: document.getElementById("stat-visible"),
  statTotal: document.getElementById("stat-total"),
  statMax: document.getElementById("stat-max"),
  emptyState: document.getElementById("empty-state"),
  pluginTable: document.getElementById("plugin-table"),
  pluginList: document.getElementById("plugin-list"),
  pagination: document.getElementById("pagination"),
  prevPage: document.getElementById("prev-page"),
  pageStatus: document.getElementById("page-status"),
  nextPage: document.getElementById("next-page"),
};

let allPlugins = [];
let dataMeta = { generatedAt: "", source: "", threshold: 0 };
let currentPage = 1;
let currentResults = [];

function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-US");
}

function formatDate(iso) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isAllowedUrl(value) {
  if (typeof value !== "string" || !value) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

function sanitizeText(value) {
  if (value == null) return "";
  return String(value);
}

function makeLink(href, text) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = sanitizeText(text);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function makeDisabledLink(text) {
  const span = document.createElement("span");
  span.textContent = sanitizeText(text);
  span.className = "link-placeholder";
  span.setAttribute("aria-disabled", "true");
  return span;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateStats(visibleCount, totalCount, maxStars) {
  els.statVisible.textContent = formatNumber(visibleCount);
  els.statTotal.textContent = formatNumber(totalCount);
  els.statMax.textContent = formatNumber(maxStars);
}

function updatePagination(total, totalPages) {
  if (total <= PAGE_SIZE) {
    els.pagination.hidden = true;
    return;
  }
  els.pagination.hidden = false;
  els.pageStatus.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${total} 条`;
  els.prevPage.disabled = currentPage <= 1;
  els.nextPage.disabled = currentPage >= totalPages;
}

function renderPlugins() {
  els.pluginList.innerHTML = "";
  const total = currentResults.length;
  const maxStars = Math.max(...allPlugins.map((p) => p.stars || 0), 0);

  if (total === 0) {
    els.pluginTable.hidden = true;
    els.emptyState.hidden = false;
    els.emptyState.innerHTML = "<p>没有匹配的插件。</p>";
    updateStats(0, allPlugins.length, maxStars);
    els.pagination.hidden = true;
    return;
  }

  els.pluginTable.hidden = false;
  els.emptyState.hidden = true;

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pagePlugins = currentResults.slice(start, start + PAGE_SIZE);

  updateStats(total, allPlugins.length, maxStars);

  pagePlugins.forEach((plugin, index) => {
    const rank = start + index + 1;
    const repoUrl = isAllowedUrl(plugin.htmlUrl) ? plugin.htmlUrl : "";
    const npmUrl = isAllowedUrl(plugin.npmUrl) ? plugin.npmUrl : "";
    const homepageUrl = isAllowedUrl(plugin.homepage) ? plugin.homepage : "";

    const tr = document.createElement("tr");

    const rankTd = document.createElement("td");
    rankTd.className = "col-rank";
    rankTd.textContent = String(rank);
    tr.appendChild(rankTd);

    const repoTd = document.createElement("td");
    repoTd.className = "col-repo";
    const repoLink = document.createElement("a");
    repoLink.className = "repo-name";
    repoLink.textContent = sanitizeText(plugin.fullName || plugin.name || "unknown");
    if (repoUrl) {
      repoLink.href = repoUrl;
      repoLink.target = "_blank";
      repoLink.rel = "noopener noreferrer";
    }
    repoTd.appendChild(repoLink);

    const meta = document.createElement("div");
    meta.className = "repo-meta";
    if (plugin.license) {
      const license = document.createElement("span");
      license.className = "license";
      license.textContent = sanitizeText(plugin.license);
      meta.appendChild(license);
    }
    const topics = Array.isArray(plugin.topics) ? plugin.topics : [];
    topics.slice(0, 4).forEach((t) => {
      const topic = document.createElement("span");
      topic.className = "topic";
      topic.textContent = sanitizeText(t);
      meta.appendChild(topic);
    });
    repoTd.appendChild(meta);
    tr.appendChild(repoTd);

    const descTd = document.createElement("td");
    descTd.className = "col-desc";
    const desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = sanitizeText(plugin.description);
    descTd.appendChild(desc);
    tr.appendChild(descTd);

    const starsTd = document.createElement("td");
    starsTd.className = "col-stars";
    const starSpan = document.createElement("span");
    starSpan.className = "star-count";
    starSpan.innerHTML = `<span class="star-icon" aria-hidden="true">&#9733;</span> ${escapeHtml(formatNumber(plugin.stars))}`;
    starsTd.appendChild(starSpan);
    tr.appendChild(starsTd);

    const updatedTd = document.createElement("td");
    updatedTd.className = "col-updated";
    updatedTd.textContent = formatDate(plugin.updatedAt);
    tr.appendChild(updatedTd);

    const linksTd = document.createElement("td");
    linksTd.className = "col-links";
    const linkGroup = document.createElement("div");
    linkGroup.className = "link-group";

    if (repoUrl) {
      linkGroup.appendChild(makeLink(repoUrl, "GitHub"));
    } else {
      linkGroup.appendChild(makeDisabledLink("GitHub"));
    }

    if (npmUrl) {
      linkGroup.appendChild(makeLink(npmUrl, "npm"));
    } else if (plugin.npmName) {
      linkGroup.appendChild(makeDisabledLink("npm"));
    }

    if (homepageUrl) {
      linkGroup.appendChild(makeLink(homepageUrl, "主页"));
    }

    linksTd.appendChild(linkGroup);
    tr.appendChild(linksTd);

    els.pluginList.appendChild(tr);
  });

  updatePagination(total, totalPages);
}

function filterAndSort() {
  const query = els.search.value.trim().toLowerCase();
  const minStars = Number(els.minStars.value);
  const sortMode = els.sort.value;

  let result = allPlugins.filter((plugin) => {
    const starsOk = Number.isFinite(minStars) ? (plugin.stars || 0) >= minStars : true;
    if (!starsOk) return false;
    if (!query) return true;
    const hay = [
      plugin.name,
      plugin.fullName,
      plugin.description,
      plugin.owner,
      Array.isArray(plugin.topics) ? plugin.topics.join(" ") : "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });

  result.sort((a, b) => {
    switch (sortMode) {
      case "stars-asc":
        return (a.stars || 0) - (b.stars || 0);
      case "stars-desc":
        return (b.stars || 0) - (a.stars || 0);
      case "updated-asc": {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return ta - tb;
      }
      case "updated-desc":
      default: {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      }
    }
  });

  currentPage = 1;
  currentResults = result;
  renderPlugins();
}

function attachListeners() {
  els.search.addEventListener("input", filterAndSort);
  els.minStars.addEventListener("input", filterAndSort);
  els.sort.addEventListener("change", filterAndSort);
  els.prevPage.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderPlugins();
    }
  });
  els.nextPage.addEventListener("click", () => {
    const totalPages = Math.ceil(currentResults.length / PAGE_SIZE);
    if (currentPage < totalPages) {
      currentPage += 1;
      renderPlugins();
    }
  });
}

function updateMeta() {
  els.generatedAt.dateTime = dataMeta.generatedAt || "";
  els.generatedAt.textContent = formatDate(dataMeta.generatedAt);
  els.totalCount.textContent = formatNumber(allPlugins.length);
  els.threshold.textContent = formatNumber(dataMeta.threshold || 0);
  const defaultMin = Number(dataMeta.threshold || 0);
  if (Number.isFinite(defaultMin) && defaultMin > 0) {
    els.minStars.value = String(defaultMin);
  }
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new Error("Invalid data format: expected object");
    }
    if (!Array.isArray(data.plugins)) {
      throw new Error("Invalid data format: plugins must be an array");
    }

    dataMeta = {
      generatedAt: data.generatedAt || "",
      source: data.source || "",
      threshold: Number(data.threshold) || 0,
    };

    allPlugins = data.plugins.filter((p) => p && typeof p === "object");
    updateMeta();
    filterAndSort();
  } catch (err) {
    console.error("Failed to load plugin data:", err);
    els.emptyState.hidden = false;
    els.emptyState.innerHTML = "<p></p>";
    els.emptyState.firstElementChild.textContent = `数据加载失败：${err.message}`;
    els.pluginTable.hidden = true;
    els.pagination.hidden = true;
    updateStats(0, 0, 0);
  }
}

attachListeners();
loadData();
