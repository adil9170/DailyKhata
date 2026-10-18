import { describe, it, expect } from 'vitest';
import { calcLine, calcNote } from '../src/lib/notescalc';

const v = (s: string) => calcLine(s).value;
describe('smart notes calculator', () => {
  it('quantity x price', () => {
    expect(v('Chai 3 x 12')).toBe(36);
    expect(v('3x12')).toBe(36);
    expect(v('Milk 2 x 35 = 70')).toBe(70);
    expect(v('2 @ 510')).toBe(1020);
    expect(v('Tea 3 x 10 + 5')).toBe(35);
    expect(v('12.5 x 3')).toBe(37.5);
  });
  it('picks the amount, skips quantities, dates and phone numbers', () => {
    expect(v('Sting 2 boxes ₹1,020 60 pcs')).toBe(1020);
    expect(v('Sting 2 boxes 1020 60 pcs')).toBe(1020);
    expect(v('Gas 820')).toBe(820);
    expect(v('Rice 5 kg 300')).toBe(300);
    expect(v('16/10/2026 sales 7544')).toBe(7544);
    expect(calcLine('Call 9876543210').kind).toBe('label');
    expect(v('Wifi Rs. 2,500')).toBe(2500);
    expect(v('Paid 1,23,456')).toBe(123456);
  });
  it('arithmetic, brackets, percentages and deductions', () => {
    expect(v('500+200-50')).toBe(650);
    expect(v('(500+200)*2')).toBe(1400);
    expect(v('1,500 - 10%')).toBe(1350);
    expect(v('200 + 5%')).toBe(210);
    expect(v('10% of 500')).toBe(50);
    expect(v('-200 returned')).toBe(-200);
    expect(v('- Chai 12')).toBe(12);          // a bullet, not a deduction
    expect(v('१००+५०')).toBe(150);              // Devanagari digits
    expect(v('0.1 + 0.2')).toBe(0.3);
  });
  it('labels, comments and errors', () => {
    expect(calcLine('Rent').kind).toBe('label');
    expect(calcLine('# Monday').kind).toBe('label');
    expect(calcLine('').kind).toBe('label');
    expect(calcLine('5 / 0').kind).toBe('error');
  });
  it('adds a whole note, with running totals that are not double counted', () => {
    const r = calcNote(['Chai 3 x 12', 'Milk 2 x 35', 'total', 'Sugar 90', '', '-10 discount', 'Total'].join('\n'));
    expect(r.lines.map((l) => l.kind)).toEqual(['amount', 'amount', 'subtotal', 'amount', 'blank', 'amount', 'subtotal']);
    expect(r.lines[2].value).toBe(106);
    expect(r.lines[6].value).toBe(80);
    expect(r.total).toBe(186);
  });
});
