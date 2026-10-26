import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette, X } from 'lucide-react';

const colors = [
  {value:'#b6a2ff',en:'Iris',uk:'Ірис'},
  {value:'#85cddd',en:'Glacier',uk:'Льодовик'},
  {value:'#e6bb79',en:'Amber',uk:'Бурштин'},
  {value:'#e5a6bd',en:'Rose',uk:'Троянда'},
  {value:'#bfe397',en:'Sage',uk:'Шавлія'},
];
export const validAccent = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function accentTokens(color) {
  const rgb = [1,3,5].map(index => parseInt(color.slice(index,index+2),16));
  const linear = rgb.map(v => {const n=v/255; return n<=.04045 ? n/12.92 : ((n+.055)/1.055)**2.4;});
  const luminance = linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
  const text = luminance < .3 ? '#'+rgb.map(v => Math.round(v*.4+255*.6).toString(16).padStart(2,'0')).join('') : color;
  return {'--accent':color,'--accent-text':text,'--accent-contrast':luminance > .179 ? '#17151c' : '#ffffff'};
}
export default function Appearance({t,lang,color,onChange}) {
  const [open,setOpen] = useState(false);
  const ref = useRef();
  const triggerRef = useRef();
  useEffect(() => {
    if (!open) return;
    const close = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') {setOpen(false);triggerRef.current?.focus();} };
    document.addEventListener('pointerdown',close); document.addEventListener('keydown',escape);
    return () => {document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className="appearance-control" ref={ref}><button ref={triggerRef} className={`appearance-trigger ${open ? 'open' : ''}`} title={t.appearance} aria-label={t.appearance} aria-expanded={open} aria-controls="appearance-panel" onClick={() => setOpen(!open)}><Palette size={16}/><span style={{background:color}}/></button>{open && <section id="appearance-panel" className="appearance-popover" aria-label={t.appearance}><div className="appearance-heading"><h3>{t.appearance}</h3><button className="icon-button" aria-label={t.close} onClick={() => {setOpen(false);triggerRef.current?.focus();}}><X size={14}/></button></div><p>{t.appearanceHelp}</p><div className="accent-swatches" role="group" aria-label={t.accentColor}>{colors.map(option => <button key={option.value} aria-label={option[lang]} aria-pressed={color.toLowerCase() === option.value} style={{'--swatch':option.value}} onClick={() => onChange(option.value)}><span>{color.toLowerCase() === option.value && <Check size={15}/>}</span><small>{option[lang]}</small></button>)}</div><label className="custom-accent"><span>{t.customColor}</span><span><code>{color.toUpperCase()}</code><input type="color" aria-label={t.customColor} value={color} onInput={e => onChange(e.target.value)} onChange={e => onChange(e.target.value)}/></span></label><div className="appearance-saved"><Check size={12}/>{t.appearanceSaved}</div></section>}</div>;
}
