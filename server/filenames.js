import { writeFile, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function filenameStem(name, fallback) {
  let stem = name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/-+/g,'-').replace(/^[-_]+|[-_]+$/g,'');
  stem = Array.from(stem).slice(0,60).join('').replace(/[-_]+$/g,'');
  if (!stem) stem = fallback;
  if (/^(blank|active|con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = `${fallback}-${stem}`;
  return stem;
}

// Publish the completed JSON atomically without ever overwriting an existing file.
// The UUID is only used for a temporary file, never the saved profile/preset name.
export async function createNamedJson(directory, name, data, fallback) {
  const stem = filenameStem(name,fallback);
  const temporary = path.join(directory,`.${randomUUID()}.tmp`);
  await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
  try {
    for(let index=1;index<=10000;index++) {
      const id = index === 1 ? stem : `${stem}-${index}`;
      try {await link(temporary,path.join(directory,`${id}.json`)); return id;}
      catch(error) {if(error.code !== 'EEXIST') throw error;}
    }
    throw new Error('Too many files with the same name');
  } finally {await unlink(temporary);}
}
