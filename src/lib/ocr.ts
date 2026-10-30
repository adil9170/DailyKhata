import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../types';
import { parseText, type ParsedEntries, type ParseContext } from './parser';
import { readDump, type DumpContext, type DumpResult } from './dump';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const nullable = (t: Record<string, unknown>) => ({ anyOf: [t, { type: 'null' }] });
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'purchases', 'expenses', 'collections', 'notes'],
  properties: {
    date: nullable({ type: 'string', description: 'Date written on the record as YYYY-MM-DD, or null' }),
    purchases: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['item', 'qty', 'unit', 'pieces', 'total'],
        properties: {
          item: { type: 'string' },
          qty: { type: 'number', description: 'Quantity in purchase units (e.g. 2 for "2 boxes")' },
          unit: { type: 'string', description: 'box, crate, pack, kg, bottle ...' },
          pieces: nullable({ type: 'integer', description: 'Total individual pieces if written' }),
          total: { type: 'number', description: 'Total cost in rupees for this line' },
        },
      },
    },
    expenses: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['category', 'amount'], properties: { category: { type: 'string' }, amount: { type: 'number' } } },
    },
    collections: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['amount', 'mode'],
        properties: { amount: { type: 'number' }, mode: { type: 'string', enum: ['cash', 'upi', 'card', 'credit'] } },
      },
    },
    notes: nullable({ type: 'string', description: 'Anything that could not be classified, or uncertain readings' }),
  },
} as const;

function instructions(ctx: ParseContext) {
  return `This image is a page from an Indian shop's daily accounts (hisaab) - it may be handwritten, in English, Hindi or Urdu, or a printed bill/receipt.
Extract every line into structured data:
- purchases: stock bought (item name, quantity with unit such as boxes, total cost in rupees, number of pieces if written)
- expenses: running costs such as gas, wifi, water, rent, salary, transport
- collections: money collected from sales ("collection", "sale", "galla", "bikri"); mode credit only if marked udhaar/credit
Amounts are rupees (₹). Remove commas. If the year is missing assume ${ctx.defaultYear}.
Known products (prefer these spellings when they match): ${ctx.products.map((p) => p.name).join(', ') || 'none yet'}.
Known expense categories: ${ctx.categories.join(', ') || 'none yet'}.
Do not invent lines. Put unreadable or doubtful items in notes.`;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export interface OcrOutcome { engine: string; result: ParsedEntries; raw_text?: string; notes?: string | null }

interface ExtractedData {
  date: string | null; notes: string | null;
  purchases: { item: string; qty: number; unit: string; pieces: number | null; total: number }[];
  expenses: { category: string; amount: number }[];
  collections: { amount: number; mode: 'cash' | 'upi' | 'card' | 'credit' }[];
}

function toOutcome(engine: string, data: ExtractedData): OcrOutcome {
  return {
    engine,
    notes: data.notes,
    result: {
      date: data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : null,
      purchases: (data.purchases ?? []).map((raw) => ({ p: { ...raw, qty: Number(raw.qty) > 0 ? Number(raw.qty) : 1, unit: raw.unit || 'unit' } })).map(({ p }) => ({ ...p, line: `${p.item} ${p.qty} ${p.unit} ₹${p.total}` })),
      expenses: (data.expenses ?? []).map((e) => ({ ...e, line: `${e.category} ₹${e.amount}` })),
      collections: (data.collections ?? []).map((c) => ({ ...c, line: `Collection ₹${c.amount}` })),
      unparsed: data.notes ? [data.notes] : [],
    },
  };
}

// Fast model first (2 s on a handwritten bill; the full Flash model took 30-70 s), the self-updating alias as backup if Google retires it.
// Set GEMINI_MODEL to force a specific model.
const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];

async function geminiJson<T>(apiKey: string, model: string, parts: unknown[]): Promise<T> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingBudget: 0 } }, // reading a page needs no reasoning pass; it took 70 s with thinking on
    }),
  });
  if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(text) as T;
}

function geminiExtract(apiKey: string, model: string, image: ArrayBuffer, media: string, ctx: ParseContext): Promise<ExtractedData> {
  return geminiJson<ExtractedData>(apiKey, model, [
    { inline_data: { mime_type: media, data: toBase64(image) } },
    { text: `${instructions(ctx)}\nReturn only JSON matching this JSON Schema:\n${JSON.stringify(SCHEMA)}` },
  ]);
}

export async function extractFromImage(env: Env, image: ArrayBuffer, contentType: string, ctx: ParseContext): Promise<OcrOutcome> {
  if (image.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is larger than 5 MB; please upload a smaller photo');
  const media = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType) ? contentType : 'image/jpeg') as 'image/jpeg';

  if (env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: toBase64(image) } },
          { type: 'text', text: instructions(ctx) },
        ],
      }],
    });
    if (res.stop_reason === 'refusal') throw new Error('The AI declined to read this image');
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return toOutcome('claude', JSON.parse(text) as ExtractedData);
  }

  if (env.GEMINI_API_KEY) {
    let lastError: unknown;
    for (const model of env.GEMINI_MODEL ? [env.GEMINI_MODEL] : GEMINI_MODELS) {
      try { return toOutcome('gemini', await geminiExtract(env.GEMINI_API_KEY, model, image, media, ctx)); } catch (e) { lastError = e; console.warn(`Gemini ${model} failed:`, String(e)); }
    }
    // Free tier is rate limited: fall through to Workers AI when it is available.
    if (!env.AI) throw lastError;
  }

  if (env.AI) {
    // Workers AI: transcribe the page to plain lines, then run the deterministic hisaab parser.
    const model = '@cf/meta/llama-3.2-11b-vision-instruct' as const;
    const prompt = `Transcribe this shop accounts page line by line as plain text. For each line write: item name, quantity with unit, amount in rupees, pieces if written. Keep collection/sale lines and dates. Output only the transcription.`;
    const run = () => env.AI!.run(model, { image: [...new Uint8Array(image)], prompt, max_tokens: 1024 } as never) as Promise<{ response?: string }>;
    let out: { response?: string };
    try { out = await run(); } catch (e) {
      // Meta's license must be accepted once per account before the model can be used.
      if (String(e).includes('agree')) { await env.AI.run(model, { prompt: 'agree' } as never); out = await run(); } else throw e;
    }
    const raw = out.response ?? '';
    return { engine: 'workers-ai', raw_text: raw, result: parseText(raw, ctx) };
  }

  throw new Error('No OCR engine configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY, or enable the Workers AI binding.');
}

// ---------- text dumps ("Write expenses" page): AI reading for text the quick on-phone reader gets wrong ----------
const ymd = nullable({ type: 'string', description: 'YYYY-MM-DD if the text gives a date for this item, else null' });
const PAY = { type: 'string', enum: ['cash', 'bank', 'credit'] };
const TEXT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['expenses', 'purchases', 'collections'],
  properties: {
    expenses: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['category', 'amount', 'notes', 'payment_mode', 'date', 'source'],
        properties: { category: { type: 'string' }, amount: { type: 'number' }, notes: { type: 'string' }, payment_mode: PAY, date: ymd, source: { type: 'string', description: 'The words this came from' } },
      },
    },
    purchases: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['item', 'qty', 'unit', 'pieces', 'total', 'payment_mode', 'date', 'source'],
        properties: { item: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' }, pieces: nullable({ type: 'integer' }), total: { type: 'number' }, payment_mode: PAY, date: ymd, source: { type: 'string' } },
      },
    },
    collections: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['amount', 'mode', 'customer', 'date', 'source'],
        properties: { amount: { type: 'number' }, mode: { type: 'string', enum: ['cash', 'upi', 'card', 'credit'] }, customer: { type: 'string' }, date: ymd, source: { type: 'string' } },
      },
    },
  },
} as const;

function textInstructions(text: string, ctx: DumpContext) {
  return `The text inside <notes> is an Indian shopkeeper's rough notes: WhatsApp messages, diary lines or voice typing, in English, Hindi, Hinglish or Urdu. Today is ${ctx.today ?? 'unknown'}.
Pick out every money movement:
- expenses: money spent running the shop (gas, rent, salary, tea, transport, bills, repairs...). category: short name; use one of these existing categories when it fits: ${ctx.categories.join(', ') || 'none yet'}. notes: a person's name or other detail, else "".
- purchases: stock bought to resell (item, quantity, unit such as box/crate/pack, pieces if written, total cost). Known products: ${ctx.products.map((p) => p.name).join(', ') || 'none yet'}.
- collections: money received (sales, galla, customer payments). mode: upi for UPI/GPay/PhonePe/Paytm, card, credit only for udhaar, else cash. customer: name if written, else "".
payment_mode for expenses and purchases: bank if paid by UPI/online/bank/card, credit if on udhaar, else cash.
date: only when the text gives one for that item (turn "yesterday"/"kal" into a date from today), else null.
source: the few words the item came from, copied from the text.
Skip totals, balances, opening/closing cash, phone numbers, times and anything that is not money. Never invent items or amounts. Amounts are rupees as plain numbers.
<notes>
${text}
</notes>`;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const amt = (v: unknown) => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) && n > 0 ? n : 0; };
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const pay = (v: unknown) => (v === 'bank' || v === 'credit' ? v : 'cash');

/** Clean whatever the model sent back into the same shape the on-phone reader produces. */
function cleanDump(data: any): DumpResult {
  return {
    expenses: (Array.isArray(data?.expenses) ? data.expenses : []).map((e: any) => ({ category: str(e.category, 60) || 'Other', amount: amt(e.amount), notes: str(e.notes, 200), payment_mode: pay(e.payment_mode), date: day(e.date), source: str(e.source, 200) }))
      .filter((e: { amount: number }) => e.amount > 0).slice(0, 300),
    purchases: (Array.isArray(data?.purchases) ? data.purchases : []).map((p: any) => ({ item: str(p.item, 80), product_id: null, qty: amt(p.qty) || 1, unit: str(p.unit, 20) || 'box', pieces: Number.isInteger(p.pieces) && p.pieces > 0 ? p.pieces : null, total: amt(p.total), payment_mode: pay(p.payment_mode), date: day(p.date), source: str(p.source, 200) }))
      .filter((p: { item: string; total: number }) => p.item && p.total > 0).slice(0, 300),
    collections: (Array.isArray(data?.collections) ? data.collections : []).map((c: any) => ({ amount: amt(c.amount), mode: ['upi', 'card', 'credit'].includes(c.mode) ? c.mode : 'cash', customer: str(c.customer, 80), date: day(c.date), source: str(c.source, 200) }))
      .filter((c: { amount: number }) => c.amount > 0).slice(0, 300),
    skipped: [],
  };
}

export async function extractFromText(env: Env, text: string, ctx: DumpContext): Promise<DumpResult & { engine: string }> {
  const prompt = textInstructions(text, ctx);
  if (env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: TEXT_SCHEMA } },
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal') throw new Error('The AI declined to read this text');
    const out = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return { engine: 'claude', ...cleanDump(JSON.parse(out)) };
  }
  if (env.GEMINI_API_KEY) {
    let lastError: unknown;
    for (const model of env.GEMINI_MODEL ? [env.GEMINI_MODEL] : GEMINI_MODELS) {
      try {
        return { engine: 'gemini', ...cleanDump(await geminiJson(env.GEMINI_API_KEY, model, [{ text: `${prompt}\nReturn only JSON matching this JSON Schema:\n${JSON.stringify(TEXT_SCHEMA)}` }])) };
      } catch (e) { lastError = e; console.warn(`Gemini ${model} failed:`, String(e)); }
    }
    throw lastError;
  }
  // No AI configured: the same reader the phone uses.
  return { engine: 'rules', ...readDump(text, ctx) };
}
