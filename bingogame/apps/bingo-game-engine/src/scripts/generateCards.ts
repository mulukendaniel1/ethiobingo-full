// apps/bingo-game-engine/src/scripts/generateCards.ts
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateUniqueCards(count: number = 400) {
  console.log('Generating unique bingo cards...');
  const cards: any[] = [];
  const usedSignatures = new Set<string>();

  while (cards.length < count) {
    const card = generateRandomCard();
    const signature = card.numbers.flat().join(',');
    if (!usedSignatures.has(signature)) {
      usedSignatures.add(signature);
      cards.push({ cardId: cards.length + 1, numbers: card.numbers });
    }
  }

  const outputPath = path.join(__dirname, '../../data/cards.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(cards, null, 2));
  console.log(`Inserted ${cards.length} unique cards to ${outputPath}`);
  process.exit(0);
}

function generateRandomCard(): { numbers: number[][] } {
  const colRanges: [number, number][] = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
  
  const card: number[][] = Array(5)
    .fill(null)
    .map(() => Array(5).fill(0));

  for (let col = 0; col < 5; col++) {
    const [min, max] = colRanges[col];
    const count = col === 2 ? 4 : 5; // middle column gets 4 numbers + free space
    
    // Generate unique numbers
    const numbers = new Set<number>();
    while (numbers.size < count) {
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      numbers.add(num);
    }
    
    // Shuffle the numbers (instead of sorting them ascending)
    const shuffled = shuffleArray(Array.from(numbers));
    
    if (col === 2) {
      // Middle column: place 4 numbers in rows 0,1,3,4
      const rows = [0, 1, 3, 4];
      for (let i = 0; i < rows.length; i++) {
        card[rows[i]][col] = shuffled[i];
      }
    } else {
      // Other columns: place all 5 numbers in rows 0-4
      for (let row = 0; row < 5; row++) {
        card[row][col] = shuffled[row];
      }
    }
  }
  
  card[2][2] = 0; // free space
  
  return { numbers: card };
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

generateUniqueCards().catch(console.error);