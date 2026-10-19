//src\services\ETBDepositServiceInstance.ts
export const ETBDepositService = (() => {
  const { ETBDepositService: ETBDepositServiceClass } = require('./ETBDepositService');
  return new ETBDepositServiceClass();
})();