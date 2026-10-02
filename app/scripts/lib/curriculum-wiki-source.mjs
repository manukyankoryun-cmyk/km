/**
 * Open-data fetcher: Armenian/English Wikipedia summaries → Q&A pairs.
 * Uses Wikipedia REST API (no API key). Caches to bulk-import/.wiki-cache/
 * Locked to 25 curriculum domains (same order as CURRICULUM_25_DAYS).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '../..');

const WIKI_QUERIES = {
  1: ['մաթեմատիկա', 'algebra', 'geometry'],
  2: ['ֆիզիկա', 'mechanics', 'Newton laws'],
  3: ['քվանտային մեխանիկա', 'quantum mechanics'],
  4: ['քիմիա', 'chemical bond', 'periodic table'],
  5: ['կենսաբանություն', 'DNA', 'cell biology'],
  6: ['աստղագիտություն', 'Solar System', 'galaxy'],
  7: ['հոգեբանություն', 'psychology', 'memory'],
  8: ['կիրառական մաթեմատիկա', 'mathematical modeling'],
  9: ['վիճակագրություն', 'statistics', 'probability'],
  10: ['համակարգչային գիտություն', 'algorithm', 'computer science'],
  11: ['ինժեներական', 'engineering', 'materials science'],
  12: ['դեղագիտություն', 'pharmacology', 'medicine'],
  13: ['բիզնես', 'management', 'marketing'],
  14: ['իրավագիտություն', 'law', 'contract'],
  15: ['մանկավարժություն', 'pedagogy', 'education'],
  16: ['ռազմական հոգեբանություն', 'military psychology', 'PTSD'],
  17: ['զինվորական', 'military service', 'infantry'],
  18: ['զինված ուժեր', 'military organization', 'chain of command'],
  19: ['զինվորական կանոններ', 'military discipline', 'topography'],
  20: ['հայ գրականություն', 'Armenian literature', 'Sayat-Nova'],
  21: ['Հայոց պատմություն', 'History of Armenia', 'Urartu'],
  22: ['աշխարհագրություն', 'geography', 'Armenia'],
  23: ['հայերեն', 'Armenian language', 'grammar'],
  24: ['ռազմագիտություն', 'military strategy', 'tactics', 'defense'],
  25: ['տրամաբանություն', 'logic', 'deduction']
};

function cacheDir(outDir) {
  return path.join(outDir || path.join(APP_DIR, 'data', 'bulk-import'), '.wiki-cache');
}

async function fetchJson(url, retries) {
  retries = retries || 3;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'KM-BotKnowledge/1.0 (educational; offline corpus builder)' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

async function wikiSummary(title, lang) {
  lang = lang || 'hy';
  const enc = encodeURIComponent(title.replace(/ /g, '_'));
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${enc}`;
  return fetchJson(url);
}

function summaryToQa(day, domain, title, extract, lang) {
  const text = String(extract || '').replace(/\s+/g, ' ').trim();
  if (text.length < 80) return null;
  const q =
    lang === 'hy'
      ? `Ինչ է «${title}»-ը ${domain} դասի համատեքստ տեսանկյունից`
      : `Ինչ է «${title}»-ը (${domain}) — ${lang}.wiki.open`;
  const a =
    `«${title}»-ի մասին (բաց աղբյուր՝ ${lang}.wikipedia.org).\n` +
    text.slice(0, 900) +
    (text.length > 900 ? '…' : '');
  return {
    day,
    domain,
    q,
    a,
    source: 'wiki-' + lang,
    tags: ['curriculum25', 'day-' + day, 'wiki', lang]
  };
}

export async function fetchWikiBatch(day, domain, limit, outDir) {
  limit = Math.min(200, Math.max(1, limit || 30));
  const queries = WIKI_QUERIES[day] || [domain];
  const cd = cacheDir(outDir);
  fs.mkdirSync(cd, { recursive: true });
  const out = [];
  const seen = new Set();

  for (let qi = 0; qi < queries.length && out.length < limit; qi++) {
    const qterm = queries[qi];
    for (const lang of ['hy', 'en']) {
      const cacheFile = path.join(cd, `day${day}-${lang}-${qterm.replace(/[^\w\u0531-\u0587-]+/gi, '_')}.json`);
      let summary;
      try {
        if (fs.existsSync(cacheFile)) {
          summary = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        } else {
          summary = await wikiSummary(qterm, lang);
          fs.writeFileSync(cacheFile, JSON.stringify(summary), 'utf8');
          await new Promise((r) => setTimeout(r, 350));
        }
      } catch (_) {
        continue;
      }
      if (!summary || !summary.extract) continue;
      const title = summary.title || qterm;
      const key = title + '|' + lang;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = summaryToQa(day, domain, title, summary.extract, lang);
      if (row && row.a.length >= 80) out.push(row);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export { WIKI_QUERIES };
