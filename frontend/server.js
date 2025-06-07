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
    const response = await fetch("http://localhost:3001", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "1.0",
        id: "getblockchaininfo",
        method: "getblockchaininfo",
        params: [],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error });

    res.json(data.result);
  } catch (err) {
    res.status(500).json({ error: "Ошибка запроса к RPC-прокси" });
  }
});

// ✅ ASIC Подключение
const connectedAsics = {}; // wallet -> { ip, lastSeen }

const asicServer = net.createServer((socket) => {
  const ip = socket.remoteAddress;
  socket.on('data', (data) => {
    const message = data.toString().trim();
    const [wallet, password] = message.split(";");
    if (wallet) {
      connectedAsics[wallet] = { ip, lastSeen: new Date() };
      console.log(`ASIC подключён: Wallet=${wallet}, IP=${ip}`);
    }
    socket.end();
  });

  socket.on('error', (err) => {
    console.error('ASIC socket error:', err);
  });
});
asicServer.listen(3333, () => {
  console.log('ASIC listener запущен на порту 3333');
});

// API: Статус ASIC по wallet
app.get("/asic-status", (req, res) => {
  const wallet = req.query.wallet;
  const entry = connectedAsics[wallet];
  const connected = entry && (new Date() - entry.lastSeen < 60000);
  res.json({ status: connected ? "connected" : "disconnected" });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер на http://localhost:${PORT}`);
});
