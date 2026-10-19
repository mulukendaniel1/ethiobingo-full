// src/services/ETBCoinServiceInstance.ts
export const ETBCoinService = (() => {
  const { ETBCoinService: ETBCoinServiceClass } = require('./ETBCoinService');
  return new ETBCoinServiceClass();
})();