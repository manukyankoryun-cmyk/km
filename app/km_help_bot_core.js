'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_help_bot_core.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_help_bot_core.jsc');
} else {
  throw new Error('Missing km_help_bot_core.jsc (bytenode). Restore plaintext km_help_bot_core.js from installer/project, or recompile bytecode.');
}
