#!/usr/bin/env python3
"""Builds the small Devanagari subsets the landing page uses (public/fonts/lp-*.woff2).
The full Palanquin/Eczar Devanagari faces are 45-130 KB each; the landing only shows a few hundred glyphs.
Anything outside the subset (e.g. what a visitor types into the demo) falls back to the full faces.
Needs: pip install fonttools brotli.  Run from the repo root after changing landing Hindi text."""
import re, subprocess
files = ['public/index.html', 'public/js/landing-i18n.js', 'public/js/landing.js']
chars = set()
for f in files:
    chars |= set(re.findall(r'[ऀ-ॿ]', open(f, encoding='utf8').read()))
chars |= set('।॥‌‍') | {'₹'} | {chr(c) for c in range(0x966, 0x970)}
uni = ','.join('U+%04X' % ord(c) for c in sorted(chars))
for fam, w, out in [('palanquin', 400, 'lp-palanquin-deva-400'), ('palanquin', 700, 'lp-palanquin-deva-700'),
                    ('eczar', 400, 'lp-eczar-deva-400'), ('eczar', 700, 'lp-eczar-deva-700')]:
    subprocess.check_call(['pyftsubset', f'public/fonts/{fam}-deva-{w}.woff2', f'--unicodes={uni}', '--flavor=woff2',
                           '--layout-features=akhn,rphf,pref,blwf,half,pstf,vatu,cjct,nukt,locl,abvs,blws,psts,haln,ccmp,calt,liga,mark,mkmk,dist,abvm,blwm,kern', '--no-hinting', '--name-IDs=1,2', '--drop-tables+=DSIG', f'--output-file=public/fonts/{out}.woff2'])
print(len(chars), 'glyphs')
