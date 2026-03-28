/**
 * Load backend/.env and verify SMTP login (does not send an email).
 * Usage: cd backend && npm run test:smtp
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Reload env module after dotenv
delete require.cache[require.resolve('../src/config/env')];
const { verifySmtpConnection } = require('../src/services/otpEmail');

async function main() {
  try {
    await verifySmtpConnection();
    console.log('SMTP OK: credentials accepted by the mail server.');
    process.exit(0);
  } catch (err) {
    console.error('SMTP verify failed:', err.message || err);
    if (/Invalid login|535|534|authentication failed/i.test(String(err.message))) {
      console.error(
        '\nFor Gmail / Google Workspace: create an App Password at https://myaccount.google.com/apppasswords\n' +
          'and put it in SMTP_PASS (not your normal account password).'
      );
    }
    process.exit(1);
  }
}

main();
