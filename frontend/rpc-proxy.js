const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');

const app = express();
app.use(bodyParser.json());

const RPC_USER = 'mainuser';
const RPC_PASSWORD = 'yT8mKp9QfV';
const RPC_PORT = 8332;
const RPC_HOST = '127.0.0.1';

app.post('/rpc', (req, res) => {
  const options = {
    hostname: RPC_HOST,
    port: RPC_PORT,
    method: 'POST',
    auth: `${RPC_USER}:${RPC_PASSWORD}`,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const rpcReq = http.request(options, (rpcRes) => {
    let data = '';
    rpcRes.on('data', (chunk) => {
      data += chunk;
    });
    rpcRes.on('end', () => {
      res.send(data);
    });
  });

  rpcReq.on('error', (error) => {
    res.status(500).send({ error: error.message });
  });

  rpcReq.write(JSON.stringify(req.body));
  rpcReq.end();
});

app.listen(3001, () => {
  console.log('RPC Proxy listening on port 3001');
});
