import { readFile, writeFile, mkdir, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyProfile, validateProfile } from '../src/schema.js';
import { createNamedJson } from './filenames.js';

const validId = id => typeof id === 'string' && /^[\p{L}\p{N}_ .-]{1,150}$/u.test(id) && !['.','..','blank','active'].includes(id);
const readJson = async file => JSON.parse(await readFile(file,'utf8'));
async function writeJson(file, data) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data,null,2)+'\n', {mode:0o600});
  await rename(temporary,file);
}
export function createProfileStore(dataDir) {
  const directory = path.join(dataDir,'profiles');
  const stateFile = path.join(dataDir,'workspace.json');
  let initializing;
  const fileFor = id => { if (!validId(id)) throw new Error('Invalid profile filename'); return path.join(directory,`${id}.json`); };
  async function ensure() {
    if (!initializing) initializing = (async () => {
      await mkdir(directory,{recursive:true});
      try { await readJson(stateFile); return; } catch(error) { if(error.code !== 'ENOENT') throw error; }
      let legacy;
      try { legacy = validateProfile(await readJson(path.join(dataDir,'profile.json'))); } catch(error) { if(error.code !== 'ENOENT') throw error; }
      let activeProfileId = null;
      if (legacy && (legacy.name || legacy.role || legacy.about || legacy.goals || legacy.preferences || legacy.speakingStyle || legacy.boundaries || legacy.inventory.length || legacy.pronouns || legacy.avatar)) {
        const migrated = {...legacy,name:legacy.name || 'Imported profile'};
        activeProfileId = await createNamedJson(directory,migrated.name,migrated,'profile');
      }
      // Preserve the old file as a backup; the migration only runs once.
      await writeJson(stateFile,{version:1,activeProfileId});
    })().catch(error => { initializing = null; throw error; });
    await initializing;
  }
  async function template() {
    try { return {...validateProfile(await readJson(path.join(dataDir,'blank-profile.json'))),name:''}; }
    catch(error) { if(error.code === 'ENOENT') return {...emptyProfile,inventory:[]}; throw error; }
  }
  async function list() {
    await ensure();
    const profiles = [], errors = [];
    for (const filename of (await readdir(directory)).filter(file => file.endsWith('.json')).sort()) {
      try { const id = filename.slice(0,-5); const data = validateProfile(await readJson(fileFor(id)),{requireName:true}); profiles.push({id,...data}); }
      catch { errors.push(filename); }
    }
    const state = await readJson(stateFile);
    return {profiles, errors, activeProfileId:profiles.some(p => p.id === state.activeProfileId) ? state.activeProfileId : null};
  }
  async function activate(id) {
    await ensure();
    if(id !== null) await read(id);
    await writeJson(stateFile,{version:1,activeProfileId:id});
    return {activeProfileId:id};
  }
  async function read(id) { await ensure(); return {id,...validateProfile(await readJson(fileFor(id)),{requireName:true})}; }
  async function active() { const library = await list(); const profile = library.profiles.find(p => p.id === library.activeProfileId); if (!profile) return {...emptyProfile,inventory:[]}; const {id,...data} = profile; return data; }
  async function save(value, id) {
    await ensure();
    const creating = !id;
    const profile = validateProfile(value,{requireName:true});
    if (id) {await read(id);await writeJson(fileFor(id),profile);}
    else id = await createNamedJson(directory,profile.name,profile,'profile');
    const state = await list();
    if (creating && state.profiles.length === 1 && !state.activeProfileId) await activate(id);
    return {id,...profile};
  }
  async function remove(id) {
    await ensure(); await unlink(fileFor(id));
    const state = await readJson(stateFile);
    if (state.activeProfileId === id) await activate(null);
    return {ok:true};
  }
  return {list, template, activate, active, save, remove};
}
