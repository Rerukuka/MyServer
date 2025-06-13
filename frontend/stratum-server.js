// Расширенный stratum-сервер для реального майнинга
const net = require("net");
const fs = require("fs");
const http = require("http");
const httpClient = require("http");

const PORT = 3333;
const USERS_FILE = "/opt/MyServer/users.txt";
const RPC_USER = "mainuser";
const RPC_PASSWORD = "yT8mKp9QfV";
const RPC_PORT = 8332;
const RPC_HOST = "127.0.0.1";

let connectedWallet = null;
let lastJobId = 0;
let currentJob = null;

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
  socket.write(JSON.stringify(notify) + "\n");
}

const server = net.createServer((socket) => {
  console.log("🔌 ASIC подключился:", socket.remoteAddress);

  socket.on("data", (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.method === "mining.subscribe") {
        socket.write(JSON.stringify({
          id: message.id,
          result: [["mining.set_difficulty", "deadbeef"], ["mining.notify", "deadbeef"]],
          error: null
        }) + "\n");
      }

      if (message.method === "mining.authorize") {
        const [userAndWorker, passwordWallet] = message.params;
        const [password, wallet] = passwordWallet.split(";");

        const userLines = fs.readFileSync(USERS_FILE, "utf8").split("\n");
        const found = userLines.find(line => {
          const fields = line.trim().split(";");
          return fields.length >= 4 && fields[2] === password && fields[3] === wallet;
        });

        if (found) {
          connectedWallet = wallet;
          console.log(`✅ ASIC авторизован: ${userAndWorker}, Wallet: ${wallet}`);
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
            }
          });

        } else {
          socket.write(JSON.stringify({ id: message.id, result: false, error: "Auth failed" }) + "\n");
        }
      }

      if (message.method === "mining.submit") {
        console.log("🧱 ASIC прислал решение:", JSON.stringify(message.params));
        rpcCall("submitblock", [message.params[1]], (err, res) => {
          if (err || res.error) {
            console.log("❌ submitblock ошибка", err || res.error);
          } else {
            console.log("🎉 Блок принят! Вознаграждение в кошелек", connectedWallet);
          }
        });
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

const statusServer = http.createServer((req, res) => {
  if (req.url === "/asic-status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ connected: !!connectedWallet, connectedWallet }));
  }
});

statusServer.listen(5050, () => {
  console.log("🌐 HTTP статус сервер слушает порт 5050");
});
