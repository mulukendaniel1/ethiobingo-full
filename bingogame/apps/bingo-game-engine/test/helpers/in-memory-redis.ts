// test/helpers/in-memory-redis.ts
export class InMemoryRedis {
  private data = new Map<string, string>();
  private sets = new Map<string, Set<string>>();
  private hashes = new Map<string, Map<string, string>>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<string> {
    this.data.set(key, value);
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.data.delete(key)) count++;
      if (this.sets.delete(key)) count++;
      if (this.hashes.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const allKeys = [
      ...this.data.keys(),
      ...this.sets.keys(),
      ...this.hashes.keys(),
    ];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return allKeys.filter(k => regex.test(k));
  }

  async sadd(key: string, ...members: (string | number)[]): Promise<number> {
  if (!this.sets.has(key)) this.sets.set(key, new Set<string>());
  const set = this.sets.get(key)!;
  let added = 0;
  for (const m of members) {
    const sm = String(m);
    if (!set.has(sm)) {
      set.add(sm);
      added++;
    }
  }
  return added;
}

async srem(key: string, ...members: (string | number)[]): Promise<number> {
  if (!this.sets.has(key)) return 0;
  const set = this.sets.get(key)!;
  let removed = 0;
  for (const m of members) {
    const sm = String(m);
    if (set.delete(sm)) removed++;
  }
  return removed;
}

async smembers(key: string): Promise<string[]> {
  return this.sets.has(key) ? [...this.sets.get(key)!] : [];
}

async sismember(key: string, member: string | number): Promise<number> {
  const sm = String(member);
  return this.sets.get(key)?.has(sm) ? 1 : 0;
}

async scard(key: string): Promise<number> {
  return this.sets.get(key)?.size ?? 0;
}

 

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key)!.set(field, value);
    return 1;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (!this.hashes.has(key)) return 0;
    const hash = this.hashes.get(key)!;
    let count = 0;
    for (const f of fields) {
      if (hash.delete(f)) count++;
    }
    return count;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    return hash ? Object.fromEntries(hash) : {};
  }

  async hlen(key: string): Promise<number> {
    return this.hashes.get(key)?.size ?? 0;
  }

  async incrbyfloat(key: string, increment: number): Promise<number> {
    const current = parseFloat(this.data.get(key) ?? '0');
    const next = current + increment;
    this.data.set(key, String(next));
    return next;
  }

  async publish(channel: string, message: string): Promise<number> {
    return 0;
  }

  async subscribe(channel: string): Promise<void> {}

  on(event: string, cb: any) {}

  async quit(): Promise<string> {
    return 'OK';
  }

  // ─── minimal Lua eval interpreter for our three scripts ───
  async eval(script: string, numKeys: number, ...keysAndArgs: any[]): Promise<any> {
    const keys = keysAndArgs.slice(0, numKeys);
    const args = keysAndArgs.slice(numKeys);

    // selectCard / botJoin: contains maxCards for selectCard
    if (script.includes('maxCards')) {
      const [userKey, availKey, purchasedKey] = keys as [string, string, string];
      const [userId, cardIdStr] = args as [string, string];
      const cardId = Number(cardIdStr);

      const isMember = await this.sismember(availKey, String(cardId));
      if (!isMember) return [0, 'Card not available'];

      const cardCount = await this.scard(userKey);
      if (cardCount >= 2) return [0, 'You already have maximum cards'];

      await this.sadd(userKey, String(cardId));
      await this.srem(availKey, String(cardId));
      await this.sadd(purchasedKey, String(cardId));
      return [1];
    }

    // botJoin simple version (no maxCards, no hset)
    if (script.includes('sismember') && script.includes('sadd') && script.includes('srem') && !script.includes('hset')) {
      const [userKey, availKey, purchasedKey] = keys as [string, string, string];
      const [userId, cardIdStr] = args as [string, string];
      const cardId = Number(cardIdStr);

      const isMember = await this.sismember(availKey, String(cardId));
      if (!isMember) return [0];

      await this.sadd(userKey, String(cardId));
      await this.srem(availKey, String(cardId));
      await this.sadd(purchasedKey, String(cardId));
      return [1];
    }

    // sellCard
    if (script.includes("You do not own this card")) {
      const [userKey, purchasedKey, availKey] = keys as [string, string, string];
      const [userId, cardIdStr] = args as [string, string];
      const cardId = Number(cardIdStr);

      const isMember = await this.sismember(userKey, String(cardId));
      if (!isMember) return [0, 'You do not own this card'];

      await this.srem(userKey, String(cardId));
      await this.srem(purchasedKey, String(cardId));
      await this.sadd(availKey, String(cardId));
      return [1];
    }

    throw new Error(`Unsupported Lua script in test mock: ${script}`);
  }
}