import crypto from 'crypto';
import { generateBallSequence } from '@bingogame/crypto-utils';

export class ProvablyFairBalls {
  public serverSeed: string;
  public serverSeedHash: string;
  public clientSeed: string;
  public nonce: number;
  private sequence: number[];
  private drawnIndex: number = 0;

  constructor(clientSeed?: string) {
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.serverSeedHash = crypto.createHash('sha256').update(this.serverSeed).digest('hex');
    this.clientSeed = clientSeed || crypto.randomBytes(16).toString('hex');
    this.nonce = 0;
    this.sequence = [];
  }

  static restore(serverSeed: string, clientSeed: string, nonce: number, storedSequence?: number[]): ProvablyFairBalls {
    const instance = new ProvablyFairBalls(clientSeed);
    instance.serverSeed = serverSeed;
    instance.serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    instance.nonce = nonce;
    instance.sequence = storedSequence && storedSequence.length ? [...storedSequence] : generateBallSequence(serverSeed, clientSeed, nonce);
    return instance;
  }

  startNewRound(): { roundId: string; sequence: number[] } {
    this.nonce++;
    this.sequence = generateBallSequence(this.serverSeed, this.clientSeed, this.nonce);
    const roundId = `BINGO-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    return { roundId, sequence: this.sequence };
  }

  drawNextBall(): number | null {
    if (this.drawnIndex >= this.sequence.length) return null;
    return this.sequence[this.drawnIndex++];
  }

  /** Override the entire sequence – used by bot mode */
  overrideSequence(newSeq: number[]): void {
    this.sequence = newSeq;
    this.drawnIndex = 0;
  }

  setDrawnIndex(index: number): void {
    this.drawnIndex = Math.min(index, this.sequence.length);
  }

  getDrawnBalls(): number[] {
    return this.sequence.slice(0, this.drawnIndex);
  }

  getAllBalls(): number[] {
    return this.sequence;
  }

  revealSeed(): string {
    return this.serverSeed;
  }

  getServerSeed(): string {
    return this.serverSeed;
  }
}