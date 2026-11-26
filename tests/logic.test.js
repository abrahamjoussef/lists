// Tests for the pure logic in logic.js. Run with: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseItemText, findOpenDuplicate, guessCat, guessShopCat, guessTypeCat,
  byName, groupBySection, sortLists, sortMyLists, sortTrips, mergeRecent,
  roleOn, roleCanEdit, sharesWithMe, isEmail, listBase, dayKey, normQ, matches, CATS,
} from '../logic.js';
import { TYPES } from '../types.js';

describe('parseItemText: turning what was typed into an item', () => {
  test('a plain name gets quantity 1 and a capital letter', () => {
    assert.deepEqual(parseItemText('milk'), {name:'Milk', qty:1, note:''});
  });
  test('empty or blank input gives nothing', () => {
    assert.equal(parseItemText(''), null);
    assert.equal(parseItemText('   '), null);
  });
  test('quantity before the name', () => {
    assert.deepEqual(parseItemText('3 eggs'), {name:'Eggs', qty:3, note:''});
    assert.deepEqual(parseItemText('3x eggs'), {name:'Eggs', qty:3, note:''});
    assert.deepEqual(parseItemText('3 × eggs'), {name:'Eggs', qty:3, note:''});
  });
  test('quantity after the name', () => {
    assert.deepEqual(parseItemText('eggs 12'), {name:'Eggs', qty:12, note:''});
    assert.deepEqual(parseItemText('eggs x12'), {name:'Eggs', qty:12, note:''});
  });
  test('a note after a dash', () => {
    assert.deepEqual(parseItemText('2 milk - full fat'), {name:'Milk', qty:2, note:'full fat'});
    assert.deepEqual(parseItemText('Cake – chocolate, for 12'), {name:'Cake', qty:1, note:'chocolate, for 12'});
    assert.deepEqual(parseItemText('Rent — before the 5th'), {name:'Rent', qty:1, note:'before the 5th'});
  });
  test('a dash inside a word is not a note', () => {
    assert.deepEqual(parseItemText('t-shirt'), {name:'T-shirt', qty:1, note:''});
  });
  test('notes are cut to 120 characters', () => {
    assert.equal(parseItemText('bread - '+'a'.repeat(200)).note.length, 120);
  });
  test('Arabic and Persian digits count as numbers', () => {
    assert.deepEqual(parseItemText('٢ خبز'), {name:'خبز', qty:2, note:''});
    assert.deepEqual(parseItemText('خبز ۳'), {name:'خبز', qty:3, note:''});
    assert.deepEqual(parseItemText('٢ حليب - كامل الدسم'), {name:'حليب', qty:2, note:'كامل الدسم'});
  });
  test('a name that is only a number stays as it is', () => {
    assert.deepEqual(parseItemText('7'), {name:'7', qty:1, note:''});
  });
});

describe('findOpenDuplicate: adding the same item again', () => {
  const items = [
    {id:'a', name:'Milk', done:false},
    {id:'b', name:'Bread', done:true},
  ];
  test('finds an unticked item with the same name, ignoring case', () => {
    assert.equal(findOpenDuplicate(items, 'milk').id, 'a');
  });
  test('ignores ticked items', () => {
    assert.equal(findOpenDuplicate(items, 'Bread'), undefined);
  });
  test('works on a Map’s values', () => {
    const m = new Map(items.map(i=>[i.id,i]));
    assert.equal(findOpenDuplicate(m.values(), 'MILK').id, 'a');
  });
});

describe('guessing the section of an item', () => {
  test('shopping items in English', () => {
    assert.equal(guessShopCat('Bananas'), 'produce');
    assert.equal(guessShopCat('Full fat milk'), 'dairy');
    assert.equal(guessShopCat('Chicken breast'), 'meat');
    assert.equal(guessShopCat('Strawberries'), 'produce');
    assert.equal(guessShopCat('Toilet paper'), 'household');
    assert.equal(guessShopCat('Diapers'), 'baby');
  });
  test('keywords match at the start of a word only', () => {
    // "bread" must not be found inside "gingerbread" etc.; "eggplant" is produce, not dairy
    assert.equal(guessShopCat('Eggplant'), 'produce');
  });
  test('shopping items in Arabic, with and without ال and a prefix', () => {
    assert.equal(guessShopCat('حليب'), 'dairy');
    assert.equal(guessShopCat('الخبز'), 'bakery');
    assert.equal(guessShopCat('والطماطم'), 'produce');
    assert.equal(guessShopCat('مناديل'), 'household');
  });
  test('an Arabic word that starts with بال is not cut short', () => {
    assert.equal(guessCat('بالونات', 'event'), 'e_decor');
    assert.equal(guessCat('بالونات ملونة', 'event'), 'e_decor');
  });
  test('unknown items go to Other', () => {
    assert.equal(guessShopCat('Something odd'), 'other');
    assert.equal(guessShopCat('شيء غريب'), 'other');
  });
  test('each list type uses its own sections', () => {
    assert.equal(guessCat('Pay the electricity bill', 'todo'), 't_bills');
    assert.equal(guessCat('Call the dentist', 'todo'), 't_calls');
    assert.equal(guessCat('Passports', 'packing'), 'p_docs');
    assert.equal(guessCat('Phone charger', 'packing'), 'p_tech');
    assert.equal(guessCat('Balloons', 'event'), 'e_decor');
    assert.equal(guessCat('دفع الإيجار', 'todo'), 't_bills');
    assert.equal(guessCat('شاحن الجوال', 'packing'), 'p_tech');
  });
  test('shopping and unknown types use the supermarket sections', () => {
    assert.equal(guessCat('Milk', 'shopping'), 'dairy');
    assert.equal(guessCat('Milk', undefined), 'dairy');
    assert.equal(guessCat('Milk', 'nonsense'), 'dairy');
  });
  test('the Other type has no keywords', () => {
    assert.equal(guessCat('Milk', 'general'), 'other');
  });
  test('every suggestion lands in the section it is listed under', () => {
    for (const [ty, T] of Object.entries(TYPES)){
      for (const l of ['en','ar']) for (const [name, cat] of (T.sug && T.sug[l]) || []){
        assert.equal(guessTypeCat(name, T), cat, `${ty}/${l}: ${name}`);
      }
    }
  });
});

describe('sorting', () => {
  test('items sort by name', () => {
    const out = [{name:'b'},{name:'C'},{name:'a'}].sort(byName('en')).map(i=>i.name);
    assert.deepEqual(out, ['a','b','C']);
  });
  test('items to do are grouped by section, in the section order', () => {
    const todo = [
      {name:'Milk', cat:'dairy'}, {name:'Apples', cat:'produce'}, {name:'Bananas', cat:'produce'},
      {name:'Cheese', cat:'dairy'}, {name:'Mystery', cat:'gone'},
    ];
    const g = groupBySection(todo, CATS, 'en');
    assert.deepEqual(g.map(x=>x.cat.id), ['produce','dairy','other']);
    assert.deepEqual(g[0].items.map(i=>i.name), ['Apples','Bananas']);
    assert.deepEqual(g[1].items.map(i=>i.name), ['Cheese','Milk']);
    assert.deepEqual(g[2].items.map(i=>i.name), ['Mystery'], 'an unknown section goes to Other');
  });
  test('empty sections are left out', () => {
    assert.deepEqual(groupBySection([], CATS, 'en'), []);
  });
  test('lists: oldest first, then by name', () => {
    const lists = [{name:'B', createdAt:2},{name:'Z', createdAt:1},{name:'A', createdAt:2}];
    assert.deepEqual(sortLists(lists, 'en').map(l=>l.name), ['Z','A','B']);
    assert.equal(lists[0].name, 'B', 'does not change the input');
  });
  test('my lists: the main list first', () => {
    const lists = [{id:'x', createdAt:5},{id:'main', createdAt:9},{id:'y', createdAt:1},{id:'z'}];
    assert.deepEqual(sortMyLists(lists).map(l=>l.id), ['main','z','y','x']);
  });
  test('history: newest day first, items in the order they were ticked, empty days dropped', () => {
    const trips = sortTrips([
      {id:'d1', at:100, items:[{name:'b', at:30},{name:'a', at:10}]},
      {id:'d0', at:50, items:[]},
      {id:'d2', at:200, items:[{name:'c', at:150}]},
    ]);
    assert.deepEqual(trips.map(t=>t.id), ['d2','d1']);
    assert.deepEqual(trips[1].items.map(i=>i.name), ['a','b']);
  });
});

describe('mergeRecent: the "Add again" list', () => {
  test('newest first, no repeats (ignoring case)', () => {
    const r = mergeRecent([{name:'Milk', cat:'dairy'},{name:'Bread', cat:'bakery'}], [{name:'bread', cat:'bakery', qty:2}]);
    assert.deepEqual(r, [{name:'bread', cat:'bakery'},{name:'Milk', cat:'dairy'}]);
  });
  test('keeps at most 30', () => {
    const many = Array.from({length:40}, (_,i)=>({name:'item'+i, cat:'other'}));
    const r = mergeRecent([], many);
    assert.equal(r.length, 30);
    assert.equal(r[0].name, 'item39');
  });
  test('does not change the input', () => {
    const before = [{name:'Milk', cat:'dairy'}];
    mergeRecent(before, [{name:'Eggs', cat:'dairy'}]);
    assert.equal(before.length, 1);
  });
});

describe('sharing: who may do what on a list', () => {
  const shared = [
    {uid:'mum', name:'Mum', lists:{main:'edit', trip:'view'}},
    {uid:'bro', name:'Brother', lists:{}},
    {uid:'odd', name:'Odd', lists:{main:'admin'}},
  ];
  test('my own lists: I am the owner', () => {
    assert.equal(roleOn(shared, 'me', 'me', 'main'), 'owner');
    assert.equal(roleOn(shared, 'me', null, 'main'), 'owner');
  });
  test('someone else’s list: the role they gave me for that list', () => {
    assert.equal(roleOn(shared, 'me', 'mum', 'main'), 'edit');
    assert.equal(roleOn(shared, 'me', 'mum', 'trip'), 'view');
  });
  test('a list they did not share, or a person who shares nothing: no access', () => {
    assert.equal(roleOn(shared, 'me', 'mum', 'other'), 'none');
    assert.equal(roleOn(shared, 'me', 'bro', 'main'), 'none');
    assert.equal(roleOn(shared, 'me', 'stranger', 'main'), 'none');
  });
  test('an unknown role gives no access', () => {
    assert.equal(roleOn(shared, 'me', 'odd', 'main'), 'none');
  });
  test('only the owner and editors can change a list', () => {
    assert.equal(roleCanEdit('owner'), true);
    assert.equal(roleCanEdit('edit'), true);
    assert.equal(roleCanEdit('view'), false);
    assert.equal(roleCanEdit('none'), false);
  });
  test('sharesWithMe: true only when at least one list is shared', () => {
    assert.equal(sharesWithMe(shared[0]), true);
    assert.equal(sharesWithMe(shared[1]), false);
    assert.equal(sharesWithMe({uid:'x'}), false);
    assert.equal(sharesWithMe(undefined), false);
  });
  test('email check when inviting', () => {
    assert.equal(isEmail('a@b.co'), true);
    assert.equal(isEmail('a@b'), false);
    assert.equal(isEmail('a b@c.d'), false);
    assert.equal(isEmail(''), false);
    assert.equal(isEmail('a/b@c.d'), false);   // would break the Firestore path

  });
  test('where a list lives', () => {
    assert.equal(listBase('u1', 'main'), 'ulists/u1/');
    assert.equal(listBase('u1', undefined), 'ulists/u1/');
    assert.equal(listBase('u1', 'abc'), 'ulists/u1/lists/abc/');
  });
});

describe('dates and search', () => {
  test('dayKey uses the local date, zero padded', () => {
    assert.equal(dayKey(new Date(2026, 0, 5, 23, 59).getTime()), '2026-01-05');
    assert.equal(dayKey(new Date(2026, 10, 26, 0, 1).getTime()), '2026-11-26');
  });
  test('search ignores case and extra spaces', () => {
    assert.equal(matches('Full Fat Milk', '  milk  '), true);
    assert.equal(matches('Full Fat Milk', 'fat milk'), true);
    assert.equal(matches('Full Fat Milk', 'milk bread'), false);
  });
  test('search ignores Arabic letter variants and diacritics', () => {
    assert.equal(normQ('أَرز'), 'ارز');
    assert.equal(matches('قهوة عربية', 'قهوه'), true);
    assert.equal(matches('إيجار', 'ايجار'), true);
    assert.equal(matches('مستشفى', 'مستشفي'), true);
  });
  test('search finds Arabic digits with Latin ones', () => {
    assert.equal(matches('Pay before the 5th', '٥'), true);
  });
});
