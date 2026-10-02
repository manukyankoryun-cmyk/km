'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_pdf_text.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_pdf_text.jsc');
} else {
  throw new Error('Missing km_pdf_text.jsc (bytenode). Restore plaintext km_pdf_text.js from installer/project, or recompile bytecode.');
}
