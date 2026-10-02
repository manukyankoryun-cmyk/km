'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_net.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_net.jsc');
} else {
  throw new Error('Missing km_net.jsc (bytenode). Restore plaintext km_net.js from installer/project, or recompile bytecode.');
}
