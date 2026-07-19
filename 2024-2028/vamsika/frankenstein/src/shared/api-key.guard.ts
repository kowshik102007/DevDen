/**
 * API Key Guard
 *
 * Simple API-key authentication for factory and agent-generate actions.
 * Reads API_KEY_* from environment variables directly.
 *
 * Stated clearly: this is scaffolded, not production-hardened.
 * In dev mode, requests without a key are allowed (NitroStudio
 * connects via stdio and won't send a key).
 */

import { Injectable, Guard, ExecutionContext } from '@nitrostack/core';

@Injectable()
export class ApiKeyGuard implements Guard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // In dev mode, allow all (NitroStudio connects via stdio)
    if (process.env.NODE_ENV !== 'production') return true;

    const apiKey = context.metadata?.['x-api-key'] || context.metadata?.apiKey;
    if (!apiKey) return false;

    // Collect valid keys from env (API_KEY_1, API_KEY_2, ...)
    const validKeys: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`API_KEY_${i}`];
      if (key) validKeys.push(key);
    }

    return validKeys.includes(apiKey as string);
  }
}
