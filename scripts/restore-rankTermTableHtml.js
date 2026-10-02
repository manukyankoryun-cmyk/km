'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const live = process.argv[3];
const file = path.join(proj, 'app/js/km-unit-tools.js');
let t = fs.readFileSync(file, 'utf8');
if (/function\s+rankTermTableHtml\s*\(/.test(t)) {
  console.log('already exists');
  process.exit(0);
}
const fn = [
  'function rankTermTableHtml() {',
  '    /* KM_RESTORE_RANK_TERM_TABLE_HTML_V1 */',
  '    var groups = [',
  "      { title: 'Զինվորական', ranks: ['շ-ն', 'կրտ․ս-տ', 'ս-տ', 'ավ․ս-տ', 'ավագ'] },",
  "      { title: 'Ենթասպայական', ranks: ['ենթասպա', 'ավագ ենթասպա'] },",
  "      { title: 'Սպայական', ranks: ['լ-տ', 'ավ․լ-տ', 'կ-ն', 'մ-ր', 'փ/գ-տ', 'գ-տ'] }",
  '    ];',
  '    function yearsLabel(r) {',
  "      var y = (typeof rankTermYears === 'function') ? rankTermYears(r) : null;",
  "      if (y == null) return '—';",
  "      if (y === 0) return 'ժամկետ չկա';",
  "      return y + ' տարի';",
  '    }',
  '    function pretty(r) {',
  '      var map = {',
  "        'շ-ն': 'շարքային', 'կրտ․ս-տ': 'կրտսեր սերժանտ', 'ս-տ': 'սերժանտ', 'ավ․ս-տ': 'ավագ սերժանտ',",
  "        'ավագ': 'ավագ', 'ենթասպա': 'ենթասպա', 'ավագ ենթասպա': 'ավագ ենթասպա',",
  "        'լ-տ': 'լեյտենանտ', 'ավ․լ-տ': 'ավագ լեյտենանտ', 'կ-ն': 'կապիտան', 'մ-ր': 'մայոր',",
  "        'փ/գ-տ': 'փոխգնդապետ', 'գ-տ': 'գնդապետ'",
  '      };',
  '      return map[r] || r;',
  '    }',
  '    var body = groups.map(function (g) {',
  '      var rows = (g.ranks || []).map(function (r) {',
  "        return '<tr><td>' + pretty(r) + '</td><td>' + yearsLabel(r) + '</td></tr>';",
  '      }).join(\'\');',
  "      return '<tr><td colspan=\"2\"><b>' + g.title + '</b></td></tr>' + rows;",
  '    }).join(\'\');',
  "    return '<details class=\"kmUtDetails\" style=\"margin:10px 0\" open>' +",
  "      '<summary>Կոչումների կարգ և կրման ժամկետներ (Հոդված 10)</summary>' +",
  "      '<p class=\"kmUtMuted\" style=\"margin:6px 0 8px\">Հերթական կոչումը՝ նախորդը կրելու ժամկետը լրանալուց հետո (Հոդված 15)։ Ստուգեք գործող օրենքի խմբագրությունը։</p>' +",
  "      '<div class=\"gridwrap\"><table class=\"kmUtTable\"><thead><tr><th>Կոչում</th><th>Կրման ժամկետ</th></tr></thead><tbody>' +",
  "      body + '</tbody></table></div></details>';",
  '  }',
  ''
].join('\n');
const anchor = t.indexOf('function renderTerms');
if (anchor < 0) throw new Error('renderTerms missing');
t = t.slice(0, anchor) + fn + '\n  ' + t.slice(anchor);
fs.writeFileSync(file, t);
fs.copyFileSync(file, path.join(live, 'js/km-unit-tools.js'));
console.log('restored', /function\s+rankTermTableHtml\s*\(/.test(t));
try { new Function(t); console.log('syntax OK'); } catch (e) { console.log('SYNTAX', e.message); process.exit(1); }
