'use strict';
/* RUN-020. Owner-operated ONE-TIME TEST-only Firebase Admin claim change.
   Defaults to DRY RUN. Never runs automatically in GitHub Actions.
   Do not use service-account JSON or put credentials in GitHub. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const PROJECT_ID = 'sanastoyhteiso-v3-development';
function validateAccount(user) {
  if (!user || typeof user.uid !== 'string' || !user.uid) return 'No target user';
  if (user.disabled) return 'Account is disabled';
  if (user.emailVerified !== true) return 'Email is not verified';
  if (typeof user.email !== 'string' || !user.email) return 'Missing account email';
  if (!Array.isArray(user.providerData) || !user.providerData.some(p => p && p.providerId === 'google.com'))
    return 'No linked Google provider';
  return null;
}
function mergeClaims(existing) {
  const original = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  return Object.assign({}, original, {admin: true});
}
function runMode(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--dry-run')) return 'dry-run';
  if (args.length === 1 && args[0] === '--apply') return 'apply';
  throw Error('Use: node assign-test-admin.cjs [--dry-run|--apply]');
}
function makeBackup(uid, oldClaims) {
  const digest = crypto.createHash('sha256').update(uid).digest('hex').slice(0, 16);
  const file = path.join(os.homedir(), '.sanastoyhteiso-test-admin-before-' + digest + '-' + Date.now() + '.json');
  const payload = JSON.stringify({projectId: PROJECT_ID, uid, customClaims: oldClaims, savedAt: new Date().toISOString()}, null, 2) + '\n';
  fs.writeFileSync(file, payload, {encoding:'utf8',flag:'wx',mode:0o600});
  return file;
}
async function main() {
  const mode = runMode(process.argv.slice(2));
  if (!process.stdin.isTTY) throw Error('Interactive local Cloud Shell required; no CI execution');
  for (const key of ['GOOGLE_CLOUD_PROJECT','GCLOUD_PROJECT','CLOUDSDK_CORE_PROJECT']) {
    if (process.env[key] && process.env[key] !== PROJECT_ID) throw Error('Unexpected project environment: ' + key);
  }
  console.log('TARGET TEST PROJECT: ' + PROJECT_ID);
  console.log('Mode: ' + mode + '. No production, no Firestore changes.');
  const rl = readline.createInterface({input:process.stdin,output:process.stdout});
  function ask(q){return new Promise(resolve => rl.question(q, resolve));}
  try {
    const uid = (await ask('Paste YOUR OWN TEST UID from Firebase Authentication -> Users (local terminal only): ')).trim();
    if (!uid || uid.length > 128 || /\s/.test(uid)) throw Error('Invalid UID; no changes');
    const {initializeApp,applicationDefault} = require('firebase-admin/app');
    const {getAuth} = require('firebase-admin/auth');
    const app = initializeApp({credential:applicationDefault(),projectId:PROJECT_ID});
    const auth = getAuth(app);
    const user = await auth.getUser(uid);
    const problem = validateAccount(user);
    if (problem) throw Error(problem + '; no changes');
    console.log('Project: ' + PROJECT_ID + ', account email: ' + user.email + ', Google provider verified locally.');
    const originalClaims = Object.assign({}, user.customClaims || {});
    const oldValue = originalClaims.admin;
    console.log('Current admin claim is ' + (oldValue === true ? 'true' : 'not true') + '. Other claims are preserved.');
    if (mode === 'dry-run') {
      console.log('DRY RUN COMPLETE: no changes. Repeat with --apply only after confirming the correct TEST account.');
      return;
    }
    if (oldValue === true) {
      console.log('No change required: this TEST account already has admin=true.');
      return;
    }
    const email = (await ask('Retype the EXACT account email shown above to confirm UID: ')).trim();
    if (email !== user.email) throw Error('Account email did not match; no changes');
    const confirmation = (await ask('Type exactly GRANT TEST ADMIN to approve one account change: ')).trim();
    if (confirmation !== 'GRANT TEST ADMIN') throw Error('Confirmation declined; no changes');
    const backup = makeBackup(uid, originalClaims);
    console.log('Prior claims backed up LOCALLY (0600) to ' + backup);
    await auth.setCustomUserClaims(uid, mergeClaims(originalClaims));
    const latest = await auth.getUser(uid);
    if (!latest.customClaims || latest.customClaims.admin !== true) throw Error('Post-write verification failed: investigate before retrying');
    for (const [k,v] of Object.entries(originalClaims)) {
      if (k !== 'admin' && JSON.stringify(latest.customClaims[k]) !== JSON.stringify(v))
        throw Error('Unexpected change to other claims: manual review required');
    }
    console.log('SUCCESS: admin=true assigned to exactly this TEST UID. Sign out/in or refresh ID token.');
    console.log('Do not paste UID, claims backup or tokens into chat or a public GitHub issue.');
  } finally {rl.close();}
}
if (require.main === module) main().catch(err => {console.error('STOP:',err.message);process.exitCode=1;});
module.exports={PROJECT_ID,validateAccount,mergeClaims,runMode};
