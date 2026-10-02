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

const PAGE_META = {
  "overview-panel": ["Overview", "A quick view of your currency activity."],
  "convert-panel": ["Convert", "Live conversion with automatic rate updates."],
  "trends-panel": ["Trends", "Stored exchange-rate history and threshold context."],
  "portfolio-panel": ["Portfolio", "Track the currencies you currently hold."],
  "history-panel": ["History", "Review conversions saved to your account."],
  "alerts-panel": ["Alerts", "Manage exchange-rate thresholds."],
  "settings-panel": ["Settings", "Manage appearance and session preferences."],
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
  const rawUser = localStorage.getItem("current_user");
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser);
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

  const hasAuthHeader = Boolean(
    options.headers?.Authorization || options.headers?.authorization
  );

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
    else if (data && typeof data.detail === "string") message = data.detail;
    else if (data && Array.isArray(data.detail)) {
      message = data.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
    } else if (data?.detail) {
      message = JSON.stringify(data.detail);
    }
    throw new Error(message);
  }

  return data;
}

function showAuthMessage(message, isError = false) {
  const messageEl = document.getElementById("auth-message");
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.classList.toggle("error", isError);
  messageEl.style.display = message ? "block" : "none";
}

function showPanel(panelId) {
  const pills = document.querySelectorAll(".nav-pill[data-panel]");
  pills.forEach((pill) => pill.classList.toggle("active", pill.dataset.panel === panelId));

  document.querySelectorAll(".dashboard-panel").forEach((panel) => {
    panel.hidden = panel.id !== panelId;
    panel.classList.toggle("active-panel", panel.id === panelId);
  });

  const [title, subtitle] = PAGE_META[panelId] || ["Dashboard", ""];
  document.getElementById("page-title")?.replaceChildren(document.createTextNode(title));
  document.getElementById("page-subtitle")?.replaceChildren(document.createTextNode(subtitle));

  if (panelId === "overview-panel") loadOverview();
  if (panelId === "trends-panel") loadTrend();
  if (panelId === "portfolio-panel") loadPortfolio();
  if (panelId === "history-panel") loadHistory();
  if (panelId === "alerts-panel") loadAlerts();
}

function initPanelSwitching() {
  document.querySelectorAll(".nav-pill[data-panel]").forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.panel));
  });

  document.querySelectorAll("[data-panel-target]").forEach((button) => {
    button.addEventListener("click", () => showPanel(button.dataset.panelTarget));
  });
}

function updateUserIdentity() {
  const user = getStoredUser();
  const displayName = [user?.first_name, user?.surname].filter(Boolean).join(" ").trim()
    || user?.email
    || "Guest";

  const nameElements = ["user-name", "settings-name"];
  nameElements.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = displayName;
  });

  const avatar = document.querySelector(".user-avatar");
  if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase() || "U";

  const email = document.getElementById("settings-email");
  if (email) email.textContent = user?.email || "Not signed in";
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  localStorage.setItem("theme", theme);

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  document.getElementById("theme-toggle")?.setAttribute("aria-label", label);
  document.getElementById("theme-toggle")?.setAttribute("title", label);
  document.getElementById("settings-theme-toggle")?.replaceChildren(
    document.createTextNode(theme === "dark" ? "Use light mode" : "Use dark mode")
  );
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(saved || preferred);

  ["theme-toggle", "settings-theme-toggle"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
      renderTrendChart(window.__lastTrendPoints || [], window.__activeTrendThreshold);
    });
  });
}

function populateCurrencySelects() {
  document.querySelectorAll("select").forEach((select) => {
    if (!["base-currency", "target-currency", "trend-base", "trend-quote", "alert-base", "alert-quote"].includes(select.id)) return;
    const current = select.value;
    select.innerHTML = CURRENCIES.map(([code, name, symbol]) =>
      `<option value="${code}">${code} — ${name} ${symbol ? `(${symbol})` : ""}</option>`
    ).join("");
    if (CURRENCY_MAP[current]) select.value = current;
  });

  const defaults = {
    "base-currency": "USD",
    "target-currency": "ZAR",
    "trend-base": "USD",
    "trend-quote": "ZAR",
    "alert-base": "USD",
    "alert-quote": "ZAR",
  };

  Object.entries(defaults).forEach(([id, value]) => {
    const select = document.getElementById(id);
    if (select && !select.value) select.value = value;
  });
}

function initCurrencySearch() {
  document.querySelectorAll(".currency-search").forEach((input) => {
    const targetId = input.dataset.targetSelect;
    const select = document.getElementById(targetId);
    if (!select) return;

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      const current = select.value;

      Array.from(select.options).forEach((option) => {
        const currency = CURRENCY_MAP[option.value];
        const matches = !query
          || option.value.toLowerCase().includes(query)
          || currency.name.toLowerCase().includes(query);
        option.hidden = !matches;
      });

      if (select.value === current && select.options.length) {
        select.value = current;
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const firstVisible = Array.from(select.options).find((option) => !option.hidden);
        if (firstVisible) {
          select.value = firstVisible.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          input.value = "";
          Array.from(select.options).forEach((option) => { option.hidden = false; });
        }
      }
    });
  });
}

function currencyDisplay(code, amount, digits = 2) {
  const info = CURRENCY_MAP[code] || { symbol: "", name: code };
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(amount) || 0);

  return `${info.symbol ? info.symbol + " " : ""}${formatted} ${code}`.trim();
}

function scheduleConversionUpdate() {
  clearTimeout(window.__conversionTimer);
  window.__conversionTimer = setTimeout(updateConversion, 350);
}

async function updateConversion() {
  const amountInput = document.getElementById("amount-input");
  const baseSelect = document.getElementById("base-currency");
  const targetSelect = document.getElementById("target-currency");
  if (!amountInput || !baseSelect || !targetSelect) return;

  const amount = Number(amountInput.value || 0);
  const fromCurrency = baseSelect.value;
  const toCurrency = targetSelect.value;

  if (!fromCurrency || !toCurrency) return;

  const output = document.getElementById("converted-output");
  const rateBadge = document.getElementById("rate-badge");
  const sourceLabel = document.getElementById("rate-source");
  const updatedLabel = document.getElementById("rate-updated");

  try {
    const result = await requestJson(`${API_BASE}/convert`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        amount,
        from_currency: fromCurrency,
        to_currency: toCurrency,
      }),
    });

    output.textContent = currencyDisplay(result.to_currency, result.converted_amount);
    rateBadge.textContent = `1 ${result.from_currency} = ${result.rate} ${result.to_currency}`;
    sourceLabel.textContent = result.source === "live" ? "Live rate" : "Cached rate";
    updatedLabel.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    document.getElementById("conversion-note").textContent =
      result.source === "live" ? "Based on the latest live provider response." : "Live data was unavailable, so the cached rate was used.";

    updateOverviewRate(result);
    window.__lastConversion = result;
  } catch (error) {
    output.textContent = "—";
    updatedLabel.textContent = "Unable to update";
    console.error(error);
  }
}

function initConverter() {
  const amountInput = document.getElementById("amount-input");
  const baseSelect = document.getElementById("base-currency");
  const targetSelect = document.getElementById("target-currency");
  const swapButton = document.getElementById("swap-currency");
  const star = document.getElementById("favorite-toggle");

  if (!amountInput) return;

  amountInput.setAttribute("maxlength", "12");
  amountInput.addEventListener("input", () => {
    if (amountInput.value.length > 12) amountInput.value = amountInput.value.slice(0, 12);
    scheduleConversionUpdate();
  });

  baseSelect.addEventListener("change", () => {
    updateConversion();
    updateFavoriteStar();
  });

  targetSelect.addEventListener("change", () => {
    updateConversion();
    updateFavoriteStar();
  });

  swapButton?.addEventListener("click", () => {
    const currentFrom = baseSelect.value;
    baseSelect.value = targetSelect.value;
    targetSelect.value = currentFrom;
    updateConversion();
    updateFavoriteStar();
  });

  star?.addEventListener("click", toggleFavorite);

  updateConversion();
}

async function loadFavorites() {
  const containers = [
    document.getElementById("favorite-chips"),
    document.getElementById("convert-favorite-chips"),
  ];

  if (!getToken()) {
    containers.forEach((container) => {
      if (container) container.innerHTML = '<p class="empty-copy">Log in to save favorite pairs.</p>';
    });
    updateFavoriteCount(0);
    return;
  }

  try {
    const favorites = await requestJson(`${API_BASE}/favorites`, { headers: authHeaders() });
    updateFavoriteCount(favorites.length);

    containers.forEach((container) => {
      if (!container) return;
      container.innerHTML = "";
      if (!favorites.length) {
        container.innerHTML = '<p class="empty-copy">No saved pairs yet.</p>';
        return;
      }

      favorites.forEach((fav) => {
        const chip = document.createElement("button");
        chip.className = "chip";
        chip.type = "button";
        chip.textContent = `${fav.base_currency}/${fav.quote_currency}`;
        chip.dataset.pair = `${fav.base_currency}-${fav.quote_currency}`;
        chip.addEventListener("click", () => {
          const [base, quote] = chip.dataset.pair.split("-");
          setCurrencyPair(base, quote);
          showPanel("convert-panel");
        });
        container.appendChild(chip);
      });
    });

    updateFavoriteStar();
  } catch (error) {
    console.error(error);
  }
}

function updateFavoriteCount(count) {
  document.getElementById("favorite-count")?.replaceChildren(document.createTextNode(String(count)));
  document.getElementById("overview-favorite-count")?.replaceChildren(document.createTextNode(String(count)));
}

async function updateFavoriteStar() {
  const star = document.getElementById("favorite-toggle");
  if (!star) return;

  if (!getToken()) {
    star.textContent = "☆";
    star.dataset.favoriteId = "";
    return;
  }

  const base = document.getElementById("base-currency").value;
  const quote = document.getElementById("target-currency").value;

  try {
    const favorites = await requestJson(`${API_BASE}/favorites`, { headers: authHeaders() });
    const match = favorites.find((fav) => fav.base_currency === base && fav.quote_currency === quote);
    star.textContent = match ? "★" : "☆";
    star.dataset.favoriteId = match ? match.id : "";
    star.setAttribute("aria-label", match ? "Remove pair from favorites" : "Add pair to favorites");
  } catch (error) {
    console.error(error);
  }
}

async function toggleFavorite() {
  const star = document.getElementById("favorite-toggle");
  if (!getToken()) {
    alert("Please log in to save favorites.");
    return;
  }

  const base = document.getElementById("base-currency").value;
  const quote = document.getElementById("target-currency").value;

  try {
    if (star.dataset.favoriteId) {
      await requestJson(`${API_BASE}/favorites/${star.dataset.favoriteId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
    } else {
      await requestJson(`${API_BASE}/favorites`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ base_currency: base, quote_currency: quote }),
      });
    }
    await loadFavorites();
  } catch (error) {
    alert(error.message);
  }
}

function setCurrencyPair(base, quote) {
  ["base-currency", "trend-base", "alert-base"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = base;
  });

  ["target-currency", "trend-quote", "alert-quote"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = quote;
  });

  updateConversion();
  updateFavoriteStar();
}

function updateOverviewRate(result) {
  if (!result) return;
  document.getElementById("overview-rate")?.replaceChildren(
    document.createTextNode(`${result.rate} ${result.to_currency}`)
  );
  document.getElementById("overview-pair")?.replaceChildren(
    document.createTextNode(`${result.from_currency} / ${result.to_currency}`)
  );
}

async function loadHistory() {
  const containers = [document.getElementById("history-list"), document.getElementById("overview-history-list")];
  if (!getToken()) {
    containers.forEach((list) => {
      if (list) list.innerHTML = '<li class="empty-copy">Log in to see your conversion history.</li>';
    });
    document.getElementById("history-count")?.replaceChildren(document.createTextNode("0 records"));
    return;
  }

  try {
    const history = await requestJson(`${API_BASE}/history/recent?limit=50`, { headers: authHeaders() });
    renderHistory(history);
  } catch (error) {
    console.error(error);
  }
}

function renderHistory(history) {
  const query = (document.getElementById("history-search")?.value || "").trim().toLowerCase();
  const filtered = history.filter((item) =>
    [item.base_currency, item.quote_currency].some((code) => code.toLowerCase().includes(query))
  );

  const list = document.getElementById("history-list");
  if (list) {
    list.innerHTML = "";
    if (!filtered.length) {
      list.innerHTML = '<div class="empty-state"><strong>No conversions found</strong><span>Try another currency or complete a new conversion.</span></div>';
    } else {
      filtered.forEach((item) => {
        const row = document.createElement("article");
        row.className = "record-row";
        const timestamp = item.created_at || item.timestamp;
        row.innerHTML = `
          <div class="record-main">
            <strong>${item.amount} ${item.base_currency} → ${currencyDisplay(item.quote_currency, item.converted_amount)}</strong>
            <div class="record-meta">
              <span>Rate: 1 ${item.base_currency} = ${item.rate} ${item.quote_currency}</span>
              <span>${timestamp ? new Date(timestamp).toLocaleString() : "Recent"}</span>
            </div>
          </div>
        `;
        list.appendChild(row);
      });
    }
  }

  const overviewList = document.getElementById("overview-history-list");
  if (overviewList) {
    overviewList.innerHTML = "";
    history.slice(0, 5).forEach((item) => {
      const li = document.createElement("li");
      li.className = "activity-item";
      li.innerHTML = `
        <div class="activity-main">
          <strong>${item.base_currency} → ${item.quote_currency}</strong>
          <span>${item.amount} converted to ${currencyDisplay(item.quote_currency, item.converted_amount)}</span>
        </div>
        <span class="record-meta">${item.rate}</span>
      `;
      overviewList.appendChild(li);
    });
    if (!history.length) {
      overviewList.innerHTML = '<li class="empty-state"><strong>No conversions yet</strong><span>Your saved conversions will appear here.</span></li>';
    }
  }

  document.getElementById("history-count")?.replaceChildren(
    document.createTextNode(`${filtered.length} record${filtered.length === 1 ? "" : "s"}`)
  );
}

async function loadPortfolio() {
  const list = document.getElementById("portfolio-list");
  if (!list) return;

  if (!getToken()) {
    list.innerHTML = '<div class="empty-state"><strong>Log in to manage your portfolio</strong><span>Your holdings are tied to your account.</span></div>';
    updatePortfolioSummary([]);
    return;
  }

  try {
    const holdings = await requestJson(`${API_BASE}/portfolio`, { headers: authHeaders() });
    updatePortfolioSummary(holdings);
    list.innerHTML = "";

    if (!holdings.length) {
      list.innerHTML = '<div class="empty-state"><strong>No holdings yet</strong><span>Add your first currency position to start tracking it.</span></div>';
      return;
    }

    holdings.forEach((holding) => {
      const row = document.createElement("article");
      row.className = "record-row";
      row.innerHTML = `
        <div class="record-main">
          <strong>${currencyDisplay(holding.currency, holding.amount_held, 2)}</strong>
          <div class="record-meta"><span>${holding.notes || "No note added"}</span></div>
        </div>
        <div class="record-actions">
          <button type="button" class="text-button small-danger" data-remove-portfolio="${holding.id}">Remove</button>
        </div>
      `;
      row.querySelector("[data-remove-portfolio]")?.addEventListener("click", async () => {
        try {
          await requestJson(`${API_BASE}/portfolio/${holding.id}`, {
            method: "DELETE",
            headers: authHeaders(),
          });
          loadPortfolio();
          loadOverview();
        } catch (error) {
          alert(error.message);
        }
      });
      list.appendChild(row);
    });

    const overviewList = document.getElementById("overview-portfolio-list");
    if (overviewList) {
      overviewList.innerHTML = "";
      holdings.slice(0, 5).forEach((holding) => {
        const li = document.createElement("li");
        li.className = "activity-item";
        li.innerHTML = `
          <div class="activity-main">
            <strong>${holding.currency}</strong>
            <span>${holding.amount_held} held</span>
          </div>
          <span class="record-meta">${holding.notes || ""}</span>
        `;
        overviewList.appendChild(li);
      });
      if (!holdings.length) overviewList.innerHTML = '<li class="empty-state"><strong>No holdings yet</strong><span>Add one from Portfolio.</span></li>';
    }
  } catch (error) {
    console.error(error);
  }
}

function updatePortfolioSummary(holdings) {
  document.getElementById("portfolio-count")?.replaceChildren(document.createTextNode(String(holdings.length)));
  document.getElementById("overview-portfolio-count")?.replaceChildren(document.createTextNode(String(holdings.length)));
}

function initPortfolioForm() {
  const form = document.getElementById("portfolio-form");
  const modal = document.getElementById("portfolio-modal");

  document.getElementById("open-portfolio-modal")?.addEventListener("click", () => {
    if (!getToken()) {
      alert("Please log in first.");
      return;
    }
    modal.hidden = false;
    document.getElementById("portfolio-currency")?.focus();
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.closeModal;
      const target = document.getElementById(id);
      if (target) target.hidden = true;
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getToken()) {
      alert("Please log in first.");
      return;
    }

    const payload = {
      currency: document.getElementById("portfolio-currency").value.trim().toUpperCase(),
      amount_held: Number(document.getElementById("portfolio-amount").value),
      notes: document.getElementById("portfolio-notes").value.trim() || null,
    };

    try {
      await requestJson(`${API_BASE}/portfolio`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      form.reset();
      modal.hidden = true;
      await loadPortfolio();
      loadOverview();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function loadAlerts() {
  const list = document.getElementById("alerts-list");
  if (!list) return;

  if (!getToken()) {
    list.innerHTML = '<div class="empty-state"><strong>Log in to manage alerts</strong><span>Your alert rules are tied to your account.</span></div>';
    updateAlertSummary([]);
    return;
  }

  try {
    const alerts = await requestJson(`${API_BASE}/alerts`, { headers: authHeaders() });
    updateAlertSummary(alerts);
    list.innerHTML = "";

    if (!alerts.length) {
      list.innerHTML = '<div class="empty-state"><strong>No alerts yet</strong><span>Create a threshold to monitor a pair.</span></div>';
      return;
    }

    alerts.forEach((alert) => {
      const row = document.createElement("article");
      row.className = "record-row";
      const status = alert.triggered
        ? '<span class="status-badge negative">Triggered</span>'
        : '<span class="status-badge positive">Watching</span>';

      row.innerHTML = `
        <div class="record-main">
          <strong>${alert.base_currency}/${alert.quote_currency} · ${alert.direction === "above" ? "Above" : "Below"} ${alert.target_rate}</strong>
          <div class="record-meta"><span>Current target status</span></div>
        </div>
        <div class="record-actions">
          ${status}
          <button type="button" class="text-button small-danger" data-remove-alert="${alert.id}">Remove</button>
        </div>
      `;

      row.querySelector("[data-remove-alert]")?.addEventListener("click", async () => {
        try {
          await requestJson(`${API_BASE}/alerts/${alert.id}`, {
            method: "DELETE",
            headers: authHeaders(),
          });
          await loadAlerts();
          loadOverview();
        } catch (error) {
          alert(error.message);
        }
      });

      list.appendChild(row);
    });

    updateTrendThresholdFromAlerts(alerts);
  } catch (error) {
    console.error(error);
  }
}

function updateAlertSummary(alerts) {
  const active = alerts.filter((alert) => !alert.triggered).length;
  document.getElementById("overview-alert-count")?.replaceChildren(document.createTextNode(String(active)));
}

function initAlertForm() {
  const form = document.getElementById("alert-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getToken()) {
      alert("Please log in first.");
      return;
    }

    const payload = {
      base_currency: document.getElementById("alert-base").value,
      quote_currency: document.getElementById("alert-quote").value,
      direction: document.getElementById("alert-direction").value,
      target_rate: Number(document.getElementById("alert-target").value),
    };

    try {
      await requestJson(`${API_BASE}/alerts`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      form.reset();
      await loadAlerts();
      loadOverview();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function loadOverview() {
  await Promise.allSettled([loadHistory(), loadPortfolio(), loadAlerts()]);
  const conversion = window.__lastConversion;
  if (conversion) updateOverviewRate(conversion);
}

async function loadTrend() {
  const base = document.getElementById("trend-base")?.value || document.getElementById("base-currency")?.value || "USD";
  const quote = document.getElementById("trend-quote")?.value || document.getElementById("target-currency")?.value || "ZAR";
  const days = window.__trendDays || 7;

  document.getElementById("trend-title")?.replaceChildren(
    document.createTextNode(`${base} / ${quote}`)
  );

  try {
    const points = await requestJson(`${API_BASE}/trends/${base}/${quote}?days=${days}`);
    window.__lastTrendPoints = points;
    document.getElementById("trend-current-rate")?.replaceChildren(
      document.createTextNode(points.length ? String(points.at(-1).rate) : "—")
    );
    document.getElementById("trend-low-rate")?.replaceChildren(
      document.createTextNode(points.length ? String(Math.min(...points.map((point) => point.rate))) : "—")
    );
    document.getElementById("trend-high-rate")?.replaceChildren(
      document.createTextNode(points.length ? String(Math.max(...points.map((point) => point.rate))) : "—")
    );

    const alerts = await fetchAlertsForTrend();
    const thresholdAlert = alerts.find((alert) =>
      alert.base_currency === base &&
      alert.quote_currency === quote &&
      !alert.triggered
    );
    const threshold = thresholdAlert?.target_rate ?? null;
    window.__activeTrendThreshold = threshold;
    updateTrendThresholdUI(threshold, points);
    renderTrendChart(points, threshold);

    const message = document.getElementById("trend-message");
    if (message) {
      message.textContent = points.length
        ? `${points.length} stored rate observations for the selected range.`
        : "Not enough stored trend data for this pair yet.";
    }
  } catch (error) {
    console.error(error);
  }
}

async function fetchAlertsForTrend() {
  if (!getToken()) return [];
  try {
    return await requestJson(`${API_BASE}/alerts`, { headers: authHeaders() });
  } catch {
    return [];
  }
}

function updateTrendThresholdFromAlerts(alerts) {
  const base = document.getElementById("trend-base")?.value;
  const quote = document.getElementById("trend-quote")?.value;
  const match = alerts.find((alert) =>
    alert.base_currency === base &&
    alert.quote_currency === quote &&
    !alert.triggered
  );
  window.__activeTrendThreshold = match?.target_rate ?? null;
  updateTrendThresholdUI(window.__activeTrendThreshold, window.__lastTrendPoints || []);
  renderTrendChart(window.__lastTrendPoints || [], window.__activeTrendThreshold);
}

function updateTrendThresholdUI(threshold, points) {
  const thresholdEl = document.getElementById("trend-threshold");
  const stateEl = document.getElementById("trend-state");

  if (threshold == null) {
    thresholdEl?.replaceChildren(document.createTextNode("None"));
    if (stateEl) {
      stateEl.textContent = "No threshold";
      stateEl.className = "status-badge neutral";
    }
    return;
  }

  thresholdEl?.replaceChildren(document.createTextNode(String(threshold)));

  if (!points.length) return;

  const latest = points.at(-1).rate;
  const direction = latest >= threshold ? "above" : "below";
  const alertDirection = "active";

  if (stateEl) {
    stateEl.className = `status-badge ${latest >= threshold ? "negative" : "positive"}`;
    stateEl.textContent = `Currently ${direction} threshold`;
  }
}

function renderTrendChart(points, threshold = null) {
  const container = document.getElementById("trend-chart");
  if (!container) return;

  if (!points.length) {
    container.innerHTML = '<div class="empty-state"><strong>Trend data unavailable</strong><span>There are no stored observations for this pair and range yet.</span></div>';
    return;
  }

  const rates = points.map((point) => Number(point.rate));
  const rawMin = Math.min(...rates, threshold ?? rates[0]);
  const rawMax = Math.max(...rates, threshold ?? rates[0]);
  const padding = Math.max((rawMax - rawMin) * 0.14, rawMax === rawMin ? Math.max(rawMax * 0.08, 0.1) : 0.01);
  const min = rawMin - padding;
  const max = rawMax + padding;

  const width = 960;
  const height = 360;
  const left = 44;
  const right = 18;
  const top = 20;
  const bottom = 34;
  const chartW = width - left - right;
  const chartH = height - top - bottom;

  const xFor = (index) => left + (index / Math.max(points.length - 1, 1)) * chartW;
  const yFor = (rate) => top + ((max - rate) / (max - min)) * chartH;

  const segments = [];
  for (let i = 1; i < points.length; i += 1) {
    const previous = rates[i - 1];
    const current = rates[i];
    const color =
      threshold == null ? "var(--color-primary)" :
      previous >= threshold && current >= threshold ? "var(--color-error)" :
      previous < threshold && current < threshold ? "var(--color-success)" :
      "var(--color-warning)";

    segments.push(
      `<line x1="${xFor(i - 1)}" y1="${yFor(previous)}" x2="${xFor(i)}" y2="${yFor(current)}" stroke="${color}" stroke-width="4" stroke-linecap="round" />`
    );
  }

  const gridLines = [0.25, 0.5, 0.75].map((fraction) => {
    const y = top + chartH * fraction;
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="var(--color-border)" stroke-width="1" opacity="0.8" />`;
  }).join("");

  const thresholdMarkup = threshold == null ? "" : `
    <line x1="${left}" y1="${yFor(threshold)}" x2="${width - right}" y2="${yFor(threshold)}" stroke="var(--color-warning)" stroke-width="2" stroke-dasharray="8 6" />
    <text x="${left + 8}" y="${Math.max(top + 14, yFor(threshold) - 8)}" fill="var(--color-warning)" font-size="12" font-weight="700">Threshold ${threshold}</text>
  `;

  const pointsMarkup = points.map((point, index) => {
    const rate = rates[index];
    const fill = threshold == null ? "var(--color-primary)" : rate >= threshold ? "var(--color-error)" : "var(--color-success)";
    return `<circle cx="${xFor(index)}" cy="${yFor(rate)}" r="3.5" fill="${fill}" />`;
  }).join("");

  const last = points.at(-1);
  const first = points[0];
  const labels = `
    <text x="${left}" y="${height - 8}" fill="var(--color-text-muted)" font-size="12">${new Date(first.recorded_at).toLocaleDateString()}</text>
    <text x="${width - right}" y="${height - 8}" text-anchor="end" fill="var(--color-text-muted)" font-size="12">${new Date(last.recorded_at).toLocaleDateString()}</text>
  `;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Exchange rate trend chart">
      ${gridLines}
      ${thresholdMarkup}
      ${segments.join("")}
      ${pointsMarkup}
      ${labels}
    </svg>
  `;
}

function initTrendControls() {
  document.querySelectorAll(".range-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach((btn) => btn.classList.toggle("active", btn === button));
      window.__trendDays = Number(button.dataset.days);
      loadTrend();
    });
  });

  ["trend-base", "trend-quote"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", loadTrend);
  });
}

function initHistorySearch() {
  document.getElementById("history-search")?.addEventListener("input", async () => {
    if (!window.__historyCache) {
      try {
        window.__historyCache = await requestJson(`${API_BASE}/history/recent?limit=50`, { headers: authHeaders() });
      } catch {
        window.__historyCache = [];
      }
    }
    renderHistory(window.__historyCache);
  });

  document.getElementById("refresh-history")?.addEventListener("click", async () => {
    window.__historyCache = null;
    await loadHistory();
  });
}

function initAuthFlow() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  if (!loginForm || !registerForm) return;

  document.getElementById("show-register")?.addEventListener("click", () => {
    showAuthMessage("");
    showPanel("register-panel");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showAuthMessage("");

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const rememberMe = document.getElementById("remember-me")?.checked ?? false;

    try {
      const result = await requestJson(`${API_BASE}/login`, {
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
      const result = await requestJson(`${API_BASE}/register`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      document.getElementById("login-email").value = payload.email;
      registerForm.reset();
      showPanel("login-panel");
      showAuthMessage(result.message || "Registration successful. You can now log in.");
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });
}

function initLogout() {
  document.getElementById("logout-button")?.addEventListener("click", () => {
    clearSession();
    window.location.href = "/login";
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initAuthFlow();

  if (document.getElementById("dashboard-panel-root") || document.querySelector(".dashboard-body")) {
    updateUserIdentity();
    populateCurrencySelects();
    initCurrencySearch();
    initPanelSwitching();
    initConverter();
    initTrendControls();
    initPortfolioForm();
    initAlertForm();
    initHistorySearch();
    initLogout();

    const initialTheme = document.documentElement.dataset.theme;
    if (initialTheme) applyTheme(initialTheme);

    await loadFavorites();
    await loadOverview();
  }
});
