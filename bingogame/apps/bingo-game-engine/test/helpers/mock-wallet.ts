// test/helpers/mock-wallet.ts
export class MockWalletClient {
  buyCard = async () => ({ success: true, newBalance: 1000 });
  sellCard = async () => ({ success: true, newBalance: 1000 });
  win = async () => ({ success: true, balance: 2000 });
  sendRoundResult = async () => ({ success: true });
}