// Amounts in words, Indian style (thousand · lakh · crore), in English and Hindi.
// Pure and import-free so the browser bundle and the tests can use it.
const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

// Hindi has a distinct word for every number 0–99.
const HI = ['शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस', 'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चौवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास', 'पचास', 'इक्यावन', 'बावन', 'तिरपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर', 'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सतासी', 'अट्ठासी', 'नवासी', 'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पंचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे'];

export type Lang = 'en' | 'hi';

const en99 = (n: number) => (n < 20 ? EN_ONES[n] : EN_TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + EN_ONES[n % 10] : ''));
const en999 = (n: number) => (n >= 100 ? EN_ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + en99(n % 100) : '') : en99(n));

function wordsEn(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
  if (crore) parts.push(wordsEn(crore) + ' Crore');
  if (lakh) parts.push(en99(lakh) + ' Lakh');
  if (thousand) parts.push(en99(thousand) + ' Thousand');
  if (rest) parts.push(en999(rest));
  return parts.join(' ');
}
const hi999 = (n: number) => (n >= 100 ? HI[Math.floor(n / 100)] + ' सौ' + (n % 100 ? ' ' + HI[n % 100] : '') : HI[n]);
function wordsHi(n: number): string {
  if (n === 0) return HI[0];
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
  if (crore) parts.push(wordsHi(crore) + ' करोड़');
  if (lakh) parts.push(HI[lakh] + ' लाख');
  if (thousand) parts.push(HI[thousand] + ' हज़ार');
  if (rest) parts.push(hi999(rest));
  return parts.join(' ');
}

/** Whole number in words. Anything above 99,999 crore, negative or fractional input is rounded/clamped. */
export function numberToWords(n: number, lang: Lang = 'en'): string {
  const v = Math.min(Math.max(Math.floor(Math.abs(Number(n) || 0)), 0), 999_999_999_999_9);
  return lang === 'hi' ? wordsHi(v) : wordsEn(v);
}

/** Money in words from integer paise. `currency` adds "Rupees … Only" / "… रुपये मात्र". */
export function amountToWords(paise: number, lang: Lang = 'en', currency = false): string {
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100), ps = abs % 100;
  let out: string;
  if (lang === 'hi') {
    out = numberToWords(rupees, 'hi') + (currency ? ' रुपये' : '');
    if (ps) out += ' ' + HI[ps] + (currency ? ' पैसे' : ' पैसा');
    if (currency) out += ' मात्र';
  } else {
    out = (currency ? 'Rupees ' : '') + numberToWords(rupees, 'en');
    if (ps) out += (currency ? ' and ' : ' point ') + (currency ? en99(ps) + ' Paise' : en99(ps));
    if (currency) out += ' Only';
  }
  return neg ? (lang === 'hi' ? 'ऋण ' : 'Minus ') + out : out;
}
