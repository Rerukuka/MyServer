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

  if (email) {
    loginLink?.remove();
    profileLink?.classList.remove("hidden");

    // Отображение BTC кошелька
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
