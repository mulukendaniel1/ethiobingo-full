//apps\etm-game-engine\generate-test-tokens.js
// generate-test-tokens.js
import jwt from 'jsonwebtoken';
import fs from 'fs';

// Use the same JWT_SECRET as in your game engine .env
const JWT_SECRET = 'jwt'; // <-- REPLACE WITH YOUR SECRET
const OPERATOR_ID = 'ethio_bingoobot'; // default operator

const NUM_TOKENS = 1000; // generate 1000 tokens, enough for your test

const tokens = [];

for (let i = 1; i <= NUM_TOKENS; i++) {
  const userId = `testuser_${i}`;
  const token = jwt.sign(
    { uid: userId, operatorId: OPERATOR_ID },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  tokens.push({ userId, token });
}

fs.writeFileSync('test-tokens.json', JSON.stringify(tokens, null, 2));
console.log(`Generated ${NUM_TOKENS} tokens and saved to test-tokens.json`);