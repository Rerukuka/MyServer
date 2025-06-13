// Stratum-сервер для ASIC BM1368 на порту 3333 (без 5050)
const net = require("net");
const fs = require("fs");
const httpClient = require("http");

const PORT = 3333;
const USERS_FILE = "/opt/MyServer/users.txt";
const RPC_USER = "mainuser";
const RPC_PASSWORD = "yT8mKp9QfV";
const RPC_PORT = 8332;
const RPC_HOST = "127.0.0.1";
const STATIC_WALLET = "bc1qrpq9w04k09rjjz283f2gzul3ga06mdn3tngt8r";
const LOG_FILE = "/opt/MyServer/asic-log.txt";

let connectedWallet = null;
let lastJobId = 0;
let currentJob = null;

function logEvent(text) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${text}\n`;
  fs.appendFileSync(LOG_FILE, entry);
  console.log(entry.trim());
}

function rpcCall(method, params = [], callback) {
  const options = {
    hostname: RPC_HOST,
    port: RPC_PORT,
    method: "POST",
    auth: `${RPC_USER}:${RPC_PASSWORD}`,
    headers: { "Content-Type": "application/json" }
  };

  const req = httpClient.request(options, (res) => {
    let data = "";
    res.on("data", chunk => data += chunk);
    res.on("end", () => callback(null, JSON.parse(data)));
  });

  req.on("error", (e) => callback(e));
  req.write(JSON.stringify({ jsonrpc: "1.0", id: "stratum", method, params }));
  req.end();
}

function broadcastJob(socket, job) {
  const notify = {
    id: null,
    method: "mining.notify",
    params: [job.job_id, job.prevblock, job.coinb1, job.coinb2, job.merkleroot, job.version, job.bits, job.time, job.clean]
  };
  logEvent("📤 Отправляем задание майнеру: " + JSON.stringify(notify));
  socket.write(JSON.stringify(notify) + "\n");
}

const server = net.createServer((socket) => {
  logEvent("🔌 ASIC подключился: " + socket.remoteAddress);

  socket.on("data", (data) => {
    try {
      logEvent("📥 Получено от ASIC: " + data.toString());
      const message = JSON.parse(data.toString());

      if (message.method === "mining.subscribe") {
        logEvent("🔄 Обработка subscribe запроса");
        socket.write(JSON.stringify({
          id: message.id,
          result: [["mining.set_difficulty", "deadbeef"], ["mining.notify", "deadbeef"]],
          error: null
        }) + "\n");
      }

      if (message.method === "mining.authorize") {
        logEvent("🔑 Поступил authorize-запрос: " + JSON.stringify(message.params));
        const [wallet, password] = message.params;

        const userLines = fs.readFileSync(USERS_FILE, "utf8").split("\n");
        const found = userLines.find(line => {
          const fields = line.trim().split(";");
          return fields.length >= 4 && fields[2] === password && fields[3] === wallet;
        });

        if (found) {
          connectedWallet = wallet;
          logEvent(`✅ ASIC авторизован: Wallet ${wallet}`);
          socket.write(JSON.stringify({ id: message.id, result: true, error: null }) + "\n");

          rpcCall("getblocktemplate", [{"rules": ["segwit"]}], (err, res) => {
            if (!err && res.result) {
              const job = {
                job_id: (++lastJobId).toString(),
                prevblock: res.result.previousblockhash,
                coinb1: "", coinb2: "",
                merkleroot: "", version: res.result.version,
                bits: res.result.bits,
                time: res.result.curtime.toString(16),
                clean: true
              };
              currentJob = job;
              broadcastJob(socket, job);
            } else {
              logEvent("❌ Ошибка getblocktemplate: " + (err || res.error));
            }
          });

        } else {
          logEvent("❌ Ошибка авторизации: пользователь не найден или неверные данные");
          socket.write(JSON.stringify({ id: message.id, result: false, error: "Auth failed" }) + "\n");
        }
      }

      if (message.method === "mining.submit") {
        logEvent("🧱 ASIC прислал решение: " + JSON.stringify(message.params));
        rpcCall("submitblock", [message.params[1]], (err, res) => {
          if (err || res.error) {
            logEvent("❌ submitblock ошибка: " + (err || res.error));
          } else {
            logEvent("🎉 Блок принят! Вознаграждение в кошелек: " + STATIC_WALLET);
          }
        });
        socket.write(JSON.stringify({ id: message.id, result: true, error: null }) + "\n");
      }

    } catch (e) {
      logEvent("❌ Ошибка парсинга JSON от ASIC: " + e.message);
    }
  });

  socket.on("end", () => {
    logEvent("🔌 Отключение ASIC");
    connectedWallet = null;
  });
});

server.listen(PORT, () => {
  logEvent(`✅ Stratum-сервер слушает порт ${PORT}`);
});

server.on("error", (err) => {
  logEvent(`❌ Ошибка сервера: ${err.message}`);
});