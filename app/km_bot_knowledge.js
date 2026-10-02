'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_bot_knowledge.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_bot_knowledge.jsc');
} else {
  throw new Error('Missing km_bot_knowledge.jsc (bytenode). Restore plaintext km_bot_knowledge.js from installer/project, or recompile bytecode.');
}
