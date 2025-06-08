const net = require("net");
const fs = require("fs");
const http = require("http");

const PORT = 3333;
const USERS_FILE = "/opt/MyServer/users.txt";

let connectedWallet = null;

const server = net.createServer((socket) => {
  console.log("🔌 ASIC подключился:", socket.remoteAddress);

  socket.on("data", (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.method === "mining.subscribe") {
        socket.write(JSON.stringify({
          id: message.id,
          result: [["mining.set_difficulty", "b4b6693b"], ["mining.notify", "b4b6693b"]],
          error: null
        }) + "\n");
      }

      if (message.method === "mining.authorize") {
        const [userAndWorker, password] = message.params;
        const wallet = password?.trim();

        const userLines = fs.readFileSync(USERS_FILE, "utf8").split("\n");
        const found = userLines.find(line => {
          const fields = line.trim().split(";");
          return fields.length >= 4 && fields[2] === password && fields[3] === wallet;
        });

        if (found) {
          connectedWallet = wallet;
          console.log(`✅ ASIC авторизован: ${userAndWorker}, Wallet: ${wallet}`);
          socket.write(JSON.stringify({ id: message.id, result: true, error: null }) + "\n");
        } else {
          socket.write(JSON.stringify({ id: message.id, result: false, error: "Auth failed" }) + "\n");
        }
      }

      if (message.method === "mining.submit") {
        console.log("🧱 ASIC прислал решение:", JSON.stringify(message.params));
        socket.write(JSON.stringify({ id: message.id, result: true, error: null }) + "\n");
      }
    } catch (e) {
      console.error("❌ Ошибка ASIC:", e.message);
    }
  });

  socket.on("end", () => {
    console.log("🔌 Отключение ASIC");
    connectedWallet = null;
  });
});

server.listen(PORT, () => {
  console.log(`✅ Stratum-сервер слушает порт ${PORT}`);
});

server.on("error", (err) => {
  console.error(`❌ Ошибка сервера: ${err.message}`);
});

// API статус ASIC
const statusServer = http.createServer((req, res) => {
  if (req.url === "/asic-status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ connected: !!connectedWallet }));
  }
});
statusServer.listen(5050, () => {
  console.log("🌐 HTTP статус сервер слушает порт 5050");
});
