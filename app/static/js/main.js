const API_BASE = "http://localhost:8000";

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
      const value = event.target.value.replace(/\D/g, "").slice(0, 1);
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

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === "string" ? data : data.detail || "Request failed";
    throw new Error(message);
  }

  return data;
}

function initAuthFlow() {
  const loginPanel = document.getElementById("login-panel");
  if (!loginPanel) return;

  document.getElementById("show-register").addEventListener("click", () => showPanel("register-panel"));
  document.getElementById("back-to-login").addEventListener("click", () => showPanel("login-panel"));
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
      const result = await requestJson(`${API_BASE}/register`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      alert(result.message);
      showPanel("otp-panel");
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById("otp-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const otp = [...document.querySelectorAll(".otp-digit")]
      .map((input) => input.value)
      .join("");

    const email = document.getElementById("register-email").value;

    try {
      await requestJson(`${API_BASE}/verify-otp`, {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      alert("Email verified successfully. You can now log in.");
      showPanel("login-panel");
    } catch (error) {
      alert(error.message);
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
