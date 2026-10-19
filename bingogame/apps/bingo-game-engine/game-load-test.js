//apps\etm-game-engine\game-load-test.js
import ws from 'k6/ws';
import { check } from 'k6';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { SharedArray } from 'k6/data';

// Load pre‑generated JWT tokens
const tokens = new SharedArray('tokens', function () {
  return JSON.parse(open('./test-tokens.json'));
});

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // ramp up to 100 users
    { duration: '1m',  target: 300 },   // to 300
    { duration: '2m',  target: 500 },   // to 500
    { duration: '1m',  target: 0 },     // ramp down
  ],
  thresholds: {
    ws_connecting: ['p(95)<500'],        // 95% of connections <500ms
    ws_msgs_received: ['rate>100'],      // at least 100 messages/second
  },
};

const ENGINE_WS_URL = __ENV.ENGINE_WS_URL || 'ws://localhost:4000';

export default function () {
  // Each VU gets a token (cyclic)
  const tokenObj = tokens[__VU % tokens.length];
  const token = tokenObj.token;
  const userId = tokenObj.userId;

  const url = `${ENGINE_WS_URL}/ws?token=${token}`;

  const response = ws.connect(url, function (socket) {
    socket.on('open', function () {
      console.log(`VU ${__VU} (${userId}) connected`);

      // Place a bet after a short random delay
      socket.setTimeout(function () {
        placeBet(socket, userId);
      }, randomIntBetween(1000, 3000));
    });

    socket.on('message', function (data) {
      // The built‑in ws_msgs_received metric automatically counts this
      const msg = JSON.parse(data);

      // Handle messages (optional – you can add logic, but not required for load)
      // If you want to react to specific messages, add cases here.
    });

    socket.on('close', function () {
      console.log(`VU ${__VU} disconnected`);
    });

    // Keep the connection alive for a random duration (30–90 seconds)
    socket.setTimeout(function () {
      socket.close();
    }, randomIntBetween(30000, 90000));
  });

  // Verify that the WebSocket handshake succeeded
  check(response, { 'handshake succeeded': (r) => r && r.status === 101 });
}

function placeBet(socket, userId) {
  const betAmount = randomIntBetween(10, 500);
  const autoCashout = randomIntBetween(15, 50) / 10; // 1.5x – 5.0x
  const tempId = `temp_${__VU}_${Date.now()}`;

  socket.send(JSON.stringify({
    type: 'place_pending_bet',
    data: {
      amount: betAmount,
      autoCashout: autoCashout,
      tempId: tempId,
      which: randomItem(['bet1', 'bet2']),
    }
  }));
}