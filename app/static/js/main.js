const API_BASE = "";

const CURRENCIES = [
  ["USD", "US Dollar", "$"],
  ["EUR", "Euro", "€"],
  ["GBP", "British Pound", "£"],
  ["ZAR", "South African Rand", "R"],
  ["JPY", "Japanese Yen", "¥"],
  ["CHF", "Swiss Franc", "CHF"],
  ["AUD", "Australian Dollar", "A$"],
  ["CAD", "Canadian Dollar", "C$"],
  ["NZD", "New Zealand Dollar", "NZ$"],
  ["CNY", "Chinese Yuan", "¥"],
  ["INR", "Indian Rupee", "₹"],
  ["BRL", "Brazilian Real", "R$"],
  ["MXN", "Mexican Peso", "$"],
  ["SGD", "Singapore Dollar", "S$"],
  ["HKD", "Hong Kong Dollar", "HK$"],
  ["NOK", "Norwegian Krone", "kr"],
  ["SEK", "Swedish Krona", "kr"],
  ["DKK", "Danish Krone", "kr"],
  ["PLN", "Polish Zloty", "zł"],
  ["TRY", "Turkish Lira", "₺"],
  ["AED", "UAE Dirham", "د.إ"],
  ["SAR", "Saudi Riyal", "﷼"],
  ["NGN", "Nigerian Naira", "₦"],
  ["KES", "Kenyan Shilling", "KSh"],
  ["EGP", "Egyptian Pound", "E£"],
  ["RUB", "Russian Ruble", "₽"],
  ["KRW", "South Korean Won", "₩"],
  ["THB", "Thai Baht", "฿"],
];

const CURRENCY_MAP = Object.fromEntries(
  CURRENCIES.map(([code, name, symbol]) => [code, { code, name, symbol }])
);

const WATCHED_PAIRS = ["USD/ZAR", "EUR/USD", "GBP/ZAR", "JPY/USD"];
const PAGE_META = {
  overview: "Overview",
  convert: "Convert",
  trends: "Trends",
  portfolio: "Portfolio",
  history: "History",
  alerts: "Alerts",
  settings: "Settings",
};

function saveToken(token) {
  localStorage.setItem("access_token", token);
}

function getToken() {
  return localStorage.getItem("access_token");
}

function saveRefreshToken(token) {
  localStorage.setItem("refresh_token", token);
}

function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

function saveUser(user) {
  if (user) localStorage.setItem("current_user", JSON.stringify(user));
}

function getStoredUser() {
  const raw = localStorage.getItem("current_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("current_user");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(
      `${API_BASE}/refresh-token?token=${encodeURIComponent(refreshToken)}`,
      { method: "POST" }
    );

    if (!response.ok) {
      clearSession();
      return false;
    }

    const data = await response.json();
    if (!data.access_token) {
      clearSession();
      return false;
    }

    saveToken(data.access_token);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

function buildRequestOptions(options = {}) {
  return {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };
}

async function requestJson(url, options = {}) {
  let response = await fetch(url, buildRequestOptions(options));
  const hasAuthHeader = Boolean(options.headers?.Authorization || options.headers?.authorization);

  if (response.status === 401 && hasAuthHeader && !url.includes("/refresh-token")) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      response = await fetch(
        url,
        buildRequestOptions({
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${getToken()}`,
          },
        })
      );
    } else if (window.location.pathname !== "/login") {
      window.location.href = "/login";
      return;
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    let message = "Request failed";
    if (typeof data === "string") message = data;
    else if (data?.detail && typeof data.detail === "string") message = data.detail;
    else if (Array.isArray(data?.detail)) {
      message = data.detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
    } else if (data?.detail) {
      message = JSON.stringify(data.detail);
    }
    throw new Error(message);
  }

  return data;
}

/* ---------- Shared formatting ---------- */

function currencyInfo(code) {
  return CURRENCY_MAP[code] || { code, name: code, symbol: code };
}

function formatMoney(value, currency, digits = 2) {
  const info = currencyInfo(currency);
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);

  return `${info.symbol} ${number} ${currency}`.trim();
}

function formatRate(value, digits = 4) {
  return Number(value).toFixed(digits);
}

function pairCodes(pair) {
  const [base, quote] = pair.split("/");
  return { base, quote };
}

/* ---------- Authentication ---------- */

function showAuthMessage(message, isError = false) {
  const messageEl = document.getElementById("auth-message");
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.classList.toggle("error", isError);
  messageEl.style.display = message ? "block" : "none";
}

function showAuthPanel(panelId) {
  document.querySelectorAll(".auth-form-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

function initAuthFlow() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  if (!loginForm || !registerForm) return;

  document.getElementById("show-register")?.addEventListener("click", () => {
    showAuthMessage("");
    showAuthPanel("register-panel");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showAuthMessage("");

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const rememberMe = document.getElementById("remember-me")?.checked ?? false;

    try {
      const result = await requestJson("/login", {
        method: "POST",
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      });

      saveToken(result.access_token);
      saveRefreshToken(result.refresh_token);
      saveUser(result.user);
      window.location.href = "/dashboard";
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showAuthMessage("");

    const payload = {
      first_name: document.getElementById("register-first-name").value.trim(),
      surname: document.getElementById("register-surname").value.trim(),
      email: document.getElementById("register-email").value.trim(),
      country: document.getElementById("register-country").value.trim(),
      password: document.getElementById("register-password").value,
    };

    try {
      const result = await requestJson("/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      document.getElementById("login-email").value = payload.email;
      registerForm.reset();
      showAuthPanel("login-panel");
      showAuthMessage(result.message || "Registration successful. You can now log in.");
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });
}

/* ---------- Theme ---------- */

function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);

  const light = document.getElementById("theme-light");
  const dark = document.getElementById("theme-dark");
  if (light) light.classList.toggle("picked", theme !== "dark");
  if (dark) dark.classList.toggle("picked", theme === "dark");

  const toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.textContent = theme === "dark" ? "☼" : "◐";
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(saved || preferred);

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  });

  document.getElementById("theme-light")?.addEventListener("click", () => applyTheme("light"));
  document.getElementById("theme-dark")?.addEventListener("click", () => applyTheme("dark"));
}

/* ---------- Dashboard identity/navigation ---------- */

let currentView = null;
let cachedHistory = [];
let cachedHoldings = [];
let cachedAlerts = [];
let cachedFavorites = [];
let latestRates = {};

function updateIdentity() {
  const user = getStoredUser();
  const name = [user?.first_name, user?.surname].filter(Boolean).join(" ").trim() || user?.email || "Guest";
  const firstName = user?.first_name || name.split(" ")[0] || "there";

  document.getElementById("sidebar-user-name")?.replaceChildren(document.createTextNode(name));
  document.getElementById("overview-greeting")?.replaceChildren(document.createTextNode(`Good morning, ${firstName}`));
  document.getElementById("settings-account-name")?.replaceChildren(document.createTextNode(name));
  document.getElementById("settings-account-email")?.replaceChildren(document.createTextNode(user?.email || "Not signed in"));

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";

  document.getElementById("sidebar-avatar")?.replaceChildren(document.createTextNode(initials));
}

function updateNavigation(view) {
  currentView = view;

  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.view) button.classList.toggle("active", button.dataset.view === view && button.classList.contains("nav-link"));
  });

  document.querySelectorAll(".mobile-tab[data-view]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.view === view);
  });

  document.querySelectorAll(".page-view").forEach((panel) => {
    panel.hidden = panel.id !== `view-${view}`;
  });

  const name = PAGE_META[view] || "Overview";
  document.getElementById("breadcrumb-page")?.replaceChildren(document.createTextNode(name));

  if (view === "overview") loadOverview();
  if (view === "convert") previewConversion();
  if (view === "trends") loadTrend();
  if (view === "portfolio") loadPortfolio();
  if (view === "history") loadHistory();
  if (view === "alerts") loadAlerts();
}

function initNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.id === "mobile-more-button") return;
      showView(button.dataset.view);
      closeMoreDrawer();
    });
  });

  document.getElementById("notification-button")?.addEventListener("click", () => showView("alerts"));

  document.getElementById("mobile-more-button")?.addEventListener("click", () => {
    document.getElementById("more-drawer").hidden = false;
  });

  document.getElementById("close-more")?.addEventListener("click", closeMoreDrawer);
  document.getElementById("more-drawer")?.addEventListener("click", (event) => {
    if (event.target.id === "more-drawer") closeMoreDrawer();
  });
}

function showView(view) {
  if (!PAGE_META[view]) view = "overview";

  // Do not reload the currently visible view when a test or user clicks
  // its active navigation item again. This prevents competing async renders
  // from replacing DOM nodes while a star is being clicked.
  if (currentView === view) return;

  updateNavigation(view);
  history.replaceState(null, "", `#${view}`);
}

function closeMoreDrawer() {
  const drawer = document.getElementById("more-drawer");
  if (drawer) drawer.hidden = true;
}

/* ---------- Currency controls ---------- */

function populateCurrencySelect(select, selected = "USD") {
  if (!select) return;

  select.innerHTML = CURRENCIES.map(([code, name, symbol]) =>
    `<option value="${code}">${code} · ${name}${symbol ? ` (${symbol})` : ""}</option>`
  ).join("");

  if (CURRENCY_MAP[selected]) select.value = selected;
}

function populateCurrencyControls() {
  const base = document.getElementById("base-currency");
  const target = document.getElementById("target-currency");
  const holding = document.getElementById("holding-currency");
  const settingsBase = document.getElementById("settings-base-currency");

  populateCurrencySelect(base, "USD");
  populateCurrencySelect(target, "ZAR");
  populateCurrencySelect(holding, "USD");
  populateCurrencySelect(settingsBase, localStorage.getItem("base_currency") || "USD");

  document.getElementById("settings-base-currency")?.addEventListener("change", async (event) => {
    localStorage.setItem("base_currency", event.target.value);
    document.getElementById("portfolio-base").textContent = event.target.value;
    await loadPortfolio();
    await loadOverview();
  });
}

function buildPairOptions() {
  const options = [...new Set([...cachedFavorites.map((f) => `${f.base_currency}/${f.quote_currency}`), ...WATCHED_PAIRS])];
  const select = document.getElementById("trend-pair");
  if (!select) return;

  const current = select.value;
  select.innerHTML = options.map((pair) => `<option value="${pair}">${pair}</option>`).join("");
  select.value = options.includes(current) ? current : options[0] || "USD/ZAR";
}

/* ---------- Conversion ---------- */

let previewTimer = null;
let latestPreview = null;

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(previewConversion, 300);
}

async function previewConversion() {
  const amountInput = document.getElementById("amount-input");
  const from = document.getElementById("base-currency")?.value;
  const to = document.getElementById("target-currency")?.value;
  if (!amountInput || !from || !to) return;

  const amount = Number(amountInput.value || 0);
  if (!amount || amount <= 0) {
    document.getElementById("converted-output").textContent = "—";
    document.getElementById("rate-badge").textContent = `1 ${from} = — ${to}`;
    return;
  }

  try {
    const result = await requestJson("/convert/preview", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ amount, from_currency: from, to_currency: to }),
    });

    latestPreview = result;
    document.getElementById("converted-output").textContent = formatMoney(result.converted_amount, result.to_currency);
    document.getElementById("rate-badge").textContent = `1 ${result.from_currency} = ${formatRate(result.rate, 5)} ${result.to_currency}`;
    document.getElementById("rate-source").textContent = result.source === "live" ? "Live" : "Cached";
    document.getElementById("convert-source").textContent = result.source === "live" ? "Provider" : "Cache";
    document.getElementById("convert-total").textContent = formatMoney(result.amount, result.from_currency);
  } catch (error) {
    latestPreview = null;
    document.getElementById("converted-output").textContent = "—";
    document.getElementById("rate-source").textContent = "Unavailable";
    document.getElementById("convert-source").textContent = "Unavailable";
    console.error(error);
  }
}

function initConversion() {
  const amount = document.getElementById("amount-input");
  const base = document.getElementById("base-currency");
  const target = document.getElementById("target-currency");
  const form = document.getElementById("convert-form");

  amount?.addEventListener("input", () => {
    if (amount.value.length > 12) amount.value = amount.value.slice(0, 12);
    schedulePreview();
  });

  base?.addEventListener("change", schedulePreview);
  target?.addEventListener("change", schedulePreview);

  document.getElementById("swap-currency")?.addEventListener("click", () => {
    const current = base.value;
    base.value = target.value;
    target.value = current;
    previewConversion();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!latestPreview) {
      await previewConversion();
      if (!latestPreview) return;
    }

    try {
      const result = await requestJson("/convert", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          amount: latestPreview.amount,
          from_currency: latestPreview.from_currency,
          to_currency: latestPreview.to_currency,
        }),
      });

      const success = document.getElementById("conversion-success");
      success.hidden = false;
      success.textContent = getToken()
        ? "✓ Conversion recorded in your activity."
        : "✓ Conversion completed. Sign in to keep it in your personal History.";

      await loadHistory();
      window.setTimeout(() => { success.hidden = true; }, 3500);
      latestPreview = { ...result };
    } catch (error) {
      alert(error.message);
    }
  });
}

/* ---------- Favorites ---------- */

async function loadFavorites() {
  if (!getToken()) {
    cachedFavorites = [];
    renderFavoriteState();
    buildPairOptions();
    return;
  }

  try {
    cachedFavorites = await requestJson("/favorites", { headers: authHeaders() });
    renderFavoriteState();
    buildPairOptions();
  } catch (error) {
    console.error(error);
  }
}

function renderFavoriteState() {
  const count = cachedFavorites.length;
  document.getElementById("overview-favorites-value")?.replaceChildren(document.createTextNode(String(count)));

  const navCount = document.getElementById("nav-alert-count");
  const notificationDot = document.getElementById("notification-dot");
  const alertCount = cachedAlerts.filter((item) => !item.triggered).length;

  if (navCount) {
    navCount.hidden = alertCount === 0;
    navCount.textContent = String(alertCount);
  }
  if (notificationDot) notificationDot.hidden = alertCount === 0;

  const trendPairs = cachedFavorites.map((fav) => `${fav.base_currency}/${fav.quote_currency}`);
  if (trendPairs.length && document.getElementById("trend-pair")) {
    document.getElementById("trend-pair").value = trendPairs[0];
  }
}

async function toggleFavoritePair(base, quote) {
  if (!getToken()) {
    alert("Please log in to save favorite pairs.");
    return;
  }

  const existing = cachedFavorites.find(
    (fav) => fav.base_currency === base && fav.quote_currency === quote
  );

  try {
    if (existing) {
      await requestJson(`/favorites/${existing.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } else {
      await requestJson("/favorites", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ base_currency: base, quote_currency: quote }),
      });
    }

    await loadFavorites();
    await renderOverviewPairs();
  } catch (error) {
    alert(error.message);
  }
}

function isFavorite(base, quote) {
  return cachedFavorites.some(
    (fav) => fav.base_currency === base && fav.quote_currency === quote
  );
}

/* ---------- Rates + Overview ---------- */

async function fetchRates(base = "USD") {
  const result = await requestJson(`/rates?base_currency=${encodeURIComponent(base)}`, {
    method: "POST",
  });
  latestRates = result;
  return result;
}

async function fetchPairCardData(pair) {
  const { base, quote } = pairCodes(pair);

  try {
    const preview = await requestJson("/convert/preview", {
      method: "POST",
      body: JSON.stringify({ amount: 1, from_currency: base, to_currency: quote }),
    });

    let changeText = "No history";
    let changeClass = "neutral-foot";

    const points = await requestJson(`/trends/${base}/${quote}?days=7`);
    if (points.length >= 2) {
      const first = Number(points[0].rate);
      const last = Number(points[points.length - 1].rate);
      const change = first ? ((last - first) / first) * 100 : 0;
      changeText = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
      changeClass = change >= 0 ? "positive" : "negative";
    }

    return {
      pair,
      base,
      quote,
      rate: formatRate(preview.rate, 4),
      changeText,
      changeClass,
      source: preview.source === "live" ? "LIVE" : "CACHED",
    };
  } catch {
    return {
      pair,
      base,
      quote,
      rate: "—",
      changeText: "Unavailable",
      changeClass: "neutral-foot",
      source: "UNAVAILABLE",
    };
  }
}

function pairCardMarkup(data, mode = "favorite") {
  const favorite = isFavorite(data.base, data.quote);
  const label = favorite ? "Remove from favorites" : "Add to favorites";

  return `
    <article class="panel pair-card" data-favorite-pair="${data.pair}">
      <div class="pair-top">
        <div class="pair-codes">
          <span class="pair-badge">${data.base}</span>
          <span class="pair-slash">/</span>
          <span>${data.quote}</span>
        </div>
        <button
          class="star-button"
          type="button"
          data-pair-toggle="${data.pair}"
          aria-label="${label}"
          title="${label}"
        >${mode === "favorite" ? "★" : "☆"}</button>
      </div>
      <div class="pair-rate tabular">${data.rate}</div>
      <div class="pair-bottom">
        <span class="rate-chip ${data.changeClass === "positive" ? "positive" : data.changeClass === "negative" ? "negative" : "neutral-foot"}">${data.changeText}</span>
        <span class="eyebrow">${data.source}</span>
      </div>
    </article>
  `;
}

function bindFavoriteButtons(container) {
  // Bind each star after the cards are rendered because the cards use innerHTML.
  // Delegated event handling also avoids keeping references to replaced DOM nodes.
  if (!container || container.dataset.favoriteBound === "true") return;
  container.dataset.favoriteBound = "true";

  container.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-pair-toggle]");
    if (!button || !container.contains(button)) return;

    const pair = button.dataset.pairToggle;
    if (!pair) return;

    const [base, quote] = pair.split("/");
    await toggleFavoritePair(base, quote);
  });
}

async function renderFavoriteCandidates() {
  const section = document.getElementById("favorite-candidates-section");
  const container = document.getElementById("favorite-candidates");
  if (!section || !container) return;

  const availablePairs = WATCHED_PAIRS.filter((pair) => {
    const { base, quote } = pairCodes(pair);
    return !isFavorite(base, quote);
  });

  if (!availablePairs.length) {
    section.hidden = true;
    container.innerHTML = "";
    return;
  }

  const cards = await Promise.all(availablePairs.map(fetchPairCardData));
  container.innerHTML = cards.map((card) => pairCardMarkup(card, "candidate")).join("");
  section.hidden = false;
}

async function renderOverviewPairs() {
  const container = document.getElementById("overview-pairs");
  if (!container) return;

  // A new account must see an empty personal watchlist.
  // Suggested pairs are rendered separately so they do not appear as saved favorites.
  if (!cachedFavorites.length) {
    container.innerHTML = `
      <article id="overview-favorites-empty" class="panel pair-empty">
        <div class="favorite-empty-content">
          <b>Your favorites are empty</b>
          <span>Choose a currency pair below and click ☆ to add it to your personal watchlist.</span>
        </div>
      </article>
    `;
    await renderFavoriteCandidates();
    bindFavoriteButtons(container);
    bindFavoriteButtons(document.getElementById("favorite-candidates"));
    return;
  }

  const pairList = cachedFavorites.map((fav) => `${fav.base_currency}/${fav.quote_currency}`);
  const cards = await Promise.all(pairList.slice(0, 4).map(fetchPairCardData));

  container.innerHTML = cards.map((card) => pairCardMarkup(card, "favorite")).join("");
  await renderFavoriteCandidates();

  // Rebind once after rendering; the listener survives future innerHTML updates.
  bindFavoriteButtons(container);
  bindFavoriteButtons(document.getElementById("favorite-candidates"));
}


async function loadOverview() {
  updateIdentity();
  await Promise.allSettled([loadFavorites(), loadHistory(), loadPortfolio(), loadAlerts()]);
  await Promise.allSettled([loadOverviewStats(), renderOverviewPairs()]);
}

async function loadOverviewStats() {
  document.getElementById("overview-alerts-value")?.replaceChildren(
    document.createTextNode(String(cachedAlerts.filter((item) => !item.triggered).length))
  );
  document.getElementById("overview-alert-foot")?.replaceChildren(
    document.createTextNode(cachedAlerts.length ? "Watching saved thresholds" : "No thresholds saved")
  );

  try {
    const base = localStorage.getItem("base_currency") || "USD";
    const rates = await fetchRates(base);
    const total = cachedHoldings.reduce((sum, holding) => {
      const rate = holding.currency === base ? 1 : Number(rates.rates[holding.currency]);
      return sum + (rate > 0 ? Number(holding.amount_held) / rate : 0);
    }, 0);

    document.getElementById("overview-portfolio-value").textContent =
      formatMoney(total, base);

    document.getElementById("overview-portfolio-foot").textContent =
      cachedHoldings.length ? `${cachedHoldings.length} position${cachedHoldings.length === 1 ? "" : "s"} tracked` : "No holdings yet";
  } catch {
    document.getElementById("overview-portfolio-value").textContent = "—";
  }

  const now = new Date();
  const updated = now.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  document.getElementById("overview-date").textContent = updated.toUpperCase();
  document.getElementById("banner-updated").textContent = "Last checked " + updated;
  document.getElementById("sidebar-updated").textContent = updated;
}

/* ---------- Portfolio ---------- */

async function loadPortfolio() {
  const list = document.getElementById("portfolio-list");
  if (!list) return;

  if (!getToken()) {
    cachedHoldings = [];
    list.innerHTML = '<div class="empty-state"><b>Sign in to manage your portfolio</b><p>Your holdings are tied to your account.</p></div>';
    renderPortfolioTotal([]);
    return;
  }

  try {
    cachedHoldings = await requestJson("/portfolio", { headers: authHeaders() });
    renderPortfolioTotal(cachedHoldings);
    renderPortfolioRows();
  } catch (error) {
    console.error(error);
  }
}

async function renderPortfolioTotal(holdings) {
  const base = localStorage.getItem("base_currency") || "USD";
  document.getElementById("portfolio-base").textContent = base;
  document.getElementById("portfolio-base-view")?.replaceChildren(document.createTextNode(base));

  try {
    const rates = await fetchRates(base);
    const total = holdings.reduce((sum, holding) => {
      const rate = holding.currency === base ? 1 : Number(rates.rates[holding.currency]);
      return sum + (rate > 0 ? Number(holding.amount_held) / rate : 0);
    }, 0);

    document.getElementById("portfolio-total").textContent = formatMoney(total, base);
    renderAllocation(holdings, rates.rates, base);
  } catch {
    document.getElementById("portfolio-total").textContent = "—";
  }
}

function renderAllocation(holdings, rates, base) {
  const container = document.getElementById("allocation-content");
  if (!container) return;

  if (!holdings.length) {
    container.innerHTML = '<div class="empty-state"><b>No allocation yet</b><p>Add a holding to see your portfolio composition.</p></div>';
    return;
  }

  const values = holdings.map((holding) => ({
    currency: holding.currency,
    value: holding.currency === base ? Number(holding.amount_held) : Number(holding.amount_held) / Number(rates[holding.currency] || 1),
  }));
  const total = values.reduce((sum, item) => sum + item.value, 0) || 1;

  container.innerHTML = values.map((item) => {
    const pct = Math.max((item.value / total) * 100, 0);
    return `
      <div class="allocation-row">
        <b>${item.currency}</b>
        <div class="allocation-bar"><span style="width:${Math.min(pct,100)}%"></span></div>
        <span class="tabular">${pct.toFixed(0)}%</span>
      </div>
    `;
  }).join("");
}

function renderPortfolioRows() {
  const list = document.getElementById("portfolio-list");
  const count = document.getElementById("portfolio-count");

  if (count) count.textContent = String(cachedHoldings.length);
  if (!list) return;

  list.innerHTML = "";
  if (!cachedHoldings.length) {
    list.innerHTML = '<div class="empty-state"><b>No holdings yet</b><p>Add a position to start tracking it.</p><button class="button" type="button" data-open-holding>+ Add holding</button></div>';
    list.querySelector("[data-open-holding]")?.addEventListener("click", openHoldingModal);
    return;
  }

  const base = localStorage.getItem("base_currency") || "USD";

  cachedHoldings.forEach((holding) => {
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <div class="table-currency">
        <span class="currency-badge currency-${holding.currency}">${holding.currency.slice(0,2)}</span>
        <div><b>${holding.currency}</b><small>${CURRENCY_MAP[holding.currency]?.name || "Currency"}</small></div>
      </div>
      <div class="tabular">${Number(holding.amount_held).toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
      <div class="tabular" data-holding-value>—</div>
      <div>${holding.notes || "—"}</div>
      <div class="row-actions"><button class="row-icon-button" type="button" data-remove-holding="${holding.id}" aria-label="Remove ${holding.currency} holding">×</button></div>
    `;

    row.querySelector("[data-remove-holding]")?.addEventListener("click", () => removeHolding(holding.id));
    list.appendChild(row);
  });

  fetchRates(base).then((rates) => {
    list.querySelectorAll("[data-holding-value]").forEach((element, index) => {
      const holding = cachedHoldings[index];
      const rate = holding.currency === base ? 1 : Number(rates.rates[holding.currency]);
      const value = rate > 0 ? Number(holding.amount_held) / rate : 0;
      element.textContent = formatMoney(value, base);
    });
  }).catch(() => {});
}

async function removeHolding(id) {
  try {
    await requestJson(`/portfolio/${id}`, { method: "DELETE", headers: authHeaders() });
    await loadPortfolio();
    await loadOverviewStats();
  } catch (error) {
    alert(error.message);
  }
}

function openHoldingModal() {
  if (!getToken()) {
    alert("Please log in first.");
    return;
  }

  document.getElementById("holding-form")?.reset();
  document.getElementById("holding-modal").hidden = false;
  document.getElementById("holding-currency").value = "USD";
  document.getElementById("holding-amount")?.focus();
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

function initHoldingModal() {
  document.getElementById("open-holding-modal")?.addEventListener("click", openHoldingModal);

  document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.modal));
  });

  document.getElementById("holding-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "holding-modal") closeModal("holding-modal");
  });

  document.getElementById("holding-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!getToken()) {
      alert("Please log in first.");
      return;
    }

    const payload = {
      currency: document.getElementById("holding-currency").value,
      amount_held: Number(document.getElementById("holding-amount").value),
      notes: document.getElementById("holding-label").value.trim() || null,
    };

    try {
      await requestJson("/portfolio", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      closeModal("holding-modal");
      await loadPortfolio();
      await loadOverviewStats();
    } catch (error) {
      alert(error.message);
    }
  });
}

/* ---------- History ---------- */

async function loadHistory() {
  const list = document.getElementById("history-list");
  if (!list) return;

  if (!getToken()) {
    cachedHistory = [];
    list.innerHTML = '<div class="empty-state"><b>Sign in to view your history</b><p>Conversions are associated with your authenticated account.</p></div>';
    document.getElementById("history-count").textContent = "0 records";
    return;
  }

  try {
    cachedHistory = await requestJson("/history/recent?limit=50", { headers: authHeaders() });
    renderHistory();
  } catch (error) {
    console.error(error);
  }
}

function renderHistory() {
  const list = document.getElementById("history-list");
  if (!list) return;

  const search = (document.getElementById("history-search")?.value || "").trim().toLowerCase();
  const filter = document.getElementById("history-filter")?.value || "All activity";

  const filtered = cachedHistory.filter((record) => {
    const matchesFilter =
      filter === "All activity" ||
      record.base_currency === filter ||
      record.quote_currency === filter;

    const haystack = `${record.base_currency} ${record.quote_currency} ${record.amount}`.toLowerCase();
    return matchesFilter && (!search || haystack.includes(search));
  });

  document.getElementById("history-count").textContent =
    `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;

  list.innerHTML = "";

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state"><b>No conversions found</b><p>Try another currency or complete a new conversion.</p></div>';
    return;
  }

  filtered.forEach((record) => {
    const row = document.createElement("div");
    row.className = "table-row";
    const timestamp = record.timestamp ? new Date(record.timestamp) : null;

    row.innerHTML = `
      <div class="tabular">${timestamp ? timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div>
      <div class="conversion-pair"><b>${record.base_currency} / ${record.quote_currency}</b><small>${timestamp ? timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</small></div>
      <div class="tabular">${formatMoney(record.amount, record.base_currency)}</div>
      <div class="tabular receive-amount">${formatMoney(record.converted_amount, record.quote_currency)}</div>
      <div class="tabular">${formatRate(record.rate_used, 4)}</div>
    `;

    list.appendChild(row);
  });
}

function initHistory() {
  document.getElementById("history-search")?.addEventListener("input", renderHistory);
  document.getElementById("history-filter")?.addEventListener("change", renderHistory);
  document.getElementById("refresh-history")?.addEventListener("click", loadHistory);
}

/* ---------- Alerts ---------- */

async function loadAlerts() {
  const list = document.getElementById("alerts-list");
  if (!list) return;

  if (!getToken()) {
    cachedAlerts = [];
    renderAlerts();
    return;
  }

  try {
    cachedAlerts = await requestJson("/alerts", { headers: authHeaders() });
    renderAlerts();
    buildAlertPairs();
  } catch (error) {
    console.error(error);
  }
}

function renderAlerts() {
  const active = cachedAlerts.filter((item) => !item.triggered);
  document.getElementById("alert-summary-count").textContent = String(active.length);
  document.getElementById("alerts-count").textContent = String(active.length);
  document.getElementById("overview-alerts-value").textContent = String(active.length);

  const navCount = document.getElementById("nav-alert-count");
  const notificationDot = document.getElementById("notification-dot");
  if (navCount) {
    navCount.hidden = active.length === 0;
    navCount.textContent = String(active.length);
  }
  if (notificationDot) notificationDot.hidden = active.length === 0;

  const list = document.getElementById("alerts-list");
  if (!list) return;

  list.innerHTML = "";
  if (!active.length) {
    list.innerHTML = '<div class="panel empty-state"><span>◉</span><b>No active alerts</b><p>Create a rate alert to keep track of a currency pair.</p><button class="button" type="button" data-open-alert>+ Create alert</button></div>';
    list.querySelector("[data-open-alert]")?.addEventListener("click", openAlertModal);
    return;
  }

  active.forEach((alert) => {
    const pair = `${alert.base_currency}/${alert.quote_currency}`;
    const row = document.createElement("div");
    row.className = "alert-card panel";
    row.innerHTML = `
      <span class="alert-card-icon">◉</span>
      <div class="alert-main">
        <div><b>${pair}</b><span class="alert-condition">when rate goes ${alert.direction}</span></div>
        <small>Alert me when 1 ${alert.base_currency} ${alert.direction} ${formatRate(alert.target_rate)} ${alert.quote_currency}</small>
      </div>
      <div class="alert-target"><small>Target rate</small><b class="tabular">${formatRate(alert.target_rate)}</b></div>
      <span class="alert-status"><i></i> Watching</span>
      <button class="row-icon-button" type="button" data-remove-alert="${alert.id}" aria-label="Remove ${pair} alert">×</button>
    `;

    row.querySelector("[data-remove-alert]")?.addEventListener("click", () => removeAlert(alert.id));
    list.appendChild(row);
  });
}

function buildAlertPairs() {
  const select = document.getElementById("alert-pair");
  if (!select) return;

  const pairs = [...new Set([
    ...WATCHED_PAIRS,
    ...cachedFavorites.map((fav) => `${fav.base_currency}/${fav.quote_currency}`),
  ])];

  select.innerHTML = pairs.map((pair) => `<option value="${pair}">${pair}</option>`).join("");
  updateAlertPreview();
}

function initAlertModal() {
  document.getElementById("open-alert-modal")?.addEventListener("click", openAlertModal);

  document.getElementById("alert-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "alert-modal") closeModal("alert-modal");
  });

  document.getElementById("alert-direction")?.addEventListener("change", updateAlertPreview);
  document.getElementById("alert-pair")?.addEventListener("change", updateAlertPreview);
  document.getElementById("alert-target")?.addEventListener("input", updateAlertPreview);

  document.getElementById("alert-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!getToken()) {
      alert("Please log in first.");
      return;
    }

    const pair = document.getElementById("alert-pair").value;
    const { base, quote } = pairCodes(pair);

    try {
      await requestJson("/alerts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          base_currency: base,
          quote_currency: quote,
          direction: document.getElementById("alert-direction").value,
          target_rate: Number(document.getElementById("alert-target").value),
        }),
      });

      closeModal("alert-modal");
      await loadAlerts();
      await loadOverviewStats();
      if (currentView === "trends") await loadTrend();
    } catch (error) {
      alert(error.message);
    }
  });
}

function openAlertModal() {
  if (!getToken()) {
    alert("Please log in first.");
    return;
  }

  document.getElementById("alert-create-form")?.reset();
  buildAlertPairs();
  document.getElementById("alert-modal").hidden = false;
  updateAlertPreview();
  document.getElementById("alert-target")?.focus();
}

function updateAlertPreview() {
  const pair = document.getElementById("alert-pair")?.value || "USD/ZAR";
  const direction = document.getElementById("alert-direction")?.value || "above";
  const target = document.getElementById("alert-target")?.value || "—";

  document.getElementById("alert-preview-pair").textContent = pair;
  document.getElementById("alert-preview-direction").textContent = direction;
  document.getElementById("alert-preview-target").textContent =
    target === "—" ? "—" : formatRate(Number(target));
}

async function removeAlert(id) {
  try {
    await requestJson(`/alerts/${id}`, { method: "DELETE", headers: authHeaders() });
    await loadAlerts();
    await loadOverviewStats();
    if (currentView === "trends") await loadTrend();
  } catch (error) {
    alert(error.message);
  }
}

/* ---------- Trends ---------- */

async function loadTrend() {
  const select = document.getElementById("trend-pair");
  const chart = document.getElementById("trend-chart");
  if (!select || !chart) return;

  const pair = select.value || "USD/ZAR";
  const { base, quote } = pairCodes(pair);
  const days = Number(window.__trendDays || 30);

  document.getElementById("trend-chart-title").textContent = `${pair} performance`;

  try {
    const points = await requestJson(`/trends/${base}/${quote}?days=${days}`);
    const rates = points.map((point) => Number(point.rate));

    if (!rates.length) {
      document.getElementById("trend-status").textContent = "No stored observations";
      ["trend-current", "trend-high", "trend-low"].forEach((id) => {
        document.getElementById(id).textContent = "—";
      });
      document.getElementById("trend-change").textContent = "—";
      document.getElementById("trend-threshold-message").textContent =
        "No stored trend data is available for this pair and range yet.";
      renderTrendChart([], null);
      return;
    }

    const current = rates.at(-1);
    const first = rates[0];
    const high = Math.max(...rates);
    const low = Math.min(...rates);
    const change = first ? ((current - first) / first) * 100 : 0;

    document.getElementById("trend-current").textContent = formatRate(current, 5) + " " + quote;
    document.getElementById("trend-high").textContent = formatRate(high, 5);
    document.getElementById("trend-low").textContent = formatRate(low, 5);
    const changeEl = document.getElementById("trend-change");
    changeEl.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    changeEl.className = change >= 0 ? "gain" : "loss";

    document.getElementById("trend-status").textContent = `${points.length} stored observations`;

    const alert = cachedAlerts.find(
      (item) => item.base_currency === base && item.quote_currency === quote && !item.triggered
    );
    const threshold = alert ? Number(alert.target_rate) : null;

    if (threshold == null) {
      document.getElementById("trend-threshold-message").textContent =
        "No active threshold for this pair.";
    } else {
      const state = current >= threshold ? "above" : "below";
      document.getElementById("trend-threshold-message").innerHTML =
        `<b>Active threshold:</b> ${formatRate(threshold, 5)} ${quote}. Current rate is ${state} the threshold; the chart marks the reference line in amber.`;
    }

    renderTrendChart(points, threshold);
  } catch (error) {
    console.error(error);
    document.getElementById("trend-status").textContent = "Unable to load";
  }
}

function renderTrendChart(points, threshold) {
  // The actual chart is rendered by the React/Recharts widget.
  // main.js only passes the API data and active alert threshold to it.
  const chart = document.getElementById("trend-chart");
  if (!chart) return;

  const pair = document.getElementById("trend-pair")?.value || "USD/ZAR";
  const payload = { points, threshold: threshold ?? null, pair };

  window.__fxTrendPayload = payload;
  window.dispatchEvent(new CustomEvent("fx-trend-data", { detail: payload }));
}

function initTrends() {
  window.__trendDays = 30;

  document.querySelectorAll("#trend-range button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#trend-range button").forEach((item) => item.classList.remove("chosen"));
      button.classList.add("chosen");
      window.__trendDays = Number(button.dataset.days);
      loadTrend();
    });
  });

  document.getElementById("trend-pair")?.addEventListener("change", loadTrend);
}

/* ---------- Settings + boot ---------- */

function initLogout() {
  document.getElementById("logout-button")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "/login";
  });
}

function initSettingsNavigation() {
  document.querySelectorAll(".settings-nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".settings-nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

function initDashboard() {
  if (!document.querySelector(".dashboard-body")) return;

  updateIdentity();
  populateCurrencyControls();
  initNavigation();
  initConversion();
  initHoldingModal();
  initHistory();
  initAlertModal();
  initTrends();
  initTheme();
  initLogout();
  initSettingsNavigation();

  const pair = window.location.hash.replace("#", "").trim();
  const initialView = PAGE_META[pair] ? pair : "overview";
  showView(initialView);

  document.getElementById("more-drawer")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeMoreDrawer();
  });

  // The selected view is responsible for loading its own data.
  // Avoid a second competing overview load, which can rerender the favorite cards
  // while a Selenium test is clicking a star and cause stale element errors.
  previewConversion();
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthFlow();
  initDashboard();
});
