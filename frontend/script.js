// 🌙 Переключение темы
const themeToggleBtn = document.getElementById("theme-toggle");
const updateTheme = () => {
  const html = document.documentElement;
  const body = document.body;
  const theme = html.getAttribute("data-theme");
  if (theme === "dark") {
    body.classList.add("dark");
  } else {
    body.classList.remove("dark");
  }
};
themeToggleBtn?.addEventListener("click", () => {
  const html = document.documentElement;
  const currentTheme = html.getAttribute("data-theme");
  html.setAttribute("data-theme", currentTheme === "dark" ? "light" : "dark");
  updateTheme();
});
window.addEventListener("DOMContentLoaded", updateTheme);

// 🌐 Перевод
let currentLang = "RU";
const langBtn = document.getElementById("lang-btn");
function updateTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang]?.[key]) {
      el.textContent = translations[currentLang][key];
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[currentLang]?.[key]) {
      el.placeholder = translations[currentLang][key];
    }
  });
}
langBtn?.addEventListener("click", () => {
  const keys = Object.keys(translations);
  const nextIndex = (keys.indexOf(currentLang) + 1) % keys.length;
  currentLang = keys[nextIndex];
  langBtn.textContent = currentLang;
  updateTranslations();
});
window.addEventListener("DOMContentLoaded", () => {
  updateTranslations();
});

// 🔐 Управление отображением кнопок входа и профиля
window.addEventListener("DOMContentLoaded", () => {
  const email = localStorage.getItem("user-email");
  const loginLink = document.getElementById("login-link");
  const profileLink = document.getElementById("profile-link");
  const walletSpan = document.getElementById("btc-wallet-display");
  const asicStatusBlock = document.getElementById("asic-status");

  if (email) {
    loginLink?.remove();
    profileLink?.classList.remove("hidden");

    fetch("users.txt")
      .then(res => res.text())
      .then(data => {
        const userLine = data.split("\n").find(line => line.includes(email));
        if (userLine && walletSpan) {
          const wallet = userLine.split(";")[3] || "";
          walletSpan.textContent = wallet ? wallet : "Введите кошелек биткоина";
        }
      });
  } else {
    profileLink?.remove();
    if (walletSpan) walletSpan.textContent = "";
  }
});

// ✅ Регистрация
const registerForm = document.getElementById("register-form");
registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const wallet = "null";
  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, wallet }),
    });
    alert(await res.text());
    if (res.ok) window.location.href = "Login.html";
  } catch (err) {
    console.error("Ошибка регистрации:", err);
    alert("Ошибка регистрации");
  }
});

// 🔐 Вход
const loginForm = document.getElementById("login-form");
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const msg = await res.text();
    alert(msg);
    if (res.ok) {
      localStorage.setItem("user-email", email);
      window.location.href = "dashboard.html";
    }
  } catch (err) {
    console.error("Ошибка входа:", err);
    alert("Ошибка входа");
  }
});

// 👤 Загрузка данных профиля
async function loadProfileData() {
  const email = localStorage.getItem("user-email");
  if (!email) return;
  const data = await fetch("users.txt").then(res => res.text());
  const lines = data.split("\n");
  const found = lines.find(line => line.includes(email));
  if (!found) return;
  const [username, userEmail, password, wallet] = found.split(";");
  document.getElementById("profile-username").value = username;
  document.getElementById("profile-email").value = userEmail;
  document.getElementById("profile-password").value = password;
  document.getElementById("btc-wallet").value = wallet || "";
}
window.addEventListener("DOMContentLoaded", loadProfileData);

// 💾 Сохранение данных профиля
const profileForm = document.getElementById("profile-form");
profileForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = localStorage.getItem("user-email");
  const username = document.getElementById("profile-username").value.trim();
  const newEmail = document.getElementById("profile-email").value.trim();
  const password = document.getElementById("profile-password").value.trim();
  const wallet = document.getElementById("btc-wallet").value.trim();
  const data = await fetch("users.txt").then(res => res.text());
  const updated = data
    .split("\n")
    .map(line => {
      const [u, e, p, w] = line.split(";");
      if (e === email) return `${username};${newEmail};${password};${wallet}`;
      return line;
    })
    .join("\n");
  await fetch("/update-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updated }),
  });
  localStorage.setItem("user-email", newEmail);
  alert("✅ Данные сохранены!");
});

const logoutBtn = document.getElementById("logout-btn");
logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("user-email");
  alert("Вы вышли из аккаунта");
  window.location.href = "index.html";
});


async function loadBitcoinStats() {
  const statsBlock = document.getElementById("btc-stats");
  const elBlocks = document.getElementById("btc-blocks");
  const elDifficulty = document.getElementById("btc-difficulty");
  // const elHashrate = document.getElementById("btc-hashrate"); // больше не нужен

  if (!statsBlock || !elBlocks || !elDifficulty) return; // убрали проверку на elHashrate

  try {
    const res = await fetch("/api/bitcoin-status");
    const stats = await res.json();

    elBlocks.textContent = `Блоков: ${stats.blocks}`;
    elDifficulty.textContent = `Сложность: ${stats.difficulty}`;
    // если все-таки решишь вернуть, просто раскомментируй ниже
    // if (elHashrate) elHashrate.textContent = `Хешрейт: ${Math.round(stats.networkhashps / 1e9)} GH/s`;
  } catch (err) {
    console.error("❌ Ошибка получения статуса Bitcoin:", err);
    elBlocks.textContent = "Ошибка загрузки";
    elDifficulty.textContent = "";
    // if (elHashrate) elHashrate.textContent = "";
  }
}

window.addEventListener("DOMContentLoaded", loadBitcoinStats);




async function checkAsicConnection() {
  try {
    const res = await fetch("/api/asic-status");
    const data = await res.json();
    const el = document.getElementById("asic-status");
    if (data.connected) {
      el.textContent = "ASIC подключен ✅";
      el.classList.remove("text-red-500");
      el.classList.add("text-green-500");
    } else {
      el.textContent = "ASIC не подключен ❌";
      el.classList.remove("text-green-500");
      el.classList.add("text-red-500");
    }
  } catch (err) {
    console.error("Ошибка проверки ASIC:", err);
  }
}

setInterval(checkAsicConnection, 5000); // обновление каждые 5 секунд
window.addEventListener("DOMContentLoaded", checkAsicConnection);

async function loadDashboardStats() {
  try {
    const res1 = await fetch("/api/mempool");
    const mempool = await res1.json();
    const res2 = await fetch("/api/user-count");
    const users = await res2.json();

    const priceEl = document.getElementById("btc-price");
    const txEl = document.getElementById("tx-today");
    const usersEl = document.getElementById("active-users");

    if (priceEl) priceEl.textContent = `$≈ ${mempool.price || "?"}`;
    if (txEl) txEl.textContent = mempool.txCount.toLocaleString("ru-RU");
    if (usersEl) usersEl.textContent = users.count.toLocaleString("ru-RU");
  } catch (err) {
    console.error("Ошибка загрузки дашборда:", err);
  }
}

window.addEventListener("DOMContentLoaded", loadDashboardStats);
