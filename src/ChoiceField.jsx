import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const customOption = '__custom_input__';
export default function ChoiceField({ title, value, choices, lang, t, onChange }) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  const unknown = Boolean(value) && !choices.some(option => option[0] === value);
  const customMode = custom || unknown;
  function select(value) {
    if(value === customOption) {setCustom(true); if(!customMode) onChange('');}
    else {setCustom(false);onChange(value);}
  }
  return <div className="field choice-field"><label className="field-label" htmlFor={id}>{title}</label><span className="select-wrap"><select id={id} value={customMode ? customOption : value} onChange={event => select(event.target.value)}><option value="">{t.choose}</option>{choices.map(option => <option key={option[0]} value={option[0]}>{option[lang === 'uk' ? 2 : 1]}</option>)}<option value={customOption}>{t.customChoice}</option></select><ChevronDown size={14}/></span>{customMode && <input aria-label={`${title} — ${t.customValue}`} value={value} maxLength={12000} placeholder={t.customPlaceholder} onChange={event => onChange(event.target.value)}/>}</div>;
}
