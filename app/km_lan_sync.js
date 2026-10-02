'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_lan_sync.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_lan_sync.jsc');
} else {
  throw new Error('Missing km_lan_sync.jsc (bytenode). Restore plaintext km_lan_sync.js from installer/project, or recompile bytecode.');
}
