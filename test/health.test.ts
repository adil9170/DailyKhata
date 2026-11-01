import { describe, it, expect } from 'vitest';
// @ts-ignore node types are not part of this project's tsconfig
import { readFileSync } from 'node:fs';
import { BUILD_ID } from '../src/lib/version';
import { loginKey, LOGIN_MAX_FAILS, LOGIN_WINDOW_MIN } from '../src/lib/ratelimit';

describe('build id', () => {
  it('matches the service worker VERSION', () => {
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toMatch(new RegExp(`const VERSION = '${BUILD_ID}'`));
  });
});

describe('login rate limit', () => {
  it('keys on ip + email, capped length, tolerates a missing ip', () => {
    expect(loginKey('1.2.3.4', 'a@b.co')).toBe('1.2.3.4|a@b.co');
    expect(loginKey(undefined, 'a@b.co')).toBe('unknown|a@b.co');
    expect(loginKey('1.1.1.1', 'x'.repeat(5000)).length).toBeLessThan(260);
  });
  it('is generous and temporary', () => {
    expect(LOGIN_MAX_FAILS).toBe(10);
    expect(LOGIN_WINDOW_MIN).toBe(10);
  });
});
