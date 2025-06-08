const net = require("net");
const http = require("http");

const PORT = 3333;
const RPC_HOST = "127.0.0.1";
const RPC_PORT = 3001;

const server = net.createServer((socket) => {
  console.log("🔌 ASIC подключился:", socket.remoteAddress);

  socket.on("data", (data) => {
    console.log("📩 Получено от ASIC:", data.toString());

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
        socket.write(JSON.stringify({
          id: message.id,
          result: true,
          error: null
        }) + "\n");
      }

      if (message.method === "mining.submit") {
        console.log("🧱 Хеш от ASIC:", JSON.stringify(message.params));
        socket.write(JSON.stringify({ id: message.id, result: true, error: null }) + "\n");
      }
    } catch (e) {
      console.error("❌ Ошибка обработки:", e.message);
    }
  });

  socket.on("end", () => {
    console.log("🔌 Отключение ASIC");
  });
});

server.listen(PORT, () => {
  console.log(`✅ Stratum-сервер запущен и слушает порт ${PORT}`);
  console.log("🔁 Статус сервера: готов к подключению ASIC");
});

server.on("error", (err) => {
  console.error(`❌ Ошибка при запуске сервера: ${err.message}`);
});
