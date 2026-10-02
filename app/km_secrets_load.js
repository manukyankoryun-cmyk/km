'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_secrets_load.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_secrets_load.jsc');
} else {
  throw new Error('Missing km_secrets_load.jsc (bytenode). Restore plaintext km_secrets_load.js from installer/project, or recompile bytecode.');
}
