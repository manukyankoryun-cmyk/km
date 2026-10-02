'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_backend.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_backend.jsc');
} else {
  throw new Error('Missing km_backend.jsc (bytenode). Restore plaintext km_backend.js from installer/project, or recompile bytecode.');
}
