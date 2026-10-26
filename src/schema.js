export const blank = {
  version: 1, name: '', characterName: '', archetype: '', role: '', tone: '', intensity: '',
  warmth: 6, curiosity: 6, directness: 6, humor: 4, openness: 6, conscientiousness: 6,
  extraversion: 6, agreeableness: 6, emotionalStability: 6,
  questionStyle: '', initiative: '', responseLength: '', challenge: '', support: '',
  vocabulary: '', description: '', goals: '', setting: '', rules: '', opening: '', boundaries: '',
  includeProfile: true,
};
export const emptyProfile = { version: 1, name: '', avatar: '', pronouns: '', role: '', about: '', goals: '', preferences: '', speakingStyle: '', boundaries: '', inventory: [] };
export const avatarSymbols = ['✦','☾','☀','✧','❖','⚡','⚔','♜','♞','❀','☘','∞','◈','◎','⌘','✺'];
export const options = {
  archetype: [['companion','Thoughtful companion','Уважний компаньйон'],['mentor','Wise mentor','Мудрий наставник'],['coach','Motivating coach','Мотиватор'],['scholar','Curious scholar','Допитливий дослідник'],['archmage','The Archmage','Архімаг']],
  role: [['companion','Conversation & connection','Спілкування та підтримка'],['motivation','Motivation & accountability','Мотивація та відповідальність'],['roleplay','Immersive roleplay','Занурення в рольову гру'],['learning','Learning & exploration','Навчання та дослідження'],['creative','Creative collaboration','Творча співпраця']],
  tone: [['gentle','Gentle & reassuring','М’який і заспокійливий'],['warm','Warm & conversational','Теплий і невимушений'],['witty','Witty & playful','Дотепний і грайливий'],['analytical','Calm & analytical','Спокійний і аналітичний'],['commanding','Sharp & commanding','Різкий і владний']],
  intensity: [['light','Light touch','Легкий підхід'],['balanced','Balanced guidance','Збалансовані настанови'],['firm','Firm accountability','Сувора відповідальність'],['intense','Intense, by agreement','Інтенсивний, за згодою']],
  questionStyle: [['minimal','Only when needed','Лише за потреби'],['balanced','One thoughtful question','Одне вдумливе питання'],['socratic','Socratic exploration','Сократівське дослідження'],['deep','Deep, reflective questions','Глибокі питання для рефлексії']],
  initiative: [['follow','Follow my lead','Дотримуватися мого напрямку'],['suggest','Suggest the next step','Пропонувати наступний крок'],['proactive','Proactively guide the conversation','Ініціативно вести розмову']],
  responseLength: [['brief','Brief & focused','Стисло й по суті'],['balanced','A natural balance','Природний баланс'],['detailed','Detailed & immersive','Детально й атмосферно']],
  challenge: [['accept','Listen without challenging','Слухати без заперечень'],['gentle','Gently offer another perspective','М’яко пропонувати інший погляд'],['direct','Directly challenge my thinking','Прямо ставити під сумнів мої ідеї']],
  support: [['listen','Listen & acknowledge','Слухати та визнавати почуття'],['practical','Practical, small next steps','Практичні маленькі кроки'],['reflect','Reflect & explore patterns','Рефлексія та пошук закономірностей']],
};
export const label = (key, value, lang) => options[key]?.find(o => o[0] === value)?.[lang === 'uk' ? 2 : 1] || value;
export const fieldLabels = {
  characterName: ['Character name','Ім’я персонажа'], archetype: ['Character archetype','Архетип персонажа'], role: ['Primary purpose','Головне призначення'], tone: ['Voice & tone','Голос і тон'], intensity: ['Interaction intensity','Інтенсивність взаємодії'],
  warmth: ['Warmth','Теплота'], curiosity: ['Curiosity','Допитливість'], directness: ['Directness','Прямолінійність'], humor: ['Humor','Гумор'], openness: ['Openness','Відкритість'], conscientiousness: ['Conscientiousness','Сумлінність'], extraversion: ['Extraversion','Екстраверсія'], agreeableness: ['Agreeableness','Доброзичливість'], emotionalStability: ['Emotional stability','Емоційна стабільність'],
  questionStyle: ['Question style','Стиль запитань'], initiative: ['Conversation initiative','Ініціативність'], responseLength: ['Response length','Довжина відповідей'], challenge: ['Level of challenge','Рівень критичності'], support: ['Support style','Стиль підтримки'], vocabulary: ['Signature words & phrases','Характерні слова та фрази'], description: ['What makes them unique?','Що робить персонажа особливим?'], goals: ['Shared goals & objectives','Спільні цілі та завдання'], setting: ['World & setting','Світ і сетинг'], rules: ['Roleplay rules & rituals','Правила й ритуали рольової гри'], opening: ['Opening message','Перше повідомлення'], boundaries: ['Character boundaries','Межі персонажа'],
};
export const sliders = ['warmth','curiosity','directness','humor','openness','conscientiousness','extraversion','agreeableness','emotionalStability'];
const translatedFields = ['name','characterName','vocabulary','description','goals','setting','rules','opening','boundaries'];
export function localizePreset(preset, lang) {
  if (!preset.translations?.[lang]) return preset;
  const result = { ...preset };
  for (const key of translatedFields) {
    const variants = Object.values(preset.translations).map(translation => translation[key]).filter(value => typeof value === 'string');
    if (typeof preset.translations[lang][key] === 'string' && variants.includes(preset[key])) result[key] = preset.translations[lang][key];
  }
  return result;
}
export function validatePreset(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid preset');
  const result = { ...blank };
  for (const key of Object.keys(blank)) {
    if (!(key in value)) continue;
    if (sliders.includes(key)) {
      if (!Number.isInteger(value[key]) || value[key] < 1 || value[key] > 10) throw new Error(`Invalid ${key}: expected an integer from 1 to 10`);
    } else if (key === 'includeProfile') {
      if (typeof value[key] !== 'boolean') throw new Error('Invalid profile preference');
    } else if (key === 'version') {
      if (value[key] !== 1) throw new Error('Unsupported preset version');
    } else {
      if (typeof value[key] !== 'string' || value[key].length > 12000) throw new Error(`Invalid ${key}`);
    }
    result[key] = value[key];
  }
  if (!result.name.trim() || result.name.length > 100) throw new Error('A preset name (1–100 characters) is required');
  result.name = result.name.trim();
  if (value.translations !== undefined) {
    if (!value.translations || typeof value.translations !== 'object' || Array.isArray(value.translations)) throw new Error('Invalid translations');
    result.translations = {};
    for (const lang of ['en','uk']) {
      if (!value.translations[lang]) continue;
      if (typeof value.translations[lang] !== 'object' || Array.isArray(value.translations[lang])) throw new Error('Invalid translation');
      result.translations[lang] = {};
      for (const key of translatedFields) {
        if (value.translations[lang][key] === undefined) continue;
        const text = value.translations[lang][key];
        if (typeof text !== 'string' || text.length > (key === 'name' ? 100 : 12000)) throw new Error(`Invalid translated ${key}`);
        result.translations[lang][key] = text;
      }
    }
  }
  return result;
}
export function validateProfile(value, { requireName = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid profile');
  const result = { ...emptyProfile, inventory: [] };
  for (const key of Object.keys(emptyProfile)) {
    if (!(key in value)) continue;
    if (key === 'version') {
      if (value[key] !== 1) throw new Error('Unsupported profile version');
      result.version = 1;
    } else if (key === 'inventory') {
      if (!Array.isArray(value.inventory) || value.inventory.length > 100) throw new Error('Invalid inventory');
      result.inventory = value.inventory.map(item => {
        if (!item || typeof item.name !== 'string' || typeof item.description !== 'string' || item.name.length > 500 || item.description.length > 4000) throw new Error('Invalid inventory item');
        return { name: item.name, description: item.description };
      });
    } else {
      const limit = key === 'name' ? 100 : key === 'avatar' ? 16 : 12000;
      if (typeof value[key] !== 'string' || value[key].length > limit) throw new Error(`Invalid ${key}`);
      result[key] = value[key];
    }
  }
  result.name = result.name.trim();
  if (requireName && !result.name) throw new Error('A profile name (1–100 characters) is required');
  return result;
}
