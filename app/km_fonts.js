'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_fonts.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_fonts.jsc');
} else {
  throw new Error('Missing km_fonts.jsc (bytenode). Restore plaintext km_fonts.js from installer/project, or recompile bytecode.');
}
