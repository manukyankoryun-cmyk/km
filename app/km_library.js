'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_library.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_library.jsc');
} else {
  throw new Error('Missing km_library.jsc (bytenode). Restore plaintext km_library.js from installer/project, or recompile bytecode.');
}
