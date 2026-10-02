'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_text_clean.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_text_clean.jsc');
} else {
  throw new Error('Missing km_text_clean.jsc (bytenode). Restore plaintext km_text_clean.js from installer/project, or recompile bytecode.');
}
