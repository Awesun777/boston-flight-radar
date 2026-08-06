// BOS Flight Radar — vanilla ES module.
// Loads deals/index.json (catalog), then each day's file, and renders a
// date-grouped feed of the 5 cheapest US destinations from Boston, each with
// its mini travel guide. Same architecture as the News Radar site, one section.

const EMPTY_MSG = "No digests yet. Run the /flight-digest skill to generate the first one.";

const state = {
  query: "",
  items: [],        // flattened deals, each carrying its digest date
  meta: null,
  dates: [],
  activeDate: "latest", // default to the newest day — a deals feed is about *today's* prices
};

const el = {
  status: document.getElementById("status"),
  feed: document.getElementById("feed"),
  search: document.getElementById("search"),
  dateNav: document.getElementById("date-nav"),
  datePrev: document.getElementById("date-prev"),
  dateNext: document.getElementById("date-next"),
  footerMeta: document.getElementById("footer-meta"),
};

// ---------- date helpers ----------
const isDateKey = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
// Local-time YYYY-MM-DD (matches the `date +%F` keys the skill writes).
function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fmtFullDate(key) {
  if (!isDateKey(key)) return key;
  return new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function relLabel(key) {
  if (!isDateKey(key)) return "";
  const today = ymd(new Date());
  const yest = ymd(new Date(Date.now() - 86400000));
  if (key === today) return "Today";
  if (key === yest) return "Yesterday";
  return "";
}

// ---------- fetch ----------
async function getJSON(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function load() {
  let index;
  try {
    index = await getJSON("./deals/index.json");
  } catch {
    fail();
    return;
  }
  state.meta = index;
  const digests = Array.isArray(index.digests)
    ? [...index.digests].sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];
  if (!digests.length) { fail(); return; }

  const days = await Promise.all(
    digests.map((d) =>
      getJSON(`./deals/${d.date}.json`)
        .then((day) => (day.deals || []).map((it, i) => ({ ...it, date: d.date, rank: it.rank ?? i + 1 })))
        .catch(() => [])
    )
  );
  state.items = days.flat();
  if (!state.items.length) { fail(); return; }

  state.dates = [...new Set(state.items.map((i) => i.date))].filter(isDateKey).sort((a, b) => (a < b ? 1 : -1));
  state.activeDate = state.dates[0] || "all";

  el.status.hidden = true;
  el.feed.hidden = false;
  buildDateNav();
  renderFooter();
  render();
  syncHeadHeight();
}

function fail() {
  el.feed.hidden = true;
  el.status.hidden = false;
  el.status.textContent = EMPTY_MSG;
}

// ---------- controls ----------
function buildDateNav() {
  const opts = [`<option value="all">All dates (${state.dates.length})</option>`].concat(
    state.dates.map((d) => {
      const rel = relLabel(d);
      return `<option value="${d}">${esc(fmtFullDate(d))}${rel ? ` · ${rel}` : ""}</option>`;
    })
  );
  el.dateNav.innerHTML = opts.join("");
  el.dateNav.value = state.activeDate;
  const only = state.dates.length <= 1;
  el.datePrev.disabled = only;
  el.dateNext.disabled = only;
}

function stepDate(dir) {
  if (!state.dates.length) return;
  let idx = state.dates.indexOf(state.activeDate);
  if (idx === -1) idx = 0;
  else idx = Math.min(state.dates.length - 1, Math.max(0, idx + dir));
  state.activeDate = state.dates[idx];
  el.dateNav.value = state.activeDate;
  render();
}

function syncHeadHeight() {
  const h = document.querySelector(".site-header")?.offsetHeight || 90;
  document.documentElement.style.setProperty("--head-h", `${h}px`);
}

function renderFooter() {
  const days = state.meta?.digests?.length ?? 0;
  const gen = state.meta?.generatedAt
    ? new Date(state.meta.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  el.footerMeta.textContent = `${days} day${days === 1 ? "" : "s"} of deals` + (gen ? ` · updated ${gen}` : "");
}

// ---------- rendering ----------
function matches(it) {
  if (state.activeDate !== "all" && it.date !== state.activeDate) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    it.destination, it.airport, it.whyRanked, it.travelWindow,
    ...(it.airlines || []),
    ...(it.nearbyParks || []).map((p) => p.name),
    ...(it.guide?.highlights || []),
  ].join(" ").toLowerCase();
  return q.split(/\s+/).every((t) => hay.includes(t));
}

function price(it) {
  if (it.priceLow == null) return "";
  const hi = it.priceHigh != null && it.priceHigh !== it.priceLow ? `–$${it.priceHigh}` : "";
  return `$${it.priceLow}${hi}`;
}

function soloDots(score) {
  const n = Math.max(0, Math.min(5, Number(score) || 0));
  return "●".repeat(n) + "○".repeat(5 - n);
}

function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
    else id = u.searchParams.get("v") || "";
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch { return null; }
}

function cardHTML(it, opts = {}) {
  const dateBadge = opts.showDate ? `<span class="result-date-badge">${esc(fmtFullDate(it.date))}</span>` : "";
  const parks = (it.nearbyParks || [])
    .map((p) => `<span class="tag park-tag">🏞 ${esc(p.name)}${p.drive ? ` · ${esc(p.drive)}` : ""}</span>`)
    .join("");
  const airlines = (it.airlines || []).join(", ");
  const g = it.guide || {};
  const highlights = (g.highlights || []).map((h) => `<li>${esc(h)}</li>`).join("");
  const itinerary = (Array.isArray(g.itinerary) ? g.itinerary : g.itinerary ? [g.itinerary] : [])
    .map((d) => `<li>${esc(d)}</li>`).join("");
  const food = (g.food || []).map((f) => `<li>${esc(f)}</li>`).join("");

  // The travel video lives inside the collapsed guide so a day of five
  // destinations still scans as a price list; the iframe is lazy so closed
  // guides cost nothing.
  const embed = it.video ? youtubeEmbed(it.video) : null;
  const video = embed
    ? `<div class="guide-block"><b>Watch</b><div class="video-wrap"><iframe src="${embed}" title="${esc(it.destination)} travel video" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div></div>`
    : "";

  const guide = (highlights || itinerary || g.gettingAround || g.stayArea || food || video)
    ? `<details class="guide">
        <summary>Mini travel guide${video ? " · ▶ video" : ""}</summary>
        <div class="guide-body">
          ${highlights ? `<div class="guide-block"><b>Highlights</b><ul>${highlights}</ul></div>` : ""}
          ${itinerary ? `<div class="guide-block"><b>Itinerary</b><ul>${itinerary}</ul></div>` : ""}
          ${g.gettingAround ? `<div class="guide-block"><b>Getting around</b><p>${esc(g.gettingAround)}</p></div>` : ""}
          ${g.stayArea ? `<div class="guide-block"><b>Where to stay</b><p>${esc(g.stayArea)}</p></div>` : ""}
          ${food ? `<div class="guide-block"><b>Eat &amp; drink</b><ul>${food}</ul></div>` : ""}
          ${video}
        </div>
      </details>`
    : "";

  // With a hero, the rank/price badges ride on the photo and the in-body meta
  // row starts hidden; if the image 404s the onerror handler removes the hero
  // and reveals the body row, which is exactly the no-image layout.
  const badges = `
        <span class="rank-badge">#${it.rank}</span>
        <span class="price-badge">${esc(price(it))} <small>round trip</small></span>
        ${it.nonstop ? `<span class="nonstop-badge">Nonstop</span>` : ""}
        ${dateBadge}`;
  const hero = it.image
    ? `<div class="card-hero">
        <img src="${esc(it.image)}" alt="${esc(it.destination)}" loading="lazy"
          onerror="const c=this.closest('article');c.querySelector('.card-meta').hidden=false;this.closest('.card-hero').remove()">
        <div class="hero-badges">${badges}</div>
        ${it.imageCredit ? `<span class="hero-credit">${esc(it.imageCredit)}</span>` : ""}
      </div>`
    : "";

  return `<article class="card${hero ? " has-hero" : ""}">
    ${hero}
    <div class="card-body">
      <div class="card-meta" ${hero ? "hidden" : ""}>${badges}</div>
      <h3>${esc(it.destination)}${it.airport ? ` <span class="airport">${esc(it.airport)}</span>` : ""}</h3>
      <div class="fare-facts">
        ${it.travelWindow ? `<span>📅 ${esc(it.travelWindow)}</span>` : ""}
        ${airlines ? `<span>🛫 ${esc(airlines)}</span>` : ""}
        ${it.soloScore != null ? `<span title="Solo-trip friendliness">🎒 Solo ${soloDots(it.soloScore)}</span>` : ""}
      </div>
      ${it.whyRanked ? `<div class="why"><b>Why it's here</b><span>${esc(it.whyRanked)}</span></div>` : ""}
      ${it.soloWhy ? `<p class="summary">${esc(it.soloWhy)}</p>` : ""}
      ${parks ? `<div class="tags">${parks}</div>` : ""}
      ${guide}
      ${it.verifyUrl ? `<div class="verify"><a href="${esc(it.verifyUrl)}" target="_blank" rel="noopener">Check live prices on Google Flights →</a></div>` : ""}
    </div>
  </article>`;
}

function render() {
  const visible = state.items.filter(matches);
  const searching = !!state.query.trim();

  if (!visible.length) {
    el.feed.innerHTML = `<div class="status">No results${searching ? ` for “${esc(state.query.trim())}”` : ""}.</div>`;
    return;
  }

  if (searching) {
    const flat = [...visible].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));
    el.feed.innerHTML = `<div class="date-group">${flat.map((it) => cardHTML(it, { showDate: true })).join("")}</div>`;
    return;
  }

  const groups = new Map();
  for (const it of visible) {
    if (!groups.has(it.date)) groups.set(it.date, []);
    groups.get(it.date).push(it);
  }
  const keys = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));
  el.feed.innerHTML = keys.map((k) => {
    const items = groups.get(k).sort((a, b) => a.rank - b.rank);
    const rel = relLabel(k);
    return `<section class="date-group">
      <div class="date-head">
        <h2>${esc(fmtFullDate(k))}</h2>
        ${rel ? `<span class="date-rel">${rel}</span>` : ""}
        <span class="count">${items.length} destination${items.length === 1 ? "" : "s"}</span>
      </div>
      ${items.map((it) => cardHTML(it)).join("")}
    </section>`;
  }).join("");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- events ----------
let searchTimer;
el.search.addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => { state.query = v; render(); }, 90);
});
el.dateNav.addEventListener("change", (e) => { state.activeDate = e.target.value; render(); });
el.datePrev.addEventListener("click", () => stepDate(1));   // older
el.dateNext.addEventListener("click", () => stepDate(-1));  // newer
window.addEventListener("resize", syncHeadHeight);

load();
