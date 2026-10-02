'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_guard.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_guard.jsc');
} else {
  throw new Error('Missing km_guard.jsc (bytenode). Restore plaintext km_guard.js from installer/project, or recompile bytecode.');
}
