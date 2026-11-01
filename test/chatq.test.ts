import { describe, it, expect } from 'vitest';
import { readQuestion, findParty } from '../src/lib/chatq';

describe('readQuestion', () => {
  it('day questions', () => {
    for (const q of ['aaj kitna', 'Aaj kitna hua?', 'today total', 'total', 'hisaab']) expect(readQuestion(q), q).toEqual({ type: 'day', offset: 0 });
    for (const q of ['kal ka total', 'yesterday', 'Yesterday total?', 'kal kitna hua', 'कल का हिसाब']) expect(readQuestion(q), q).toEqual({ type: 'day', offset: -1 });
  });
  it('udhaar total', () => {
    for (const q of ['kitna udhaar', 'kitna udhaar baaki hai?', 'udhaar kitna', 'total udhaar']) expect(readQuestion(q), q).toEqual({ type: 'udhaar' });
  });
  it('one customer', () => {
    expect(readQuestion('Sharma ka hisaab')).toEqual({ type: 'party', name: 'sharma' });
    expect(readQuestion('Raju ka udhaar kitna?')).toEqual({ type: 'party', name: 'raju' });
    expect(readQuestion('hisaab of Mehta')).toEqual({ type: 'party', name: 'mehta' });
  });
  it('leaves entries and junk to the reader', () => {
    for (const q of ['chai 40', 'Sharma se 3000 mila', 'Raju udhaar 300', '', '   ', 'hello there']) expect(readQuestion(q), q).toBeNull();
    expect(readQuestion(42 as any)).toBeNull();
    expect(readQuestion(null)).toBeNull();
  });
  it('is fast on huge input', () => {
    const t = Date.now(); readQuestion('ka '.repeat(50000)); readQuestion('a'.repeat(100000)); expect(Date.now() - t).toBeLessThan(100);
  });
});

describe('findParty', () => {
  const l = [{ party: 'Sharma Ji', balance: 500 }, { party: 'Sharma', balance: 200 }, { party: 'Mehta', balance: 230 }];
  it('exact beats partial', () => { expect(findParty(l, 'sharma').map((p) => p.balance)).toEqual([200]); });
  it('partial', () => { expect(findParty(l, 'meh')).toHaveLength(1); expect(findParty(l, 'zzz')).toEqual([]); expect(findParty(l, '')).toEqual([]); });
});
