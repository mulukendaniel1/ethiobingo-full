//apps\bingo-game-engine\src\engine\PatternValidator.ts
// apps/bingo-game-engine/src/engine/PatternValidator.ts

export class PatternValidator {
  /**
   * Validates if a card has a BINGO based on the drawn balls.
   * Optimized for O(1) lookups per number.
   */
  static hasBingo(card: number[][], drawnBalls: Set<number>): boolean {
    // 1. Check ROWS (Horizontal)
    // We iterate row index first
    for (let r = 0; r < 5; r++) {
      let isRowComplete = true;
      for (let c = 0; c < 5; c++) {
        const num = card[c][r];
        // 0 is FREE space, skip check. If num is not 0 and not drawn, row fails.
        if (num !== 0 && !drawnBalls.has(num)) {
          isRowComplete = false;
          break; // Fail Fast: Skip rest of this row
        }
      }
      if (isRowComplete) return true; // Winner found!
    }

    // 2. Check COLUMNS (Vertical)
    for (let c = 0; c < 5; c++) {
      let isColComplete = true;
      for (let r = 0; r < 5; r++) {
        const num = card[c][r];
        if (num !== 0 && !drawnBalls.has(num)) {
          isColComplete = false;
          break; // Fail Fast
        }
      }
      if (isColComplete) return true;
    }

    // 3. Check Main Diagonal (Top-Left to Bottom-Right)
    let isMainDiagComplete = true;
    for (let i = 0; i < 5; i++) {
      const num = card[i][i];
      if (num !== 0 && !drawnBalls.has(num)) {
        isMainDiagComplete = false;
        break;
      }
    }
    if (isMainDiagComplete) return true;

    // 4. Check Anti-Diagonal (Top-Right to Bottom-Left)
    let isAntiDiagComplete = true;
    for (let i = 0; i < 5; i++) {
      const num = card[i][4 - i];
      if (num !== 0 && !drawnBalls.has(num)) {
        isAntiDiagComplete = false;
        break;
      }
    }
    if (isAntiDiagComplete) return true;

    return false; // No patterns matched
  }
}