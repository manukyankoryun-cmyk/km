'use strict';
/** KM_READ_VERSION_UPDATE_FIX_V1: honor json.update; strip UTF-8 BOM (BOM broke JSON.parse -> always v1.0.0.) */
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_version.jsc');
if (!fs.existsSync(jsc)) {
  throw new Error('Missing km_version.jsc (bytenode).');
}
require('bytenode');
const impl = require('./km_version.jsc');

function readKmVersion(appDir) {
  const dir = appDir && typeof appDir === 'string' ? appDir : __dirname;
  const p = path.join(dir, 'km_version.json');
  try {
    let raw = fs.readFileSync(p, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const j = JSON.parse(raw);
    const version = String((j && j.version) || 'v1.0.0.');
    const update = String((j && j.update) || version || 'v1.0.0.');
    return { version: version, update: update };
  } catch (e) {
    return { version: 'v1.0.0.', update: 'v1.0.0.' };
  }
}

module.exports = Object.assign({}, impl, {
  readKmVersion: readKmVersion
});