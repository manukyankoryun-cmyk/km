'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_retention.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_retention.jsc');
} else {
  throw new Error('Missing km_retention.jsc (bytenode). Restore plaintext km_retention.js from installer/project, or recompile bytecode.');
}
