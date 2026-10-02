/* Generate DOCX+PDF guide files for soldier rights sections */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'app', 'data', 'km_soldier_rights.json');
const outRoot = path.join(root, 'app', 'data', 'soldier_rights_docs');
const fontPath = 'C:\\Windows\\Fonts\\segoeui.ttf';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6); // UTF-8
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    parts.push(local, data);
    const cen = Buffer.alloc(46 + name.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x800, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    name.copy(cen, 46);
    central.push(cen);
    offset += local.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat(parts.concat([centralBuf, end]));
}

function xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDocx(sec) {
  const paras = [];
  paras.push(`<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${xmlEsc(sec.title)}</w:t></w:r></w:p>`);
  if (sec.group) paras.push(`<w:p><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>${xmlEsc(sec.group)}</w:t></w:r></w:p>`);
  if (sec.summary) paras.push(`<w:p><w:r><w:t>${xmlEsc(sec.summary)}</w:t></w:r></w:p>`);
  (sec.body || []).forEach((line) => {
    paras.push(`<w:p><w:r><w:t>${xmlEsc(line)}</w:t></w:r></w:p>`);
  });
  if (sec.template) {
    paras.push(`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Օրինակելի ձև</w:t></w:r></w:p>`);
    String(sec.template).split('\n').forEach((line) => {
      paras.push(`<w:p><w:r><w:t>${xmlEsc(line)}</w:t></w:r></w:p>`);
    });
  }
  if (sec.hotlines && sec.hotlines.length) {
    paras.push(`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Թեժ գծեր</w:t></w:r></w:p>`);
    sec.hotlines.forEach((h) => {
      paras.push(`<w:p><w:r><w:t>${xmlEsc(h.name + ' — ' + h.phone + (h.note ? ' (' + h.note + ')' : ''))}</w:t></w:r></w:p>`);
    });
  }
  paras.push(`<w:p><w:r><w:t>${xmlEsc('KM ուղեցույց · Զինծառայողի իրավունքներ։ Ստուգեք գործող օրենքը և ՊՆ հրամանները։')}</w:t></w:r></w:p>`);

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paras.join('')}<w:sectPr/></w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const docRels =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: docRels }
  ]);
}

function buildRtf(sec) {
  function rtfUni(s) {
    let out = '';
    for (const ch of String(s || '')) {
      const code = ch.codePointAt(0);
      if (code < 128 && ch !== '\\' && ch !== '{' && ch !== '}') out += ch;
      else if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch;
      else out += '\\u' + (code > 32767 ? code - 65536 : code) + '?';
    }
    return out;
  }
  const lines = [sec.title, sec.group || '', sec.summary || ''].concat(sec.body || []);
  if (sec.template) lines.push('Օրինակելի ձև', sec.template);
  const body = lines.filter(Boolean).map((l) => rtfUni(l) + '\\par\n').join('');
  return Buffer.from('{\\rtf1\\ansi\\deff0\\uc1{\\fonttbl{\\f0 Segoe UI;}}\\f0\\fs22\n' + body + '}', 'ascii');
}

async function buildPdf(sec) {
  let PDFDocument;
  try {
    PDFDocument = require(path.join(__dirname, 'node_modules', 'pdfkit'));
  } catch (e) {
    try { PDFDocument = require('pdfkit'); } catch (e2) {
      console.error('pdfkit missing — run: npm install pdfkit --prefix tools');
      throw e2;
    }
  }
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: sec.title || 'KM', Author: 'KM' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    if (fs.existsSync(fontPath)) doc.font(fontPath);
    else doc.font('Helvetica');
    doc.fontSize(16).text(sec.title || '', { paragraphGap: 8 });
    if (sec.group) doc.fontSize(11).fillColor('#555').text(sec.group, { paragraphGap: 6 });
    doc.fillColor('#111');
    if (sec.summary) doc.fontSize(11).text(sec.summary, { paragraphGap: 10 });
    doc.fontSize(11);
    (sec.body || []).forEach((line) => {
      doc.text('• ' + line, { paragraphGap: 8, align: 'left' });
    });
    if (sec.template) {
      doc.moveDown().fontSize(12).text('Օրինակելի ձև', { paragraphGap: 6 });
      doc.fontSize(10).text(sec.template, { paragraphGap: 6 });
    }
    if (sec.hotlines && sec.hotlines.length) {
      doc.moveDown().fontSize(12).text('Թեժ գծեր', { paragraphGap: 6 });
      sec.hotlines.forEach((h) => {
        doc.fontSize(11).text(`${h.name}: ${h.phone}${h.note ? ' — ' + h.note : ''}`, { paragraphGap: 4 });
      });
    }
    doc.moveDown().fontSize(9).fillColor('#666')
      .text('KM ուղեցույց · Զինծառայողի իրավունքներ։ Ստուգեք գործող օրենքը և ՊՆ հրամանները։');
    doc.end();
  });
}

function safeFile(name) {
  return String(name || 'guide')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'guide';
}

async function main() {
  const raw = fs.readFileSync(jsonPath, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  fs.mkdirSync(outRoot, { recursive: true });
  for (const sec of data.sections || []) {
    const dir = path.join(outRoot, sec.id);
    fs.mkdirSync(dir, { recursive: true });
    const base = safeFile(sec.title || sec.id) + ' — ուղեցույց';
    const docx = buildDocx(sec);
    fs.writeFileSync(path.join(dir, base + '.docx'), docx);
    fs.writeFileSync(path.join(dir, base + '.rtf'), buildRtf(sec));
    const pdf = await buildPdf(sec);
    fs.writeFileSync(path.join(dir, base + '.pdf'), pdf);
    console.log('ok', sec.id);
  }
  // hub index
  const hubDir = path.join(outRoot, 'soldier_rights');
  fs.mkdirSync(hubDir, { recursive: true });
  const hubSec = {
    title: data.title || 'Զինծառայողի իրավունքները',
    group: '',
    summary: data.lead || '',
    body: (data.sections || []).map((s) => s.title)
  };
  fs.writeFileSync(path.join(hubDir, 'Զինծառայողի իրավունքները — ցանկ.docx'), buildDocx(hubSec));
  fs.writeFileSync(path.join(hubDir, 'Զինծառայողի իրավունքները — ցանկ.pdf'), await buildPdf(hubSec));
  console.log('done', outRoot);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
