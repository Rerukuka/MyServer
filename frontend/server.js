const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const net = require("net");
const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, "users.txt");
app.use(bodyParser.json());
app.use(express.static(__dirname));

// 🔐 Регистрация
app.post("/register", (req, res) => {
  const { username, email, password, wallet } = req.body;
  if (!username || !email || !password || !wallet) return res.status(400).send("Все поля обязательны");

  const entry = `${username};${email};${password};${wallet}\n`;
  fs.appendFileSync(USERS_FILE, entry, "utf8");
  res.status(200).send("Регистрация успешна");
});

// 🔐 Вход
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = fs.readFileSync(USERS_FILE, "utf8").split("\n");

  const found = users.find(line => {
    const [_, userEmail, userPass] = line.split(";");
    return userEmail === email && userPass === password;
  });

  if (found) res.status(200).send("Вход успешен");
  else res.status(401).send("Неверный логин или пароль");
});

// 💾 Обновление кошелька
app.post("/update-wallet", (req, res) => {
  const { updated } = req.body;
  fs.writeFileSync(USERS_FILE, updated.trim() + "\n", "utf8");
  res.status(200).send("Кошелёк обновлён");
});

// 📡 Bitcoin RPC Proxy
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

app.get("/api/bitcoin-status", async (req, res) => {
  try {
    const response = await fetch("http://127.0.0.1:3001/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "1.0", id: "getblockchaininfo", method: "getblockchaininfo", params: [] })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });
    res.json(data.result);
  } catch (err) {
    console.error("RPC Proxy Error:", err.message);
    res.status(500).json({ error: "Ошибка запроса к RPC-прокси" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер на http://localhost:${PORT}`);
});
