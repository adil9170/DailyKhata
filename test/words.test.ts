import { describe, it, expect } from 'vitest';
import { numberToWords, amountToWords } from '../src/lib/words';

describe('amount in words', () => {
  it('English, Indian grouping (matches the reference app)', () => {
    expect(numberToWords(8850)).toBe('Eight Thousand Eight Hundred Fifty');
    expect(numberToWords(0)).toBe('Zero');
    expect(numberToWords(100000)).toBe('One Lakh');
    expect(numberToWords(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven');
    expect(numberToWords(25000000)).toBe('Two Crore Fifty Lakh');
    expect(numberToWords(1010)).toBe('One Thousand Ten');
  });
  it('Hindi', () => {
    expect(numberToWords(8850, 'hi')).toBe('आठ हज़ार आठ सौ पचास');
    expect(numberToWords(21, 'hi')).toBe('इक्कीस');
    expect(numberToWords(199999, 'hi')).toBe('एक लाख निन्यानवे हज़ार नौ सौ निन्यानवे');
    expect(numberToWords(10000000, 'hi')).toBe('एक करोड़');
  });
  it('rupees and paise', () => {
    expect(amountToWords(885000, 'en', true)).toBe('Rupees Eight Thousand Eight Hundred Fifty Only');
    expect(amountToWords(12550, 'en', true)).toBe('Rupees One Hundred Twenty Five and Fifty Paise Only');
    expect(amountToWords(885000, 'hi', true)).toBe('आठ हज़ार आठ सौ पचास रुपये मात्र');
    expect(amountToWords(-500, 'en')).toBe('Minus Five');
  });
});
