// Copies every Firestore document (and every subcollection, at any depth) from one
// Firebase project to another. Used once, to move the app to a new project ID.
//
//   gcloud auth application-default login      # an account that can open both projects
//   node scripts/copy-firestore.mjs <from-project-id> <to-project-id>           # dry run: counts only
//   node scripts/copy-firestore.mjs <from-project-id> <to-project-id> --write   # really copies
//
// Documents keep their IDs, paths and field values (timestamps included). Existing documents
// in the target are overwritten. Push tokens (users/{uid}/pushTokens) are skipped: they belong
// to the old project's Cloud Messaging and do not work in a new one.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const [from, to, flag] = process.argv.slice(2);
if (!from || !to || from === to) {
  console.error('Usage: node scripts/copy-firestore.mjs <from-project-id> <to-project-id> [--write]');
  process.exit(1);
}
const write = flag === '--write';
const SKIP = new Set(['pushTokens']);

// With the emulator running, FIRESTORE_EMULATOR_HOST is set and no credentials are needed.
const cred = process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() };
const src = getFirestore(initializeApp({ ...cred, projectId: from }, 'from'));
const dst = getFirestore(initializeApp({ ...cred, projectId: to }, 'to'));
const writer = dst.bulkWriter();
writer.onWriteError(err => {
  if (err.failedAttempts < 5) return true;
  console.error('Could not write', err.documentRef.path, err.message);
  failed++;
  return false;
});

let docs = 0, failed = 0;
const perRoot = {};

async function copyCollection(col, root) {
  // listDocuments also returns "empty" parents that only hold subcollections
  // (e.g. invites/{email} only has invites/{email}/from/...), so nothing below them is missed.
  for (const ref of await col.listDocuments()) {
    const snap = await ref.get();
    if (snap.exists) {
      docs++; perRoot[root] = (perRoot[root] || 0) + 1;
      if (write) writer.set(dst.doc(ref.path), snap.data());
    }
    for (const sub of await ref.listCollections()) {
      if (!SKIP.has(sub.id)) await copyCollection(sub, root);
    }
  }
}

for (const col of await src.listCollections()) await copyCollection(col, col.id);
await writer.close();

console.log(`${write ? 'Copied' : 'Would copy'} ${docs - failed} documents from ${from} to ${to}${failed ? ` (${failed} failed)` : ''}:`);
for (const [root, n] of Object.entries(perRoot)) console.log(`  ${root}: ${n}`);
if (!write) console.log('Dry run only. Add --write to copy.');
process.exit(failed ? 1 : 0);
