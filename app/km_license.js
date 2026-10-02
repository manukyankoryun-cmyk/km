'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_license.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_license.jsc');
} else {
  throw new Error('Missing km_license.jsc (bytenode). Restore plaintext km_license.js from installer/project, or recompile bytecode.');
}
