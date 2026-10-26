import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, writeFile, rm, mkdir, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApi } from '../server/api.js';
import { blank, emptyProfile, validatePreset, localizePreset, validateProfile } from '../src/schema.js';
import { createProfileStore } from '../server/profiles.js';
import { createNamedJson } from '../server/filenames.js';
import { generatePrompt } from '../src/prompt.js';

test('prompt uses selected language and respects the profile inclusion toggle', () => {
  const preset = { ...blank, name:'Test', characterName:'Sage', tone:'warm', goals:'Learn astronomy' };
  const profile = { ...emptyProfile, name:'Alex', inventory:[{name:'Telescope',description:'A small brass telescope'}] };
  const english = generatePrompt(preset,profile,'en');
  assert.match(english,/Warm & conversational/);
  assert.match(english,/Name: Alex/);
  assert.match(english,/Telescope: A small brass telescope/);
  const ukrainian = generatePrompt(preset,profile,'uk');
  assert.match(ukrainian,/Теплий і невимушений/);
  assert.match(ukrainian,/Ім’я: Alex/);
  assert.match(ukrainian,/Відповідай українською/);
  const excluded = generatePrompt({...preset,includeProfile:false},profile,'en');
  assert.doesNotMatch(excluded,/Alex|Telescope/);
  assert.match(excluded,/Stop or soften immediately/);
});

test('schema accepts custom character values and enforces the 1–10 trait scale', () => {
  assert.throws(() => validatePreset({...blank,name:'Test',warmth:99}));
  assert.equal(validatePreset({...blank,name:'Test',tone:'My own sharp, playful voice'}).tone,'My own sharp, playful voice');
  assert.equal(validatePreset({...blank,name:'Test',warmth:10}).warmth,10);
  assert.throws(() => validatePreset({...blank,name:'Test',warmth:11}));
  assert.throws(() => validatePreset({...blank,name:'Test',warmth:1.5}));
  assert.throws(() => validatePreset({...blank,name:'   '}));
  assert.equal(validatePreset({name:' My preset '}).name,'My preset');
  assert.equal(validatePreset({name:'My preset'}).warmth,6);
});

test('preset translations follow the output language while preserving custom edits', async () => {
  const archmage = validatePreset(JSON.parse(await readFile(new URL('../data/presets/archmage.json',import.meta.url),'utf8')));
  const uk = localizePreset(archmage,'uk');
  assert.equal(uk.characterName,'Архімаг');
  assert.equal(localizePreset(uk,'en').characterName,'The Archmage');
  const prompt = generatePrompt(archmage,emptyProfile,'uk');
  assert.match(prompt,/Кузня палає, учню/);
  assert.doesNotMatch(prompt,/The Forge is lit/);
  assert.equal(localizePreset({...archmage,description:'My custom description'},'uk').description,'My custom description');
  assert.deepEqual(validatePreset(uk).translations,archmage.translations);
});

test('JSON storage persists create, update, profile and delete; rejects cross-origin writes', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'persona-test-'));
  await mkdir(path.join(dir,'presets'));
  await writeFile(path.join(dir,'blank.json'),JSON.stringify({...blank,curiosity:5}));
  const middleware = createApi(dir);
  const server = http.createServer((req,res) => middleware(req,res,() => {res.writeHead(404);res.end();}));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (endpoint,method='GET',body,headers={}) => fetch(base+'/api/'+endpoint,{method,headers:{'Content-Type':'application/json',...headers},body:body ? JSON.stringify(body) : undefined});
  try {
    assert.equal((await (await request('blank')).json()).curiosity,5);
    const response = await request('presets','POST',{...blank,name:'Local test'});
    assert.equal(response.status,201);
    const saved = await response.json();
    assert.equal(saved.id,'local-test');
    assert.equal(JSON.parse(await readFile(path.join(dir,'presets',saved.id+'.json'),'utf8')).name,'Local test');
    assert.equal((await (await request('presets')).json()).presets.length,1);
    const update = await request('presets/'+saved.id,'PUT',{...saved,name:'Renamed',tone:'witty'});
    assert.equal(update.status,200);
    assert.equal(JSON.parse(await readFile(path.join(dir,'presets',saved.id+'.json'),'utf8')).tone,'witty');
    await request('profile','PUT',{...emptyProfile,name:'Apprentice',inventory:[{name:'Stone',description:'Focus'}]});
    assert.equal((await (await request('profile')).json()).inventory[0].name,'Stone');
    assert.equal((await request('presets','POST',{...blank,name:'Attack'},{Origin:'https://evil.example'})).status,403);
    assert.equal((await request('presets','POST',{...blank,name:'Invalid',warmth:11})).status,400);
    assert.equal((await request('presets/no-such-file','PUT',{...blank,name:'Missing'})).status,404);
    await writeFile(path.join(dir,'presets','malformed.json'),'{');
    const listing = await (await request('presets')).json();
    assert.deepEqual(listing.errors,['malformed.json']);
    assert.equal(listing.presets.length,1);
    await writeFile(path.join(dir,'presets','Мій персонаж.v2.json'),JSON.stringify({...blank,name:'Український пресет'}));
    assert.equal((await request('presets/'+encodeURIComponent('Мій персонаж.v2'),'PUT',{...blank,name:'Оновлений'})).status,200);
    assert.equal((await request('presets/'+encodeURIComponent('Мій персонаж.v2'),'DELETE')).status,200);
    const existingId = '31438396-cf03-453f-b3f5-ea3491e2177e';
    await writeFile(path.join(dir,'presets',existingId+'.json'),JSON.stringify({...blank,name:'Custom imported JSON',tone:'My custom voice',questionStyle:'Ask surprising questions',warmth:10}));
    const customListing = await (await request('presets')).json();
    assert.equal(customListing.presets.find(item => item.id === existingId).tone,'My custom voice');
    assert.ok(!customListing.errors.includes(existingId+'.json'));
    const editedExisting = await (await request('presets/'+existingId,'PUT',{...blank,name:'Renamed display name',tone:'Custom voice after editing'})).json();
    assert.equal(editedExisting.id,existingId);
    assert.equal((await request('presets/'+existingId,'DELETE')).status,200);
    assert.equal((await request('presets/'+saved.id,'DELETE')).status,200);
    assert.deepEqual(await readdir(path.join(dir,'presets')),['malformed.json']);
    assert.equal((await request('blank','DELETE')).status,404);
    assert.equal((await request('profiles/blank','DELETE')).status,404);
    assert.equal((await request('profiles/blank','PUT',{...emptyProfile,name:'No'})).status,404);
    assert.equal((await request('profiles','POST',{...emptyProfile,name:''})).status,400);
    const second = await (await request('profiles','POST',{...emptyProfile,name:'Scholar',avatar:'☾'})).json();
    assert.equal(second.avatar,'☾');
    assert.equal(second.id,'scholar');
    assert.equal((await request('profiles/active','PUT',{activeProfileId:second.id})).status,200);
    assert.equal((await (await request('profile')).json()).name,'Scholar');
    assert.equal((await request('profiles/active','PUT',{activeProfileId:'../bad'})).status,400);
    assert.equal((await request('profiles','POST',{...emptyProfile,name:'Cross origin'},{Origin:'https://evil.example'})).status,403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir,{recursive:true,force:true});
  }
});

test('multiple profiles keep independent inventories, active selection persists, deletion clears active choice', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'persona-profiles-'));
  try {
    await writeFile(path.join(dir,'blank-profile.json'),JSON.stringify({...emptyProfile,avatar:'✧'}));
    const store = createProfileStore(dir);
    assert.equal((await store.template()).avatar,'✧');
    assert.deepEqual((await store.list()).profiles,[]);
    const first = await store.save({...emptyProfile,name:'Apprentice',avatar:'⚡',inventory:[{name:'Stone',description:'Blue'}]});
    const second = await store.save({...emptyProfile,name:'Explorer',avatar:'🪐',inventory:[{name:'Map',description:'Stars'}]});
    assert.equal((await store.list()).activeProfileId,first.id);
    await store.save({...second,about:'Updated explorer'},second.id);
    assert.equal((await store.active()).name,'Apprentice');
    await store.activate(second.id);
    const restarted = createProfileStore(dir);
    assert.equal((await restarted.active()).name,'Explorer');
    assert.equal((await restarted.active()).inventory[0].name,'Map');
    const prompt = generatePrompt({...blank,name:'Character'},await restarted.active(),'en');
    assert.match(prompt,/Name: Explorer/); assert.doesNotMatch(prompt,/Stone|Apprentice/);
    await restarted.activate(null);
    await restarted.save({...second,about:'Another edit'},second.id);
    assert.equal((await restarted.list()).activeProfileId,null);
    await restarted.activate(second.id);
    await restarted.remove(first.id);
    assert.equal((await restarted.list()).activeProfileId,second.id);
    await restarted.remove(second.id);
    assert.equal((await restarted.list()).activeProfileId,null);
    assert.equal((await restarted.active()).name,'');
    await assert.rejects(() => restarted.activate('missing'));
    assert.equal(JSON.parse(await readFile(path.join(dir,'blank-profile.json'),'utf8')).avatar,'✧');
    await assert.rejects(() => restarted.remove('../blank-profile'));
    await assert.rejects(() => restarted.save({...emptyProfile,name:'No',avatar:'x'.repeat(17)}));
    assert.throws(() => validateProfile({...emptyProfile,version:2}));
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('legacy profile migrates once, preserving original file and custom data', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'persona-migration-'));
  try {
    const legacy = {name:'Existing user',about:'My story',inventory:[{name:'Journal',description:'Old notes'}]};
    const raw = JSON.stringify(legacy);
    await writeFile(path.join(dir,'profile.json'),raw);
    const store = createProfileStore(dir);
    const results = await Promise.all([store.list(),store.list(),store.active()]);
    assert.equal(results[0].profiles.length,1);
    assert.equal(results[2].inventory[0].name,'Journal');
    assert.equal(await readFile(path.join(dir,'profile.json'),'utf8'),raw);
    const id = results[0].activeProfileId;
    assert.equal((await createProfileStore(dir).list()).activeProfileId,id);
    assert.equal((await createProfileStore(dir).list()).profiles.length,1);
    await writeFile(path.join(dir,'profiles','bad.json'),'{');
    assert.deepEqual((await store.list()).errors,['bad.json']);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('all character choices accept custom text and preserve it in both prompt languages', () => {
  const fields = ['archetype','role','tone','intensity','questionStyle','initiative','responseLength','challenge','support'];
  const custom = {...blank,name:'Custom character',warmth:10};
  for(const field of fields) custom[field] = `My own ${field} — власний варіант`;
  const validated = validatePreset(custom);
  for(const lang of ['en','uk']) {
    const prompt = generatePrompt(validated,emptyProfile,lang);
    for(const field of fields) assert.ok(prompt.includes(custom[field]));
    assert.match(prompt,/10\/10/);
  }
});

test('speaking style survives profile storage and is included only with the selected profile', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'persona-speaking-'));
  try {
    const store = createProfileStore(dir);
    const saved = await store.save({...emptyProfile,name:'Apprentice',speakingStyle:'Use concise instructions and call me apprentice.'});
    const restored = await createProfileStore(dir).active();
    assert.equal(restored.speakingStyle,saved.speakingStyle);
    const prompt = generatePrompt({...blank,name:'Guide'},restored,'en');
    assert.match(prompt,/### SPEAKING \/ COMMAND STYLE/);
    assert.ok(prompt.includes(saved.speakingStyle));
    assert.match(generatePrompt({...blank,name:'Guide'},restored,'uk'),/СТИЛЬ СПІЛКУВАННЯ/);
    assert.ok(!generatePrompt({...blank,name:'Guide',includeProfile:false},restored,'en').includes(saved.speakingStyle));
    assert.equal(validateProfile({name:'Old profile'}).speakingStyle,'');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('readable JSON filenames preserve Unicode, avoid collisions and never overwrite', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(),'persona-filenames-'));
  try {
    const ids = await Promise.all([1,2,3].map(index => createNamedJson(dir,'Мій профіль / The Mage',{index},'profile')));
    assert.deepEqual([...ids].sort(),['мій-профіль-the-mage','мій-профіль-the-mage-2','мій-профіль-the-mage-3']);
    assert.deepEqual((await Promise.all(ids.map(id => readFile(path.join(dir,id+'.json'),'utf8')))).map(raw => JSON.parse(raw).index).sort(),[1,2,3]);
    assert.equal(await createNamedJson(dir,'../../',{ok:true},'preset'),'preset');
    assert.equal(await createNamedJson(dir,'ACTIVE',{ok:true},'profile'),'profile-active');
    assert.equal(await createNamedJson(dir,'🪐',{ok:true},'profile'),'profile');
    assert.ok((await readdir(dir)).every(name => name.endsWith('.json')));
  } finally {await rm(dir,{recursive:true,force:true});}
});
