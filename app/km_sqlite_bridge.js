'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_sqlite_bridge.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_sqlite_bridge.jsc');
} else {
  throw new Error('Missing km_sqlite_bridge.jsc (bytenode). Restore plaintext km_sqlite_bridge.js from installer/project, or recompile bytecode.');
}
