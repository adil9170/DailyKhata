import { describe, it, expect } from 'vitest';
import { readDump } from '../src/lib/dump';
import { cleanDump } from '../src/lib/ocr';

// A corpus of realistic shopkeeper notes with what a human reads in each (ground truth by intent, not by output).
// Expected is a space-separated multiset: E<amt> expense, C<amt> collection, P<amt> stock purchase; '-' = no money.
const ctx = { defaultYear: 2026, today: '2026-10-30', products: [{ id: 1, name: 'Sting', pieces_per_unit: 30 }, { id: 2, name: 'Campa Orange', pieces_per_unit: 24 }], categories: ['Gas', 'Wi-Fi', 'Water', 'Tea'] };

const CORPUS: [string, string][] = [
  // English
  ['Paid 500 for gas', 'E500'],
  ['spent Rs. 60 on milk', 'E60'],
  ['Gave Ramesh 2000 as salary', 'E2000'],
  ['Got 1500 from Gupta via UPI', 'C1500'],
  ['rent paid 15000', 'E15000'],
  ['electricity bill 1450', 'E1450'],
  ['internet 799', 'E799'],
  ['petrol 300', 'E300'],
  ['bought 4 cups tea for 40', 'E40'],
  ['auto fare 120', 'E120'],
  ['repair of freezer 850', 'E850'],
  ['tea and samosa 70', 'E70'],
  ['cleaning staff 3000', 'E3000'],
  ['donation to temple 501', 'E501'],
  ['loan emi 4200', 'E4200'],
  ['stationery 90', 'E90'],
  ['received 2500 from Mehta', 'C2500'],
  ['collected 800 from Singh', 'C800'],
  ['cash sale 6290', 'C6290'],
  ['sales today 12000', 'C12000'],
  ['doctor 600', 'E600'],
  ['medicine 340', 'E340'],
  ['courier charges 90', 'E90'],
  ['parking 20', 'E20'],
  ['water can 40', 'E40'],
  ['ice 150', 'E150'],
  ['polythene bags 220', 'E220'],
  ['broom and phenyl 110', 'E110'],
  ['gst 1800 paid', 'E1800'],
  ['lunch for staff 250', 'E250'],
  // Hinglish
  ['aaj gas 820 diya', 'E820'],
  ['chai 40', 'E40'],
  ['bijli bill 1450 paid', 'E1450'],
  ['Sharma se 3000 mila', 'C3000'],
  ['Verma ne 500 diye', 'C500'],
  ['kiraya 8000 diya', 'E8000'],
  ['pagar 6000 diya Ramu ko', 'E6000'],
  ['nashta 60', 'E60'],
  ['barf 200', 'E200'],
  ['safai wale ko 500 diye', 'E500'],
  ['mistri ko 700 diye', 'E700'],
  ['dawai 280', 'E280'],
  ['galla 9000', 'C9000'],
  ['bikri 4500', 'C4500'],
  ['Pappu se 1200 aaya', 'C1200'],
  ['kal bijli 900 bhara', 'E900'],
  ['wifi ka 600 diya', 'E600'],
  ['gaadi ka bhada 350', 'E350'],
  ['chanda 101 diya', 'E101'],
  ['tempo bhada 450', 'E450'],
  // Hindi script / Devanagari digits
  ['चाय ४०', 'E40'],
  ['बिजली १२००', 'E1200'],
  ['किराया ८०००', 'E8000'],
  ['गैस ८२०', 'E820'],
  ['पानी ६०', 'E60'],
  ['सैलरी ५०००', 'E5000'],
  ['दवाई ३५०', 'E350'],
  ['बर्फ १५०', 'E150'],
  ['आज चाय ३०', 'E30'],
  ['नाश्ता ८०', 'E80'],
  ['खाना १२०', 'E120'],
  ['पेट्रोल ५००', 'E500'],
  ['शर्मा से ३००० मिला', 'C3000'],
  ['बिक्री ४५००', 'C4500'],
  ['ऑटो ८०', 'E80'],
  // WhatsApp-style run-ons
  ['gas 820 chai 40 auto 120 ice 50', 'E820 E40 E120 E50'],
  ['chai 40 samosa 30 auto 60', 'E40 E30 E60'],
  ['aaj gas 820 diya, chai 40, auto 120. Ramesh salary 5000 gpay', 'E820 E40 E120 E5000'],
  ['petrol 300 parking 20 chai 30', 'E300 E20 E30'],
  ['rent 8000 bijli 1200 wifi 600', 'E8000 E1200 E600'],
  ['gas 820, chai 40, auto 120', 'E820 E40 E120'],
  ['gas 820\nchai 40\nauto 120', 'E820 E40 E120'],
  ['ice 100 gas 800 water 40 tea 60 auto 90', 'E100 E800 E40 E60 E90'],
  ['bijli 900 pani 100 kiraya 5000', 'E900 E100 E5000'],
  ['Raju ne 400 diye Pappu ne 300 diye', 'C400 C300'],
  // money formats
  ['rent 15,000/-', 'E15000'],
  ['wifi ₹ 2,500', 'E2500'],
  ['labour 1.5k', 'E1500'],
  ['petrol 300rs', 'E300'],
  ['chai 4 x 10', 'E40'],
  ['samosa 20 + 30', 'E50'],
  ['salary 1,50,000', 'E150000'],
  ['rent 2 lakh', 'E200000'],
  ['loan kist 1.25 lakh', 'E125000'],
  ['gas 500/-', 'E500'],
  ['bijli 1,450', 'E1450'],
  ['chai ₹40', 'E40'],
  ['auto Rs 120', 'E120'],
  ['auto rs.120', 'E120'],
  ['petrol 2k', 'E2000'],
  ['rent 12 hazar', 'E12000'],
  ['pagar 7.5k diya', 'E7500'],
  ['gas INR 900', 'E900'],
  ['wifi 600 rupees', 'E600'],
  ['chai 25rs', 'E25'],
  ['internet ₹1,299', 'E1299'],
  ['sale 1,23,456', 'C123456'],
  ['tea 3 x 12 = 36', 'E36'],
  ['bhada 500 + 200', 'E700'],
  ['gas 700 + 120 + 30', 'E850'],
  // dates, kal/yesterday
  ['16 Oct\ngas 820\nchai 30', 'E820 E30'],
  ['17/10/2026: wifi 500', 'E500'],
  ['yesterday auto 80', 'E80'],
  ['kal chai 50', 'E50'],
  ['12 Oct 2026 rent 8000', 'E8000'],
  ['15-10-2026 gas 800', 'E800'],
  ['Date: 20/10/26\nbijli 1000', 'E1000'],
  // times, phones, percentages, totals, balances
  ['call Raju 9876543210', '-'],
  ['Raju +91 98765 43210 chai 40', 'E40'],
  ['meeting at 5:30 pm', '-'],
  ['shop opens 9am', '-'],
  ['gst 18% included', '-'],
  ['discount 10%', '-'],
  ['Total 3000', '-'],
  ['grand total 12500', '-'],
  ['balance 200', '-'],
  ['opening cash 3303', '-'],
  ['closing balance 7693', '-'],
  ['bacha 450', '-'],
  ['कुल 5000', '-'],
  ['subtotal 900', '-'],
  ['refund 300', '-'],
  ['returned 250 to customer', '-'],
  ['wapas 120', '-'],
  ['water 875\ntotal 875', 'E875'],
  ['chai 40\nsamosa 30\ntotal 70', 'E40 E30'],
  ['opening 3303\ngas 820\nclosing 2483', 'E820'],
  // udhaar both directions
  ['Raju udhaar 450', 'C450'],
  ['Raju udhaar 300 sale', 'C300'],
  ['udhaar diya supplier ko 2000', 'E2000'],
  ['Mehta udhaar 230', 'C230'],
  ['Gupta ji ne udhaar liya 500', 'C500'],
  ['paid Mehta supplier 4000 udhaar', 'E4000'],
  // stock units
  ['Sting 2 boxes 1020 60', 'P1020'],
  ['bought 1 box campa orange 240', 'P240'],
  ['Cloud Nine 2 box 800 60 pcs', 'P800'],
  ['Pepsi 3 crates 1500', 'P1500'],
  ['Maaza 1 peti 480', 'P480'],
  ['Thums Up 2 dozen 600', 'P600'],
  ['Bisleri 5 cartons 900', 'P900'],
  ['Frooti 4 packs 160', 'P160'],
  ['sting 1 box 510', 'P510'],
  ['2 crate Fanta 1100', 'P1100'],
  // typos, emoji, noise
  ['chai 40 ☕', 'E40'],
  ['gas 820 ✅', 'E820'],
  ['🔥 sale 5000 🔥', 'C5000'],
  ['chaay 40', 'E40'],
  ['bijlee 900', 'E900'],
  ['petrol 300 👍', 'E300'],
  ['aaj bahut kaam tha', '-'],
  ['Dear diary, busy day today.', '-'],
  ['ok', '-'],
  ['👍👍👍', '-'],
  // Urdu / Arabic characters
  ['چائے 40', '-'],
  ['کرایہ 5000', '-'],
  ['بجلی ۱۲۰۰', '-'],
  ['kiraya 5000 کرایہ', 'E5000'],
  // empty / whitespace
  ['', '-'],
  ['   ', '-'],
  ['\n\n\n', '-'],
  ['\t \r\n', '-'],
  // mixed paragraphs
  ['aaj sale 8000\ngas 820\nchai 40\nSharma se 3000 mila\ntotal 11860', 'C8000 E820 E40 C3000'],
  ['rent 8000\nbijli 1200\nSting 2 boxes 1020 60\nRaju udhaar 450', 'E8000 E1200 P1020 C450'],
  ['Kal ka hisab:\nchai 40\nauto 80\nbijli 500', 'E40 E80 E500'],
  ['wifi 600 paid by gpay', 'E600'],
  ['gas 900 phonepe', 'E900'],
  ['received 5000 paytm from Roy', 'C5000'],
  ['pagar 4000 Ramesh 3000 Suresh', 'E4000 E3000'],
];

type R = ReturnType<typeof readDump>;
const summarise = (r: R) => [...r.expenses.map((e) => 'E' + e.amount), ...r.collections.map((c) => 'C' + c.amount), ...r.purchases.map((p) => 'P' + p.total)].sort();
const want = (s: string) => (s === '-' ? [] : s.split(' ')).sort();

describe('reader corpus', () => {
  it('has at least 150 notes', () => expect(CORPUS.length).toBeGreaterThanOrEqual(150));

  it('reads the corpus accurately (measured below)', () => {
    const misses: string[] = [];
    for (const [text, expected] of CORPUS) {
      const got = summarise(readDump(text, ctx));
      if (JSON.stringify(got) !== JSON.stringify(want(expected))) misses.push(`${JSON.stringify(text)} want ${expected} got ${got.join(' ') || '-'}`);
    }
    const accuracy = (100 * (CORPUS.length - misses.length)) / CORPUS.length;
    console.log(`reader accuracy ${accuracy.toFixed(1)}% (${CORPUS.length - misses.length}/${CORPUS.length})\n` + misses.join('\n'));
    expect(accuracy).toBeGreaterThanOrEqual(Number(process.env.READER_MIN ?? 97));
  });
});

describe('reader robustness', () => {
  const alphabet = ['gas', 'chai', '820', '40', '₹', 'rs', '1,50,000', '2 lakh', 'k', '+', '-', '/-', ' ', '\n', ',', '.', ';', 'se', 'ne', 'udhaar', 'total', 'box', 'x', '=', '%', ':', '९', 'क', 'ا', '😀', '​', '9876543210', '5:30 pm', '12 Oct'];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

  it('never throws on 2,000 random strings', () => {
    for (let i = 0; i < 2000; i++) {
      let s = '';
      const n = Math.floor(rnd() * 40);
      for (let j = 0; j < n; j++) s += alphabet[Math.floor(rnd() * alphabet.length)] + (rnd() < 0.5 ? ' ' : '');
      expect(() => readDump(s, ctx)).not.toThrow();
    }
  });

  it('never throws on odd inputs', () => {
    for (const v of [undefined, null, 5, {}, [], '\0\0', '9'.repeat(400), '₹'.repeat(1000), '.'.repeat(5000), '१'.repeat(300)]) {
      expect(() => readDump(v as any, ctx)).not.toThrow();
    }
  });

  it('keeps amounts finite', () => {
    const r = readDump('rent ' + '9'.repeat(300) + '\ngas 1e999 2e308', ctx);
    for (const e of r.expenses) expect(Number.isFinite(e.amount)).toBe(true);
  });

  it('reads a 20,000-character note in under 50 ms', () => {
    const line = 'gas 820 chai 40 auto 120, Sharma se 3000 mila. ';
    const text = line.repeat(Math.ceil(20000 / line.length)).slice(0, 20000);
    readDump(text, ctx); // warm up
    const t = performance.now();
    readDump(text, ctx);
    expect(performance.now() - t).toBeLessThan(50);
  });

  it('survives adversarial strings without catastrophic backtracking', () => {
    const cases = [
      '1 + '.repeat(5000), '1,'.repeat(5000), '9'.repeat(20000), 'a'.repeat(20000), ' '.repeat(20000), '1.'.repeat(10000), '₹ '.repeat(10000),
      '1k '.repeat(6000), 'x 1 '.repeat(5000), '1\n'.repeat(10000), '1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1+1', 'aaa 1 '.repeat(3000),
      ',gas '.repeat(4000), '. '.repeat(10000), '1 / '.repeat(5000), 'rs. '.repeat(5000),
    ];
    for (const c of cases) {
      const t = performance.now();
      readDump(c, ctx);
      expect(performance.now() - t, c.slice(0, 20)).toBeLessThan(2000);
    }
  });
});

describe('cleanDump (AI output)', () => {
  it('copes with null, junk and missing fields', () => {
    for (const v of [null, undefined, 5, 'x', [], {}, { expenses: 'no' }, { expenses: [null, 5, 'x'] }, { purchases: [{}], collections: [{}] }]) {
      const r = cleanDump(v as any);
      expect(r).toEqual({ expenses: [], purchases: [], collections: [], skipped: [] });
    }
  });

  it('turns strings into numbers and drops non-positive amounts', () => {
    const r = cleanDump({
      expenses: [{ category: 'Gas', amount: '820' }, { category: 'X', amount: 'abc' }, { category: 'Y', amount: -5 }, { amount: 10 }, { category: 'Z', amount: Infinity }, { category: 'W', amount: '1e999' }],
      collections: [{ amount: '3000', mode: 'upi', customer: 'Sharma' }, { amount: 0 }],
    });
    expect(r.expenses.map((e) => [e.category, e.amount])).toEqual([['Gas', 820], ['Other', 10]]);
    expect(r.collections).toEqual([expect.objectContaining({ amount: 3000, mode: 'upi', customer: 'Sharma' })]);
  });

  it('falls back on wrong enums and bad dates', () => {
    const r = cleanDump({
      expenses: [{ category: 'Gas', amount: 5, payment_mode: 'bitcoin', date: '30/10/2026' }],
      collections: [{ amount: 5, mode: 'cheque', date: '2026-10-30' }],
      purchases: [{ item: 'Sting', total: 100, qty: 'two', unit: '', pieces: 2.5, payment_mode: 7, date: 5 }],
    });
    expect(r.expenses[0]).toMatchObject({ payment_mode: 'cash', date: null });
    expect(r.collections[0]).toMatchObject({ mode: 'cash', date: '2026-10-30' });
    expect(r.purchases[0]).toMatchObject({ qty: 1, unit: 'box', pieces: null, payment_mode: 'cash', date: null });
  });

  it('caps huge arrays and long strings', () => {
    const many = Array.from({ length: 5000 }, () => ({ category: 'c'.repeat(500), amount: 1, notes: 'n'.repeat(1000), source: 's'.repeat(1000) }));
    const r = cleanDump({ expenses: many, collections: many.map((m) => ({ ...m, customer: 'x'.repeat(500) })) });
    expect(r.expenses.length).toBe(300);
    expect(r.expenses[0].category.length).toBe(60);
    expect(r.expenses[0].notes.length).toBe(200);
    expect(r.collections.length).toBe(300);
    expect(r.collections[0].customer.length).toBe(80);
  });
});
