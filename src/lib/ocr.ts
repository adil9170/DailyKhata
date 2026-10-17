import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../types';
import { parseText, type ParsedEntries, type ParseContext } from './parser';

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
      purchases: (data.purchases ?? []).map((p) => ({ ...p, line: `${p.item} ${p.qty} ${p.unit} ₹${p.total}` })),
      expenses: (data.expenses ?? []).map((e) => ({ ...e, line: `${e.category} ₹${e.amount}` })),
      collections: (data.collections ?? []).map((c) => ({ ...c, line: `Collection ₹${c.amount}` })),
      unparsed: data.notes ? [data.notes] : [],
    },
  };
}

const GEMINI_MODEL = 'gemini-2.5-flash';

async function geminiExtract(apiKey: string, image: ArrayBuffer, media: string, ctx: ParseContext): Promise<ExtractedData> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: media, data: toBase64(image) } },
          { text: `${instructions(ctx)}\nReturn only JSON matching this JSON Schema:\n${JSON.stringify(SCHEMA)}` },
        ],
      }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(text) as ExtractedData;
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
    try {
      return toOutcome('gemini', await geminiExtract(env.GEMINI_API_KEY, image, media, ctx));
    } catch (e) {
      // The free tier is rate limited; fall through to Workers AI when it is available.
      if (!env.AI) throw e;
      console.warn('Gemini OCR failed, falling back to Workers AI:', String(e));
    }
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
