'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'office_backend.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./office_backend.jsc');
} else {
  throw new Error('Missing office_backend.jsc (bytenode). Restore plaintext office_backend.js from installer/project, or recompile bytecode.');
}
