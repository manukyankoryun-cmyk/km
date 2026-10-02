'use strict';
const fs = require('fs');
const path = require('path');
const jsc = path.join(__dirname, 'km_domain_router.jsc');
if (fs.existsSync(jsc)) {
  require('bytenode');
  module.exports = require('./km_domain_router.jsc');
} else {
  throw new Error('Missing km_domain_router.jsc (bytenode). Restore plaintext km_domain_router.js from installer/project, or recompile bytecode.');
}
