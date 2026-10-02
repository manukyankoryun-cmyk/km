'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_crypto_store.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_crypto_store.jsc');
} else {
  throw new Error('Missing km_crypto_store.jsc (bytenode). Restore plaintext km_crypto_store.js from installer/project, or recompile bytecode.');
}
