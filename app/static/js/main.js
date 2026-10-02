const API_BASE = "";

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
  if (user) {
    localStorage.setItem("current_user", JSON.stringify(user));
  }
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

function showPanel(panelId) {
  document.querySelectorAll(".auth-form-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
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

  // Retry one authenticated request after refreshing an expired access token.
  // Only attempt this when the request already supplied an Authorization header.
  const hasAuthHeader = Boolean(
    options.headers?.Authorization || options.headers?.authorization
  );

  if (response.status === 401 && hasAuthHeader && !url.includes("/refresh-token")) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      const retryHeaders = {
        ...(options.headers || {}),
        Authorization: `Bearer ${getToken()}`,
      };

      response = await fetch(
        url,
        buildRequestOptions({
          ...options,
          headers: retryHeaders,
        })
      );
    } else if (window.location.pathname !== "/login") {
      // The session can no longer be recovered; send the user back to login
      // instead of leaving a protected dashboard in a misleading state.
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
    if (typeof data === "string") {
      message = data;
    } else if (data && typeof data.detail === "string") {
      message = data.detail;
    } else if (data && Array.isArray(data.detail)) {
      // FastAPI/Pydantic 422 validation errors come back as an array of
      // {loc, msg, type} objects, not a plain string.
      message = data.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
    } else if (data && data.detail) {
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

    // Read the form fields and submit the credentials to the login endpoint.
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const rememberMe = document.getElementById("remember-me")?.checked ?? false;

    try {
      const result = await requestJson(`${API_BASE}/login`, {
        method: "POST",
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      });

      // Store the full session so protected requests and the dashboard identity
      // survive the redirect to /dashboard.
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

    // Gather registration details; the backend hashes the password before saving.
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

      // Registration completes immediately; no OTP or email verification is used.
      document.getElementById("login-email").value = payload.email;
      registerForm.reset();
      showPanel("login-panel");
      showAuthMessage(result.message || "Registration successful. You can now log in.");
    } catch (error) {
      showAuthMessage(error.message, true);
    }
  });
}

function updateUserBadge() {
  const userBadge = document.getElementById("user-name");
  if (!userBadge) return;

  const user = getStoredUser();
  if (!user) return;

  const displayName = [user.first_name, user.surname]
    .filter(Boolean)
    .join(" ")
    .trim();

  userBadge.textContent = displayName || user.email || "User";
}

function initDashboard() {
  const amountInput = document.getElementById("amount-input");
  const baseSelect = document.getElementById("base-currency");
  const targetSelect = document.getElementById("target-currency");
  const convertButton = document.getElementById("convert-button");
  const swapButton = document.getElementById("swap-currency");

  if (!amountInput) return;

  amountInput.setAttribute("maxlength", "12");
  amountInput.addEventListener("input", () => {
    if (amountInput.value.length > 12) {
      amountInput.value = amountInput.value.slice(0, 12);
    }
  });

  const updateConversion = async () => {
    const amount = Number(amountInput.value || 0);
    const fromCurrency = baseSelect.value;
    const toCurrency = targetSelect.value;

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

      document.getElementById("converted-output").textContent = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(result.converted_amount);
      document.getElementById("rate-badge").textContent = `1 ${result.from_currency} = ${result.rate} ${result.to_currency}`;
      document.getElementById("rate-source").textContent = result.source === "live" ? "Live" : "Cached";
    } catch (error) {
      document.getElementById("converted-output").textContent = "--";
      console.error(error);
    }
  };

  convertButton.addEventListener("click", updateConversion);
  baseSelect.addEventListener("change", updateConversion);
  targetSelect.addEventListener("change", updateConversion);
  amountInput.addEventListener("input", updateConversion);

  swapButton.addEventListener("click", () => {
    const currentFrom = baseSelect.value;
    baseSelect.value = targetSelect.value;
    targetSelect.value = currentFrom;
    updateConversion();
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const pair = chip.dataset.pair;
      const [from, to] = pair.split("-");
      baseSelect.value = from;
      targetSelect.value = to;
      updateConversion();
    });
  });

  updateConversion();
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthFlow();
  updateUserBadge();
  initDashboard();
});
/* ---------- APPEND all of this to the end of static/js/main.js ---------- */

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ---------- Panel switching (Overview / Portfolio / Alerts) ---------- */

function initPanelSwitching() {
  const pills = document.querySelectorAll(".nav-pill[data-panel]");
  if (!pills.length) return;

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.toggle("active", p === pill));

      document.querySelectorAll(".dashboard-panel").forEach((panel) => {
        panel.hidden = panel.id !== pill.dataset.panel;
      });

      if (pill.dataset.panel === "portfolio-panel") loadPortfolio();
      if (pill.dataset.panel === "alerts-panel") loadAlerts();
    });
  });
}

/* ---------- Favorites ---------- */

async function loadFavorites() {
  const container = document.getElementById("favorite-chips");
  if (!container) return;

  if (!getToken()) {
    container.innerHTML = `<p class="label">Log in to save favorite pairs</p>`;
    return;
  }

  try {
    const favorites = await requestJson(`${API_BASE}/favorites`, { headers: authHeaders() });
    container.innerHTML = "";
    favorites.forEach((fav) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.dataset.pair = `${fav.base_currency}-${fav.quote_currency}`;
      chip.textContent = `${fav.base_currency}/${fav.quote_currency} ✕`;
      chip.addEventListener("click", async () => {
        await requestJson(`${API_BASE}/favorites/${fav.id}`, { method: "DELETE", headers: authHeaders() });
        loadFavorites();
      });
      container.appendChild(chip);
    });
    updateFavoriteStar();
  } catch (error) {
    console.error(error);
  }
}

async function updateFavoriteStar() {
  const star = document.getElementById("favorite-toggle");
  if (!star || !getToken()) return;

  const base = document.getElementById("base-currency").value;
  const quote = document.getElementById("target-currency").value;

  try {
    const favorites = await requestJson(`${API_BASE}/favorites`, { headers: authHeaders() });
    const match = favorites.find((f) => f.base_currency === base && f.quote_currency === quote);
    star.textContent = match ? "★" : "☆";
    star.dataset.favoriteId = match ? match.id : "";
  } catch (error) {
    console.error(error);
  }
}

function initFavoriteToggle() {
  const star = document.getElementById("favorite-toggle");
  if (!star) return;

  star.addEventListener("click", async () => {
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
      loadFavorites();
    } catch (error) {
      alert(error.message);
    }
  });
}

/* ---------- Portfolio ---------- */

async function loadPortfolio() {
  const list = document.getElementById("portfolio-list");
  if (!list) return;

  if (!getToken()) {
    list.innerHTML = "<li>Please log in to see your portfolio.</li>";
    return;
  }

  try {
    const holdings = await requestJson(`${API_BASE}/portfolio`, { headers: authHeaders() });
    list.innerHTML = "";
    if (!holdings.length) {
      list.innerHTML = "<li>No holdings yet.</li>";
      return;
    }
    holdings.forEach((h) => {
      const li = document.createElement("li");
      li.textContent = `${h.amount_held} ${h.currency}${h.notes ? " — " + h.notes : ""}`;
      const removeBtn = document.createElement("button");
      removeBtn.className = "text-button";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        await requestJson(`${API_BASE}/portfolio/${h.id}`, { method: "DELETE", headers: authHeaders() });
        loadPortfolio();
      });
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  } catch (error) {
    console.error(error);
  }
}

function initPortfolioForm() {
  const form = document.getElementById("portfolio-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getToken()) {
      alert("Please log in first.");
      return;
    }

    const payload = {
      currency: document.getElementById("portfolio-currency").value.toUpperCase(),
      amount_held: Number(document.getElementById("portfolio-amount").value),
      notes: document.getElementById("portfolio-notes").value || null,
    };

    try {
      await requestJson(`${API_BASE}/portfolio`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      form.reset();
      loadPortfolio();
    } catch (error) {
      alert(error.message);
    }
  });
}

/* ---------- Alerts ---------- */

function populateAlertCurrencyOptions() {
  const sourceSelect = document.getElementById("base-currency");
  const alertBase = document.getElementById("alert-base");
  const alertQuote = document.getElementById("alert-quote");
  if (!sourceSelect || !alertBase || !alertQuote) return;

  alertBase.innerHTML = sourceSelect.innerHTML;
  alertQuote.innerHTML = sourceSelect.innerHTML;
  alertQuote.value = "ZAR";
}

async function loadAlerts() {
  const list = document.getElementById("alerts-list");
  if (!list) return;

  if (!getToken()) {
    list.innerHTML = "<li>Please log in to see your alerts.</li>";
    return;
  }

  try {
    const alerts = await requestJson(`${API_BASE}/alerts`, { headers: authHeaders() });
    list.innerHTML = "";
    if (!alerts.length) {
      list.innerHTML = "<li>No alerts yet.</li>";
      return;
    }
    alerts.forEach((a) => {
      const li = document.createElement("li");
      const status = a.triggered ? "Triggered" : "Watching";
      li.textContent = `${a.base_currency}/${a.quote_currency} ${a.direction} ${a.target_rate} — ${status}`;
      const removeBtn = document.createElement("button");
      removeBtn.className = "text-button";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        await requestJson(`${API_BASE}/alerts/${a.id}`, { method: "DELETE", headers: authHeaders() });
        loadAlerts();
      });
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  } catch (error) {
    console.error(error);
  }
}

function initAlertForm() {
  const form = document.getElementById("alert-form");
  if (!form) return;

  populateAlertCurrencyOptions();

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
      loadAlerts();
    } catch (error) {
      alert(error.message);
    }
  });
}

/* ---------- Recent history (real data instead of the hardcoded 3 lines) ---------- */

async function loadHistory() {
  const list = document.getElementById("history-list");
  if (!list) return;

  if (!getToken()) {
    list.innerHTML = "<li>Log in to see your conversion history.</li>";
    return;
  }

  try {
    const history = await requestJson(`${API_BASE}/history/recent?limit=10`, { headers: authHeaders() });
    list.innerHTML = "";
    if (!history.length) {
      list.innerHTML = "<li>No conversions yet.</li>";
      return;
    }
    history.forEach((h) => {
      const li = document.createElement("li");
      li.textContent = `${h.amount} ${h.base_currency} → ${h.quote_currency} = ${h.converted_amount}`;
      list.appendChild(li);
    });
  } catch (error) {
    console.error(error);
  }
}

document.getElementById("refresh-rates")?.addEventListener("click", loadHistory);

/* ---------- Trends sparkline (simple inline SVG line chart, no chart library needed) ---------- */

async function loadTrend() {
  const container = document.getElementById("sparkline");
  if (!container) return;

  const base = document.getElementById("base-currency")?.value || "USD";
  const quote = document.getElementById("target-currency")?.value || "ZAR";

  try {
    const points = await requestJson(`${API_BASE}/trends/${base}/${quote}?days=7`);
    if (!points.length) {
      container.innerHTML = `<p class="label">Not enough trend data yet — check back after the next rate poll.</p>`;
      return;
    }

    const rates = points.map((p) => p.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const range = max - min || 1;

    const width = 600;
    const height = 160;
    const stepX = width / Math.max(points.length - 1, 1);

    const coords = rates.map((rate, i) => {
      const x = i * stepX;
      const y = height - ((rate - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="width:100%;height:100%;">
        <polyline points="${coords.join(" ")}" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    `;
  } catch (error) {
    console.error(error);
  }
}

/* ---------- Wire everything up ---------- */

document.addEventListener("DOMContentLoaded", () => {
  initPanelSwitching();
  initFavoriteToggle();
  initPortfolioForm();
  initAlertForm();
  loadFavorites();
  loadHistory();
  loadTrend();

  // Keep the star and trend in sync whenever the pair changes
  document.getElementById("base-currency")?.addEventListener("change", () => {
    updateFavoriteStar();
    loadTrend();
  });
  document.getElementById("target-currency")?.addEventListener("change", () => {
    updateFavoriteStar();
    loadTrend();
  });
  document.getElementById("convert-button")?.addEventListener("click", loadHistory);
});