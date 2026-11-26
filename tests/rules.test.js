// Tests for firestore.rules (who can read and change which list).
// Runs against the Firestore emulator: npm run test:rules  (needs Java)
import { test, describe, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let env;
// owner shares: list "trip" with Mum (edit) and Dad (view); the main list with Mum only (view)
const ACCESS = { mum:{ trip:'edit', main:'view' }, dad:{ trip:'view' } };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lists',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/owner'), { name:'Owner', members:{ mum:'Mum', dad:'Dad' }, access:ACCESS });
    await setDoc(doc(db, 'users/mum/sharedWithMe/owner'), { name:'Owner', lists:{ trip:'edit', main:'view' } });
    await setDoc(doc(db, 'emails/owner@example.com'), { uid:'owner', name:'Owner' });
    await setDoc(doc(db, 'ulists/owner/lists/trip'), { name:'Trip', type:'packing' });
    await setDoc(doc(db, 'ulists/owner/lists/secret'), { name:'Secret' });
    await setDoc(doc(db, 'ulists/owner/lists/trip/items/i1'), { name:'Passports', qty:1 });
    await setDoc(doc(db, 'ulists/owner/lists/secret/items/s1'), { name:'Gift', qty:1 });
    await setDoc(doc(db, 'ulists/owner/items/m1'), { name:'Milk', qty:1 });
  });
});

const as = uid => env.authenticatedContext(uid, { firebase:{ sign_in_provider:'password' } }).firestore();
const anon = () => env.authenticatedContext('anon', { firebase:{ sign_in_provider:'anonymous' } }).firestore();
const nobody = () => env.unauthenticatedContext().firestore();

describe('the owner', () => {
  test('reads and changes everything in their own lists', async () => {
    const db = as('owner');
    await assertSucceeds(getDoc(doc(db, 'ulists/owner/lists/secret/items/s1')));
    await assertSucceeds(setDoc(doc(db, 'ulists/owner/lists/trip/items/i2'), { name:'Tickets' }));
    await assertSucceeds(setDoc(doc(db, 'ulists/owner/items/m2'), { name:'Bread' }));
    await assertSucceeds(updateDoc(doc(db, 'ulists/owner/lists/trip'), { name:'Holiday' }));
    await assertSucceeds(deleteDoc(doc(db, 'ulists/owner/lists/secret')));
  });
});

describe('someone with edit access to a list', () => {
  test('reads and changes items on that list', async () => {
    const db = as('mum');
    await assertSucceeds(getDoc(doc(db, 'ulists/owner/lists/trip/items/i1')));
    await assertSucceeds(getDocs(collection(db, 'ulists/owner/lists/trip/items')));
    await assertSucceeds(setDoc(doc(db, 'ulists/owner/lists/trip/items/i2'), { name:'Tickets' }));
    await assertSucceeds(updateDoc(doc(db, 'ulists/owner/lists/trip/items/i1'), { qty:2 }));
    await assertSucceeds(deleteDoc(doc(db, 'ulists/owner/lists/trip/items/i1')));
    await assertSucceeds(setDoc(doc(db, 'ulists/owner/lists/trip/trips/d-2026-11-26'), { day:'2026-11-26' }));
  });
  test('reads the list’s name but cannot rename or delete the list', async () => {
    const db = as('mum');
    await assertSucceeds(getDoc(doc(db, 'ulists/owner/lists/trip')));
    await assertFails(updateDoc(doc(db, 'ulists/owner/lists/trip'), { name:'Mine now' }));
    await assertFails(deleteDoc(doc(db, 'ulists/owner/lists/trip')));
  });
  test('cannot see a list that was not shared with them', async () => {
    const db = as('mum');
    await assertFails(getDoc(doc(db, 'ulists/owner/lists/secret')));
    await assertFails(getDoc(doc(db, 'ulists/owner/lists/secret/items/s1')));
    await assertFails(setDoc(doc(db, 'ulists/owner/lists/secret/items/s2'), { name:'x' }));
  });
  test('view access on the main list is only view', async () => {
    const db = as('mum');
    await assertSucceeds(getDoc(doc(db, 'ulists/owner/items/m1')));
    await assertFails(setDoc(doc(db, 'ulists/owner/items/m2'), { name:'Bread' }));
  });
  test('cannot read the owner’s profile or give themselves more access', async () => {
    const db = as('mum');
    await assertFails(getDoc(doc(db, 'users/owner')));
    await assertFails(setDoc(doc(db, 'users/owner'), { access:{ mum:{ secret:'edit' } } }, { merge:true }));
  });
});

describe('someone with view access to a list', () => {
  test('reads items but cannot change them', async () => {
    const db = as('dad');
    await assertSucceeds(getDoc(doc(db, 'ulists/owner/lists/trip/items/i1')));
    await assertFails(setDoc(doc(db, 'ulists/owner/lists/trip/items/i2'), { name:'Tickets' }));
    await assertFails(updateDoc(doc(db, 'ulists/owner/lists/trip/items/i1'), { qty:5 }));
    await assertFails(deleteDoc(doc(db, 'ulists/owner/lists/trip/items/i1')));
  });
  test('has no access to the main list when it was not shared', async () => {
    await assertFails(getDoc(doc(as('dad'), 'ulists/owner/items/m1')));
  });
});

describe('people the list is not shared with', () => {
  test('a signed-in stranger can read or change nothing', async () => {
    const db = as('stranger');
    await assertFails(getDoc(doc(db, 'ulists/owner/lists/trip')));
    await assertFails(getDoc(doc(db, 'ulists/owner/lists/trip/items/i1')));
    await assertFails(getDoc(doc(db, 'ulists/owner/items/m1')));
    await assertFails(setDoc(doc(db, 'ulists/owner/lists/trip/items/x'), { name:'x' }));
    await assertFails(setDoc(doc(db, 'ulists/owner/lists/new'), { name:'x' }));
  });
  test('signed out or anonymous: nothing at all', async () => {
    for (const db of [nobody(), anon()]){
      await assertFails(getDoc(doc(db, 'ulists/owner/lists/trip/items/i1')));
      await assertFails(getDoc(doc(db, 'emails/owner@example.com')));
    }
  });
});

describe('profiles and "shared with me"', () => {
  test('each person reads and writes only their own profile', async () => {
    await assertSucceeds(getDoc(doc(as('owner'), 'users/owner')));
    await assertSucceeds(setDoc(doc(as('mum'), 'users/mum'), { name:'Mum' }));
    await assertFails(getDoc(doc(as('dad'), 'users/mum')));
  });
  test('only the person can read what was shared with them', async () => {
    await assertSucceeds(getDoc(doc(as('mum'), 'users/mum/sharedWithMe/owner')));
    await assertFails(getDoc(doc(as('owner'), 'users/mum/sharedWithMe/owner')));
    await assertFails(getDoc(doc(as('dad'), 'users/mum/sharedWithMe/owner')));
  });
  test('the sharer and the person can write it, nobody else', async () => {
    await assertSucceeds(setDoc(doc(as('owner'), 'users/dad/sharedWithMe/owner'), { lists:{ trip:'view' } }));
    await assertSucceeds(deleteDoc(doc(as('mum'), 'users/mum/sharedWithMe/owner')));
    await assertFails(setDoc(doc(as('stranger'), 'users/mum/sharedWithMe/owner'), { lists:{ secret:'edit' } }));
  });
});

describe('looking people up by email', () => {
  test('a signed-in person can look up one exact email', async () => {
    await assertSucceeds(getDoc(doc(as('mum'), 'emails/owner@example.com')));
  });
  test('nobody can browse all emails', async () => {
    await assertFails(getDocs(collection(as('mum'), 'emails')));
  });
  test('you can register only your own account under an email', async () => {
    await assertSucceeds(setDoc(doc(as('mum'), 'emails/mum@example.com'), { uid:'mum', name:'Mum' }));
    await assertFails(setDoc(doc(as('mum'), 'emails/dad@example.com'), { uid:'dad', name:'Dad' }));
  });
  test('you cannot take over someone else’s email entry', async () => {
    await assertFails(setDoc(doc(as('mum'), 'emails/owner@example.com'), { uid:'mum' }));
  });
});

describe('invites to people with no account yet', () => {
  const withEmail = (uid, email) => env.authenticatedContext(uid, { email, firebase:{ sign_in_provider:'password' } }).firestore();
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users/owner'), { invites:{ 'gran@example.com':{ lists:{ trip:'edit', main:'view' } } } }, { merge:true });
      await setDoc(doc(db, 'invites/gran@example.com/from/owner'), { name:'Owner', lists:{ trip:'edit', main:'view' } });
    });
  });
  test('once registered with the invited email, they can open and edit what they were invited to', async () => {
    const gran = withEmail('gran', 'gran@example.com');
    await assertSucceeds(getDoc(doc(gran, 'ulists/owner/lists/trip')));
    await assertSucceeds(setDoc(doc(gran, 'ulists/owner/lists/trip/items/i2'), { name:'Hat', qty:1 }));
    await assertSucceeds(getDoc(doc(gran, 'ulists/owner/items/m1')));
  });
  test('the email matches whatever its letter case', async () => {
    await assertSucceeds(getDoc(doc(withEmail('gran', 'Gran@Example.com'), 'ulists/owner/lists/trip/items/i1')));
  });
  test('view-only invites cannot edit, and other lists stay closed', async () => {
    const gran = withEmail('gran', 'gran@example.com');
    await assertFails(setDoc(doc(gran, 'ulists/owner/items/m2'), { name:'Tea', qty:1 }));
    await assertFails(getDoc(doc(gran, 'ulists/owner/lists/secret/items/s1')));
    await assertFails(setDoc(doc(gran, 'ulists/owner/lists/trip'), { name:'Mine now' }));
  });
  test('someone with a different email gets nothing', async () => {
    await assertFails(getDoc(doc(withEmail('eve', 'eve@example.com'), 'ulists/owner/lists/trip')));
    await assertFails(getDoc(doc(as('eve'), 'ulists/owner/lists/trip')));
  });
  test('only the invitee and the inviter can read an invite', async () => {
    await assertSucceeds(getDocs(collection(withEmail('gran', 'gran@example.com'), 'invites/gran@example.com/from')));
    await assertSucceeds(getDoc(doc(as('owner'), 'invites/gran@example.com/from/owner')));
    await assertFails(getDocs(collection(withEmail('eve', 'eve@example.com'), 'invites/gran@example.com/from')));
  });
  test('only the inviter can write an invite, and not to their own email', async () => {
    const owner = withEmail('owner', 'owner@example.com');
    await assertSucceeds(setDoc(doc(owner, 'invites/new@example.com/from/owner'), { name:'Owner', lists:{} }));
    await assertFails(setDoc(doc(owner, 'invites/owner@example.com/from/owner'), { lists:{} }));
    await assertFails(setDoc(doc(as('mum'), 'invites/new@example.com/from/owner'), { lists:{} }));
    await assertFails(setDoc(doc(withEmail('gran', 'gran@example.com'), 'invites/gran@example.com/from/owner'), { lists:{ secret:'edit' } }));
  });
  test('the invitee can clear their invite but cannot give themselves access', async () => {
    const gran = withEmail('gran', 'gran@example.com');
    await assertSucceeds(deleteDoc(doc(gran, 'invites/gran@example.com/from/owner')));
    await assertFails(setDoc(doc(gran, 'users/owner'), { access:{ gran:{ secret:'edit' } } }, { merge:true }));
  });
});
