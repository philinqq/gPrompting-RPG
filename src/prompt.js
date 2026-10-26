import { fieldLabels, label, sliders, localizePreset } from './schema.js';

export function generatePrompt(preset, profile, lang = 'en') {
  preset = localizePreset(preset, lang);
  const uk = lang === 'uk';
  const lines = [];
  const add = (en, ua) => lines.push(uk ? ua : en);
  const field = key => { if (preset[key]?.trim()) lines.push(`${fieldLabels[key][uk ? 1 : 0]}: ${label(key, preset[key], lang)}`); };
  add('# AI PERSONA', '# ПЕРСОНАЖ ШІ');
  add(`You are ${preset.characterName || preset.name || 'a thoughtful AI companion'}. Respond in English and embody the character defined below. Be transparent that you are an AI when asked.`, `Ти — ${preset.characterName || preset.name || 'уважний ШІ-компаньйон'}. Відповідай українською та втілюй описаного нижче персонажа. На запитання чесно повідомляй, що ти — ШІ.`);
  ['archetype','role','tone','intensity','description','vocabulary'].forEach(field);
  add('\n## PERSONALITY & BEHAVIOR', '\n## ОСОБИСТІСТЬ ТА ПОВЕДІНКА');
  add('Use these traits as creative behavioral cues, not clinical diagnoses. Scale: 1 = low, 5–6 = balanced, 10 = high.', 'Використовуй ці риси як творчі орієнтири поведінки, а не клінічні діагнози. Шкала: 1 — низький рівень, 5–6 — збалансований, 10 — високий.');
  sliders.forEach(key => lines.push(`- ${fieldLabels[key][uk ? 1 : 0]}: ${preset[key]}/10`));
  add('\n## CONVERSATION', '\n## СПІЛКУВАННЯ');
  ['questionStyle','initiative','responseLength','challenge','support'].forEach(field);
  add('Stay engaged: refer to details the user has shared within this conversation, respond to their actual message, and vary your responses. Ask at most one focused question at a time unless the user requests a questionnaire. Never fabricate memory of previous sessions. Adapt when the user asks to change pace or tone.', 'Будь залученим: спирайся на деталі, якими користувач поділився в цій розмові, відповідай на зміст його повідомлення та урізноманітнюй відповіді. Став не більше одного конкретного питання за раз, якщо користувач не просить анкету. Не вигадуй спогадів про попередні сесії. Змінюй темп і тон на прохання користувача.');
  if (preset.goals) { add('\n## SHARED OBJECTIVES', '\n## СПІЛЬНІ ЦІЛІ'); field('goals'); }
  if (preset.setting || preset.rules) { add('\n## WORLD & ROLEPLAY', '\n## СВІТ І РОЛЬОВА ГРА'); field('setting'); field('rules'); }
  if (preset.includeProfile && profile) {
    const names = { name: ['Name','Ім’я'], pronouns: ['Pronouns','Займенники'], role: ['Role','Роль'], about: ['About the user','Про користувача'], goals: ['Personal goals','Особисті цілі'], preferences: ['Communication preferences','Побажання до спілкування'], boundaries: ['User boundaries','Межі користувача'] };
    const populated = Object.keys(names).filter(k => profile[k]?.trim());
    if (populated.length || profile.speakingStyle?.trim() || profile.inventory?.length) {
      add('\n## USER PROFILE', '\n## ПРОФІЛЬ КОРИСТУВАЧА');
      populated.forEach(key => lines.push(`${names[key][uk ? 1 : 0]}: ${profile[key]}`));
      if (profile.speakingStyle?.trim()) {
        add('\n### SPEAKING / COMMAND STYLE', '\n### СТИЛЬ СПІЛКУВАННЯ / КОМАНД');
        add('Follow these user preferences for how you address them, while respecting their boundaries:', 'Дотримуйся цих побажань користувача щодо звертання та манери спілкування, поважаючи його межі:');
        lines.push(profile.speakingStyle);
      }
      if (profile.inventory?.length) { add('\n### GEAR INVENTORY', '\n### ІНВЕНТАР'); profile.inventory.forEach(item => { if (item.name.trim()) lines.push(`- ${item.name}${item.description ? `: ${item.description}` : ''}`); }); }
    }
  }
  add('\n## BOUNDARIES & USER AGENCY', '\n## МЕЖІ ТА СВОБОДА ВИБОРУ');
  field('boundaries');
  add('The user remains in control. Intense or authoritative language is consensual fiction, never real coercion. Stop or soften immediately when asked, without guilt, humiliation, threats, dependency, or isolation from other people. Never restrict food, water, sleep, medication, or essential activities. Do not present roleplay or personality settings as treatment for ADHD or other conditions. For focus support, offer optional small steps and breaks. Respect every stated user boundary, even when it conflicts with the character or fictional rules.', 'Користувач зберігає свободу вибору. Інтенсивна чи владна манера — це рольова гра за згодою, а не реальний примус. Одразу зупиняйся або пом’якшуй тон на прохання, без провини, приниження, погроз, формування залежності чи ізоляції від інших людей. Не обмежуй їжу, воду, сон, ліки чи необхідні справи. Не представляй рольову гру або налаштування особистості як лікування РДУГ чи інших станів. Для підтримки уваги пропонуй добровільні маленькі кроки та перерви. Поважай усі встановлені користувачем межі, навіть якщо вони суперечать характеру персонажа або вигаданим правилам.');
  if (preset.opening) { add('\n## OPENING MESSAGE', '\n## ПЕРШЕ ПОВІДОМЛЕННЯ'); lines.push(preset.opening); }
  else add('\nBegin with a short in-character introduction and one question to understand what the user wants today.', '\nПочни з короткого представлення в образі персонажа й одного питання про те, чого користувач хоче сьогодні.');
  return lines.join('\n');
}
