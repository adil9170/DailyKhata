# The reader (`src/lib/dump.ts`)

`readDump(text, ctx)` turns rough notes (WhatsApp, diary lines, voice typing) into expenses, stock purchases and collections.
It is pure and runs on the phone on every keystroke. `cleanDump` (in `src/lib/ocr.ts`) shapes the AI reader's JSON into the same result.

## Measured
- `test/dump.corpus.test.ts`: 168 realistic notes (English, Hinglish, Hindi script and Devanagari digits, run-ons, `1,50,000`, `1.5k`, `2 lakh`, `500/-`, `rs`, `₹`, dates, kal/yesterday, phones, times, percentages, totals/balances, refunds, `se`/`ne`, udhaar both ways, box/peti/crate/dozen, `a + b`, typos, emoji, Urdu, empty). Accuracy **99.4% (167/168)**; the test fails below 97%.
- Never throws (2,000 random strings plus odd inputs). 20,000 characters read in about 15 ms (test limit 50 ms). Adversarial strings (long digit runs, `1 + 1 + ...`, `,gas ,gas`, ...) finish well under 500 ms.
- `cleanDump` copes with null/odd array items, strings for numbers, non-finite amounts, wrong enums and dates, and caps arrays at 300 rows and strings at their column sizes.

## Known limits
- Input is cut at 20,000 characters. Digit runs of 13 or more are ignored (not money; they made scans slow).
- A name written after the amount ("pagar 4000 Ramesh 3000 Suresh") is read as one expense.
- Urdu/Arabic script is not understood (no amounts are taken from it); Latin words in the same line still work. Arabic-Indic digits are not converted.
- A phone number written with spaces is only recognised with the `+91 98765 43210` shape; "98765 43210" alone may be read as an amount.
- "Rs 5" style amounts are rupees only; paise, lakh/crore words beyond `lakh`/`lac` (for example `crore`) are not converted.
- A bare number with no label ("500") is skipped, never guessed.
- Category and customer names are guesses from the words; the review screen is where the owner corrects them.
