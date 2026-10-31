// Landing page language: English (default) and Hindi. The HTML ships in English; elements carry data-i18n="key" (text),
// data-i18n-html="key" (trusted markup from this file), data-i18n-placeholder / data-i18n-alt / data-i18n-content="key".
// The choice lives in localStorage.dk_lang; with no choice, a browser whose language starts with "hi" gets Hindi.
// boot.js applies <html lang> before first paint and hides the page until applyLang() has run, so there is no flash.
export const EN = {
  title: 'DailyKhata — the shop khata you can write like you talk',
  meta_desc: 'Type or say “gas 820, chai 40, Sharma se 3000 mila” and DailyKhata turns it into a clean daily account: sales, expenses, stock and udhaar. Works offline, reads Hindi and Hinglish, makes WhatsApp bills.',
  og_title: 'DailyKhata — write it like you talk, we keep the khata',
  og_desc: 'Sales, expenses, stock and udhaar for small shops. Works offline. Hindi and Hinglish.',
  brand_aria: 'DailyKhata home',
  nav_aria: 'Page',
  nav_day: 'One day',
  nav_faq: 'Questions',
  lang_aria: 'Language',
  signin: 'Sign in',
  h1a: 'Just write it down.',
  h1b: 'हिसाब हम कर लेंगे।',
  lead: 'Type what happened in your shop, or say it. DailyKhata sorts it, adds it up and keeps your khata. It works without internet.',
  note_label: 'Write what happened in your shop',
  note_ph: 'gas 820, chai 40\nSharma se 3000 mila',
  try_lead: 'Go on, write something. Or try',
  try_en: 'English',
  try_hi: 'हिंदी',
  try_mess: 'a messy one',
  cta_signin: 'Sign in to your shop',
  cta_setup: 'Get your shop set up',
  nav_setup: 'Get set up',
  wa_msg: 'Hi, I\'d like DailyKhata set up for my shop.',
  mic_start: 'Say it',
  mic_stop: 'Stop',
  mic_listening: 'Listening… go ahead and speak.',
  mic_priv: 'While the mic is on, your browser\'s speech service listens.',
  mic_denied: 'Mic permission was blocked. Allow it in your browser settings, or just type.',
  mic_offline: 'Speaking needs internet. Type it for now.',
  mic_none: 'Didn\'t hear anything. Tap and try again.',
  mic_fail: 'The mic didn\'t work. Type it instead.',
  mic_full: 'That is long enough. Stopped here.',
  tape_shop: 'YOUR SHOP',
  tape_in: 'In',
  tape_out: 'Out',
  tape_empty: 'Your lines will print here.',
  tape_none: 'Nothing yet',
  tape_one: '1 entry',
  tape_many: '{n} entries',
  tape_skipped: '{n} total skipped',
  tape_sale: 'Sale',
  tape_udhaar: 'udhaar',
  day_h2: 'One day, start to finish.',
  day_sub: 'Watch the strip. Every step adds a line.',
  day_name: 'SHARMA COLD DRINKS',
  day_tag: 'one day',
  day_drawer: 'In the drawer',
  m0_h: 'Count the drawer.',
  m0_p: 'Tap the notes. The total adds itself, and the day starts there.',
  m0_alt: 'Cash counter showing ₹3,303 counted from notes and coins',
  m1_h: 'Stock comes in.',
  m1_p: 'Say it, or take a photo of the bill. It\'s in the book before the delivery boy leaves.',
  m1_alt: 'Chat khata turning one message into six entries: cash, UPI, gas, Mehta udhaar, tea and Sting stock',
  m2_h: 'Little things add up.',
  m2_p: 'Gas, tea, auto. Just write them down, one line each or all together.',
  m2_alt: 'Today\'s khata with gas ₹820, tea ₹60 and 2 boxes of Sting ₹1,020',
  m3_h: '“Kal de dunga.”',
  m3_p: 'Make the bill, send it on WhatsApp. It waits on their name until they pay.',
  m3_alt: 'Bill #1 for Mehta, ₹230, ready to save and share',
  m4_h: 'Close the day.',
  m4_p: 'Count the drawer once more. If it\'s short, you\'ll know by how much.',
  m4_alt: 'Cash in drawer: ₹7,693 expected, ₹7,693 counted, difference ₹0',
  d_open: 'Opening cash',
  d_sting: 'Sting · 2 box',
  d_gas: 'Gas',
  d_tea: 'Tea',
  d_mehta: 'Mehta · udhaar',
  d_cash: 'Cash sales',
  d_upi: 'UPI sales',
  d_should: 'Should be in drawer',
  d_counted: 'You counted',
  d_match: 'Books match',
  words_becomes: 'becomes',
  words_h2: 'Write how you write.',
  words_sub: 'Hindi, English, or both in one line. 1,500 or 1.5k or 1500/- — all fine.',
  also: 'Also in there: a login for your helper that can\'t see your profit, more than one shop, Excel for your CA, a photo of a supplier\'s bill, and a backup every night.',
  faq_h2: 'Questions',
  q0: 'Do I have to type in English?',
  a0: 'No. Write the way you write in your register — “chai 40”, “bijli bill 1450”, “चाय ४०”, “Verma ne 500 diye”.',
  q1: 'What if the internet goes?',
  a1: 'Keep working. Everything is saved on your phone first and goes up by itself when the network is back.',
  q2: 'Can my helper see my profit?',
  a2: 'Only if you let them. Everyone gets their own login and you choose what they can see and do.',
  q3: 'Is it an app?',
  a3: 'It opens in your browser, on any phone or computer. Tap “Add to Home screen” and it sits there like an app, with your shop\'s logo.',
  q4: 'Who can see my numbers?',
  a4: 'Only the people you add to your shop. Each shop is kept separate, and a copy is saved every night.',
  fin_h1: 'दुकान बंद।',
  fin_h2: 'हिसाब पूरा।',
  fin_sub: 'Shop\'s shut. Books are done.',
  fin_signin: 'Sign in',
  fin_setup: 'Want your shop set up? Talk to Adil →',
  foot_made: 'Made by <a href="https://adilshaikh.in">Adil Shaikh</a>',
};

export const HI = {
  title: 'DailyKhata — बोलकर या लिखकर चलने वाला दुकान का खाता',
  meta_desc: '“gas 820, chai 40, Sharma se 3000 mila” जैसा लिखिए या बोलिए, DailyKhata उसे साफ़ रोज़ का हिसाब बना देता है: बिक्री, खर्चा, माल और उधार। बिना इंटरनेट चलता है, हिंदी और हिंग्लिश समझता है, WhatsApp बिल बनाता है।',
  og_title: 'DailyKhata — जैसे बोलते हैं वैसे लिखिए, खाता हम रखेंगे',
  og_desc: 'छोटी दुकानों के लिए बिक्री, खर्चा, माल और उधार का हिसाब। बिना इंटरनेट चलता है। हिंदी और हिंग्लिश।',
  brand_aria: 'DailyKhata होम',
  nav_aria: 'पेज',
  nav_day: 'एक दिन',
  nav_faq: 'सवाल',
  lang_aria: 'भाषा',
  signin: 'साइन इन',
  h1a: 'बस लिख दीजिए।',
  h1b: 'हिसाब हम कर लेंगे।',
  lead: 'दुकान में जो हुआ, लिख दीजिए या बोल दीजिए। DailyKhata उसे छाँटता है, जोड़ता है और आपका खाता रखता है। बिना इंटरनेट भी चलता है।',
  note_label: 'दुकान में जो हुआ, यहाँ लिखिए',
  note_ph: 'गैस 820, चाय 40\nशर्मा से 3000 मिला',
  try_lead: 'लिखकर देखिए। या ये आज़माइए:',
  try_en: 'English',
  try_hi: 'हिंदी',
  try_mess: 'उलझा हुआ नोट',
  cta_signin: 'अपनी दुकान में साइन इन करें',
  cta_setup: 'अपनी दुकान सेट करवाएँ',
  nav_setup: 'सेट करवाएँ',
  wa_msg: 'नमस्ते, मुझे अपनी दुकान के लिए DailyKhata सेट करवाना है।',
  mic_start: 'बोलकर लिखें',
  mic_stop: 'रोकें',
  mic_listening: 'सुन रहा हूँ… बोलिए।',
  mic_priv: 'माइक चालू रहने पर आपके ब्राउज़र की स्पीच सेवा सुनती है।',
  mic_denied: 'माइक की इजाज़त बंद है। ब्राउज़र सेटिंग में खोलें, या टाइप कर दें।',
  mic_offline: 'बोलने के लिए इंटरनेट चाहिए। अभी टाइप कर दीजिए।',
  mic_none: 'कुछ सुनाई नहीं दिया। फिर दबाकर बोलिए।',
  mic_fail: 'माइक नहीं चला। टाइप कर दीजिए।',
  mic_full: 'इतना काफ़ी है, यहीं रोक दिया।',
  tape_shop: 'आपकी दुकान',
  tape_in: 'आया',
  tape_out: 'गया',
  tape_empty: 'आपकी लाइनें यहाँ छपेंगी।',
  tape_none: 'अभी कुछ नहीं',
  tape_one: '1 एंट्री',
  tape_many: '{n} एंट्री',
  tape_skipped: '{n} टोटल छोड़े',
  tape_sale: 'बिक्री',
  tape_udhaar: 'उधार',
  day_h2: 'एक दिन, शुरू से आख़िर तक।',
  day_sub: 'पर्ची देखिए। हर कदम पर एक लाइन जुड़ती है।',
  day_name: 'शर्मा कोल्ड ड्रिंक्स',
  day_tag: 'एक दिन',
  day_drawer: 'गल्ले में',
  m0_h: 'गल्ला गिनिए।',
  m0_p: 'नोट टैप कीजिए। जोड़ अपने आप हो जाता है, और दिन वहीं से शुरू होता है।',
  m0_alt: 'नोट और सिक्कों से गिना ₹3,303 दिखाती नकद गिनती की स्क्रीन',
  m1_h: 'माल आया।',
  m1_p: 'बोल दीजिए, या बिल की फ़ोटो खींचिए। डिलीवरी वाले के जाने से पहले बही में चढ़ जाता है।',
  m1_alt: 'चैट खाता: एक संदेश से छह एंट्री, नकद, UPI, गैस, मेहता उधार, चाय और स्टिंग',
  m2_h: 'छोटे खर्चे जुड़ते जाते हैं।',
  m2_p: 'गैस, चाय, ऑटो। बस लिखते जाइए, एक-एक लाइन में या सब साथ में।',
  m2_alt: 'आज का खाता: गैस ₹820, चाय ₹60 और 2 पेटी स्टिंग ₹1,020',
  m3_h: '“कल दे दूँगा।”',
  m3_p: 'बिल बनाइए, WhatsApp पर भेज दीजिए। जब तक पैसे नहीं आते, वह उनके नाम पर लिखा रहता है।',
  m3_alt: 'मेहता का बिल #1, ₹230, सेव और शेयर के लिए तैयार',
  m4_h: 'दिन बंद कीजिए।',
  m4_p: 'गल्ला एक बार और गिनिए। कम हुआ तो पता चल जाएगा कितना।',
  m4_alt: 'गल्ले में नकद: ₹7,693 होना चाहिए, ₹7,693 गिना, फ़र्क ₹0',
  d_open: 'सुबह का नकद',
  d_sting: 'स्टिंग · 2 पेटी',
  d_gas: 'गैस',
  d_tea: 'चाय',
  d_mehta: 'मेहता · उधार',
  d_cash: 'नकद बिक्री',
  d_upi: 'UPI बिक्री',
  d_should: 'गल्ले में होना चाहिए',
  d_counted: 'आपने गिना',
  d_match: 'हिसाब मिल गया',
  words_becomes: 'बन जाता है',
  words_h2: 'जैसे लिखते हैं, वैसे लिखिए।',
  words_sub: 'हिंदी, English, या एक ही लाइन में दोनों। 1,500 या 1.5k या 1500/- — सब चलेगा।',
  also: 'इसमें और भी है: मुनीम के लिए ऐसा लॉगिन जिसमें मुनाफ़ा न दिखे, एक से ज़्यादा दुकानें, CA के लिए Excel, सप्लायर के बिल की फ़ोटो, और हर रात बैकअप।',
  faq_h2: 'सवाल',
  q0: 'क्या अंग्रेज़ी में ही लिखना पड़ेगा?',
  a0: 'नहीं। जैसे रजिस्टर में लिखते हैं वैसे लिखिए: “chai 40”, “bijli bill 1450”, “चाय ४०”, “Verma ne 500 diye”।',
  q1: 'इंटरनेट चला जाए तो?',
  a1: 'काम चलता रहेगा। सब कुछ पहले आपके फ़ोन में सेव होता है, और नेटवर्क आते ही अपने आप ऊपर चला जाता है।',
  q2: 'क्या मेरा हेल्पर मेरा मुनाफ़ा देख सकता है?',
  a2: 'तभी, जब आप चाहें। हर किसी का अपना लॉगिन होता है और वह क्या देखे, क्या करे, यह आप तय करते हैं।',
  q3: 'क्या यह ऐप है?',
  a3: 'यह किसी भी फ़ोन या कंप्यूटर के ब्राउज़र में खुलता है। “Add to Home screen” दबाइए, तो यह ऐप की तरह आपकी दुकान के लोगो के साथ होम स्क्रीन पर रहता है।',
  q4: 'मेरे आँकड़े कौन देख सकता है?',
  a4: 'सिर्फ़ वही लोग जिन्हें आप अपनी दुकान में जोड़ें। हर दुकान अलग रखी जाती है, और हर रात उसकी एक कॉपी सेव होती है।',
  fin_h1: 'दुकान बंद।',
  fin_h2: 'हिसाब पूरा।',
  fin_sub: 'ताला लगाइए, चैन से घर जाइए।',
  fin_signin: 'साइन इन',
  fin_setup: 'अपनी दुकान सेट करवानी है? आदिल से बात कीजिए →',
  foot_made: '<a href="https://adilshaikh.in">आदिल शेख़</a> ने बनाया',
};

export const DICT = { en: EN, hi: HI };
const ok = (l) => (l === 'en' || l === 'hi' ? l : null);

export function getLang() {
  // the /hi/ page is the Hindi page: opening it always starts in Hindi (the switch still works after that)
  if (typeof location !== 'undefined' && /^\/hi(\/|$)/.test(location.pathname)) return 'hi';
  let saved = null;
  try { saved = ok(localStorage.getItem('dk_lang')); } catch { /* storage blocked */ }
  if (saved) return saved;
  const nav = (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages || [])[0])) || '';
  return /^hi/i.test(nav) ? 'hi' : 'en';
}

let current = null;
export const lang = () => current || getLang();
export const t = (key, vars) => {
  let s = (DICT[lang()] || EN)[key];
  if (s == null) s = EN[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : s;
};

// Paints every marked element in `l`, flips <html lang>, reveals the page, and tells the live parts (strip, demo) to repaint.
export function applyLang(l = getLang(), root = document) {
  current = ok(l) || 'en';
  const d = document.documentElement;
  d.lang = current;
  const text = (sel, attr, set) => root.querySelectorAll(sel).forEach((el) => set(el, el.getAttribute(attr)));
  text('[data-i18n]', 'data-i18n', (el, k) => { el.textContent = t(k); });
  text('[data-i18n-html]', 'data-i18n-html', (el, k) => { el.innerHTML = t(k); });
  text('[data-i18n-placeholder]', 'data-i18n-placeholder', (el, k) => { el.placeholder = t(k); });
  text('[data-i18n-alt]', 'data-i18n-alt', (el, k) => { el.alt = t(k); });
  text('[data-i18n-aria]', 'data-i18n-aria', (el, k) => { el.setAttribute('aria-label', t(k)); });
  text('[data-i18n-content]', 'data-i18n-content', (el, k) => { el.setAttribute('content', t(k)); });
  if (!d.classList.contains('app-mode')) document.title = t('title');
  document.querySelectorAll('.lp-lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === current)));
  d.classList.remove('lang-pending');
  window.dispatchEvent(new CustomEvent('dk:lang', { detail: current }));
}

export function setLang(l) {
  const v = ok(l); if (!v) return;
  try { localStorage.setItem('dk_lang', v); } catch { /* storage blocked: still switches for this visit */ }
  applyLang(v);
}

// Wires the EN | हिं switch (buttons with data-lang) and paints once.
export function initLangSwitch() {
  document.querySelectorAll('.lp-lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
  applyLang(getLang());
}
