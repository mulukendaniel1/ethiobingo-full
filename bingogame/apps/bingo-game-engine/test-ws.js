import WebSocket from 'ws';
import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('./test-tokens.json'));
const token = tokens[0].token;

const ws = new WebSocket('ws://localhost:4000/ws?token=' + token);

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'ping' })); // optional
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log('Closed:', code, reason.toString());
});