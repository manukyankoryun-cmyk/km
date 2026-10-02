'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_conversations.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_conversations.jsc');
} else {
  throw new Error('Missing km_conversations.jsc (bytenode). Restore plaintext km_conversations.js from installer/project, or recompile bytecode.');
}
