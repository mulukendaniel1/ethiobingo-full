//src/services/ETBWithdrawalServiceInstance.ts
export const ETBWithdrawalService = (() => {
  const { ETBWithdrawalService: ETBWithdrawalServiceClass } = require('./ETBWithdrawalService');
  return new ETBWithdrawalServiceClass();
})();