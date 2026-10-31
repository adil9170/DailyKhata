// Pure helpers for the landing page's SEO: the Hindi copy of index.html and the JSON-LD blocks. Used by build-client.mjs and tests.
export const SITE = 'https://jakcrew.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FAQ_KEYS = [0, 1, 2, 3, 4];

export function faqLd(dict) {
  return { '@type': 'FAQPage', mainEntity: FAQ_KEYS.map((i) => ({ '@type': 'Question', name: dict['q' + i], acceptedAnswer: { '@type': 'Answer', text: dict['a' + i] } })) };
}
export function appLd(dict, inLanguage, url) {
  return { '@type': 'SoftwareApplication', name: 'DailyKhata', url, description: dict.meta_desc, applicationCategory: 'BusinessApplication', operatingSystem: 'Any (web browser)', inLanguage };
}
// one script block holding both; "<" is escaped so the text can never close the tag
export function jsonLd(dict, inLanguage, url) {
  const body = JSON.stringify({ '@context': 'https://schema.org', '@graph': [appLd(dict, inLanguage, url), faqLd(dict)] }, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${body}\n</script>`;
}

// Turns the English page into the Hindi page: same markup, Hindi text already in place (crawlers do not run the switch).
export function buildHindi(html, HI, EN) {
  const need = (k) => { if (HI[k] == null) throw new Error('missing Hindi key ' + k); return HI[k]; };
  let out = html;
  // elements with text (data-i18n) or trusted markup (data-i18n-html): replace the inner content, which holds no same-name nested tag
  out = out.replace(/<([a-z0-9]+)((?:\s[^>]*?)?\sdata-i18n(-html)?="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (_m, tag, attrs, isHtml, key) => `<${tag}${attrs}>${isHtml ? need(key) : esc(need(key))}</${tag}>`);
  // attribute translations
  for (const [a, target] of [['placeholder', 'placeholder'], ['alt', 'alt'], ['aria', 'aria-label'], ['content', 'content']]) {
    out = out.replace(new RegExp(`<[^>]*\\sdata-i18n-${a}="([^"]+)"[^>]*>`, 'g'), (tagText, key) => {
      const re = new RegExp(`(\\s${target}=")[^"]*(")`);
      return re.test(tagText) ? tagText.replace(re, (_x, p, q) => p + esc(need(key)) + q) : tagText;
    });
  }
  out = out.replace('<html lang="en">', '<html lang="hi">')
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}/hi/">`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${SITE}/hi/">`)
    .replace(/<meta property="og:locale"[^>]*>/, '<meta property="og:locale" content="hi_IN">')
    .replace(/<link rel="alternate" hreflang="[^"]*"[^>]*>\s*/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, jsonLd(HI, 'hi', SITE + '/hi/'));
  out = out.replace(/(<link rel="canonical"[^>]*>)/, `$1\n  <link rel="alternate" hreflang="en" href="${SITE}/">\n  <link rel="alternate" hreflang="hi" href="${SITE}/hi/">\n  <link rel="alternate" hreflang="x-default" href="${SITE}/">`);
  return out;
}
