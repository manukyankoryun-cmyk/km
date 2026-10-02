'use strict';
const fs = require('fs');
const path = require('path');
const { loadKmSecrets } = require('../app/km_secrets_load.js');
const kmLicense = require('../app/km_license.js');

const TEST_ADMIN = { username: 'TestAdm1', password: 'KmTest#Admin99' };

function stageLicenseCode(userRoot, code) {
  loadKmSecrets({ userRoot });
  const ticket = kmLicense.issueTicket(code, userRoot);
  if (!ticket) throw new Error('license ticket empty for ' + code);
  fs.writeFileSync(
    path.join(userRoot, 'km_pending_activation.json'),
    JSON.stringify({ code, ticket, stagedAt: new Date().toISOString() })
  );
  return ticket;
}

async function installTestAdmin(backend) {
  await backend.ensureDefaultSecurity();
  await backend.setSecurity({
    username: TEST_ADMIN.username,
    password: TEST_ADMIN.password,
    role: 'admin'
  });
}

module.exports = { TEST_ADMIN, stageLicenseCode, installTestAdmin };
