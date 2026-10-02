'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_edge_tts.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_edge_tts.jsc');
} else {
  throw new Error('Missing km_edge_tts.jsc (bytenode). Restore plaintext km_edge_tts.js from installer/project, or recompile bytecode.');
}
