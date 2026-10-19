//packages\shared-types\src\user.ts
// Only the fields the game engine needs (read-only)
export interface IUserPublic {
  _id: string;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  etmCoins: number;
  lockedETM: number;
  isBanned: boolean;
}