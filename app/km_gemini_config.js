'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_gemini_config.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_gemini_config.jsc');
} else {
  throw new Error('Missing km_gemini_config.jsc (bytenode). Restore plaintext km_gemini_config.js from installer/project, or recompile bytecode.');
}
