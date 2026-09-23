const API_BASE = "";

function saveToken(token) {
  localStorage.setItem("access_token", token);
}

function getToken() {
  return localStorage.getItem("access_token");
}

function clearToken() {
  localStorage.removeItem("access_token");
}

function showPanel(panelId) {
  document.querySelectorAll(".auth-form-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
}

function fillOTPInputs() {
  const otpInputs = [...document.querySelectorAll(".otp-digit")];
  otpInputs.forEach((input, index) => {
    input.addEventListener("input", (event) => {
      // allow letters + digits now (was digits-only before)
      const value = event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 1).toUpperCase();
      event.target.value = value;
      if (value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });
 
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });
}
 
let countdownInterval = null;
 
function startCountdown(seconds = 90) {
  clearInterval(countdownInterval);
  let remaining = seconds;
 
  const timerEl = document.getElementById("otp-timer");
  const otpInputs = [...document.querySelectorAll(".otp-digit")];
  const resendBtn = document.getElementById("resend-code-btn");
  const errorEl = document.getElementById("otp-error");
 
  errorEl.style.display = "none";
  otpInputs.forEach((input) => {
    input.disabled = false;
    input.value = "";
  });
  otpInputs[0]?.focus();
  resendBtn.disabled = false;
  resendBtn.textContent = "Resend code";
 
  timerEl.textContent = remaining;
 
  countdownInterval = setInterval(() => {
    remaining -= 1;
    timerEl.textContent = remaining;
 
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      otpInputs.forEach((input) => (input.disabled = true));
      errorEl.textContent = "Code expired — click Resend code to get a new one.";
      errorEl.style.display = "block";
    }
  }, 1000);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
  
 
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
 
  if (!response.ok) {
    let message = "Request failed";
    if (typeof data === "string") {
      message = data;
    } else if (data && typeof data.detail === "string") {
      message = data.detail;
    } else if (data && Array.isArray(data.detail)) {
      // FastAPI/Pydantic 422 validation errors come back as an array of
      // {loc, msg, type} objects, not a plain string — this used to
      // produce a useless "[object Object]" alert. Now it shows the
      // actual field-level messages instead.
      message = data.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
    } else if (data && data.detail) {
      message = JSON.stringify(data.detail);
    }
    throw new Error(message);
  }
 
  return data;
}

function initAuthFlow() {
  const loginPanel = document.getElementById("login-panel");
  if (!loginPanel) return;
 
  document.getElementById("show-register").addEventListener("click", () => showPanel("register-panel"));
  document.getElementById("back-to-login").addEventListener("click", () => {
    clearInterval(countdownInterval);
    showPanel("login-panel");
  });
  fillOTPInputs();
 
  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      email: document.getElementById("login-email").value,
      password: document.getElementById("login-password").value,
      remember_me: document.getElementById("remember-me").checked,
    };
 
    try {
      const result = await requestJson(`${API_BASE}/login`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      saveToken(result.access_token);
      window.location.href = "/dashboard";
    } catch (error) {
      alert(error.message);
    }
  });
 
  document.getElementById("register-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      first_name: document.getElementById("register-first-name").value,
      surname: document.getElementById("register-surname").value,
      email: document.getElementById("register-email").value,
      country: document.getElementById("register-country").value,
      password: document.getElementById("register-password").value,
    };
 
    try {
      await requestJson(`${API_BASE}/register`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showPanel("otp-panel");
      startCountdown(90);
    } catch (error) {
      alert(error.message);
    }
  });
 
  document.getElementById("otp-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = [...document.querySelectorAll(".otp-digit")].map((input) => input.value).join("");
    const email = document.getElementById("register-email").value;
    const errorEl = document.getElementById("otp-error");
 
    try {
      await requestJson(`${API_BASE}/verify-code`, {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      clearInterval(countdownInterval);
      alert("Email verified successfully. You can now log in.");
      showPanel("login-panel");
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = "block";
    }
  });
 
  document.getElementById("resend-code-btn").addEventListener("click", async () => {
    const email = document.getElementById("register-email").value;
    const resendBtn = document.getElementById("resend-code-btn");
    const errorEl = document.getElementById("otp-error");
 
    try {
      await requestJson(`${API_BASE}/resend-code`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      startCountdown(90);
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = "block";
      if (error.message.toLowerCase().includes("maximum resend")) {
        resendBtn.disabled = true;
        resendBtn.textContent = "No resends left";
      }
    }
  });
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
        body: JSON.stringify({ amount, from_currency: fromCurrency, to_currency: toCurrency }),
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