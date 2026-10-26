import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronRight, Copy, Download, FileJson, Fingerprint, FolderOpen, Globe2, Layers3, LoaderCircle, MessageCircle, MoreHorizontal, Plus, ShieldCheck, Sparkles, Sprout, Trash2, Upload, UserRound, WandSparkles, X } from 'lucide-react';
import { blank, emptyProfile, fieldLabels, label, options, validatePreset, localizePreset, validateProfile } from './schema.js';
import { generatePrompt } from './prompt.js';
import { copy } from './i18n.js';
import ProfilesPage, { ProfileAvatar } from './ProfilesPage.jsx';
import Appearance, { validAccent, accentTokens } from './Appearance.jsx';
import ChoiceField from './ChoiceField.jsx';
import './styles.css';

async function api(path, method = 'GET', body) {
  const response = await fetch(`/api/${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}
function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeLocal(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* JSON files remain the durable store when browser storage is unavailable. */ } }
function readDraft() { const draft = readLocal('persona-draft', null); if (!draft) return null; try { return { ...validatePreset({ ...draft, name:draft.name?.trim() || 'Draft' }), name: typeof draft.name === 'string' ? draft.name : '' }; } catch { return null; } }
function download(content, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const safeFilename = name => name.replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0,80) || 'persona';
function Mark({ small = false }) { return <span className={`brand-mark ${small ? 'small' : ''}`}><span /><span /><span /></span>; }
function Field({ label: title, hint, children, className = '' }) { return <label className={`field ${className}`}><span className="field-label">{title}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>; }
function App() {
  const [lang, setLang] = useState(() => readLocal('persona-language', 'en') === 'uk' ? 'uk' : 'en');
  const [outputLang, setOutputLang] = useState(() => readLocal('persona-output-language', 'en') === 'uk' ? 'uk' : 'en');
  const [accent, setAccent] = useState(() => { const value = readLocal('persona-accent', '#b6a2ff'); return validAccent(value) ? value : '#b6a2ff'; });
  const t = copy[lang];
  const tr = (en, uk) => lang === 'uk' ? uk : en;
  const pageFromPath = () => ({ '/profile':'profile', '/presets':'library', '/prompt':'result' }[location.pathname] || 'studio');
  const [page, setPage] = useState(pageFromPath);
  const initialDraft = useRef(readDraft());
  const [preset, setPreset] = useState(() => initialDraft.current || blank);
  const [selectedId, setSelectedId] = useState(() => readLocal('persona-selected', ''));
  const [savedPreset, setSavedPreset] = useState('');
  const [presets, setPresets] = useState([]);
  const [template, setTemplate] = useState(blank);
  const [profile, setProfile] = useState(emptyProfile);
  const [profileDraft, setProfileDraft] = useState(emptyProfile);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState('');
  const [profileTemplate, setProfileTemplate] = useState(emptyProfile);
  const [profileBaseline, setProfileBaseline] = useState(emptyProfile);
  const [profileNameError, setProfileNameError] = useState(false);
  const [profileFileErrors, setProfileFileErrors] = useState([]);
  const [step, setStep] = useState(0);
  const [formEpoch, setFormEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [fileErrors, setFileErrors] = useState([]);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState(null);
  const importRef = useRef();
  const nameRef = useRef();
  const timer = useRef();
  const notify = (message, error = false) => { clearTimeout(timer.current); setToast({ message, error }); timer.current = setTimeout(() => setToast(null), 4500); };
  async function load() {
    setLoading(true); setLoadError(false);
    try {
      const [library, profileLibrary, blankTemplate, blankProfile] = await Promise.all([api('presets'), api('profiles'), api('blank'), api('profiles/blank')]);
      setPresets(library.presets); setFileErrors(library.errors); setTemplate(blankTemplate);
      syncProfiles(profileLibrary); setProfileTemplate(blankProfile);
      const active = profileLibrary.profiles.find(p => p.id === profileLibrary.activeProfileId);
      const initial = active ? withoutId(active) : blankProfile;
      setEditingProfileId(active?.id || ''); setProfileDraft(initial); setProfileBaseline(initial);
      if (!initialDraft.current) setPreset(blankTemplate);
      const saved = library.presets.find(p => p.id === selectedId);
      if (saved) { const { id, ...data } = saved; setSavedPreset(JSON.stringify(localizePreset(data,lang))); }
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { writeLocal('persona-accent',accent); for (const [key,value] of Object.entries(accentTokens(accent))) document.documentElement.style.setProperty(key,value); },[accent]);
  useEffect(() => { document.documentElement.lang = lang; writeLocal('persona-language', lang); }, [lang]);
  useEffect(() => { writeLocal('persona-output-language', outputLang); }, [outputLang]);
  useEffect(() => { if (!loading && !loadError) { writeLocal('persona-draft', preset); writeLocal('persona-selected', selectedId); } }, [preset, selectedId, loading, loadError]);
  const profileDirty = JSON.stringify(profileBaseline) !== JSON.stringify(profileDraft);
  const allFileErrors = [...fileErrors,...profileFileErrors.map(name => `profiles/${name}`)];
  const presetDirty = JSON.stringify(preset) !== savedPreset;
  useEffect(() => {
    const handler = event => { if (profileDirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler);
  }, [profileDirty]);
  useEffect(() => { const pop = () => setPage(pageFromPath()); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  function navigate(next, bypass = false) {
    if (page === 'profile' && profileDirty && !bypass) { setDialog({ type:'profile', next }); return; }
    const path = { studio:'/', profile:'/profile', library:'/presets', result:'/prompt' }[next];
    history.pushState({}, '', path); setPage(next); window.scrollTo({ top:0, behavior:'instant' });
  }
  function changeLanguage(value) { setLang(value); setOutputLang(value); setPreset(current => localizePreset(current,value)); if (savedPreset) { try { setSavedPreset(JSON.stringify(localizePreset(JSON.parse(savedPreset),value))); } catch {} } }
  const update = (key, value) => { setPreset(p => ({ ...p, [key]:value })); if (key === 'name') setNameError(false); };
  function choosePreset(id) {
    if (JSON.stringify(preset) !== JSON.stringify(template) && presetDirty) { setDialog({ type:'load', id }); return; }
    applyPreset(id);
  }
  function applyPreset(id) {
    if (!id) { setPreset({ ...template }); setSelectedId(''); setSavedPreset(''); }
    else { const found = presets.find(p => p.id === id); if (!found) return; const { id: foundId, ...data } = found; const localized = localizePreset(data,lang); setPreset(localized); setSelectedId(foundId); setSavedPreset(JSON.stringify(localized)); }
    setFormEpoch(value => value+1); setStep(0); setNameError(false); if (page !== 'studio') navigate('studio');
  }
  function validName() {
    if (!preset.name.trim()) { setNameError(true); notify(t.nameError, true); navigate('studio'); setTimeout(() => nameRef.current?.focus(), 50); return false; }
    return true;
  }
  async function savePreset(asNew = false) {
    if (!validName()) return;
    setBusy(true);
    try {
      const clean = validatePreset(preset);
      const data = await api(selectedId && !asNew ? `presets/${selectedId}` : 'presets', selectedId && !asNew ? 'PUT' : 'POST', clean);
      const { id, ...saved } = data;
      setPresets(current => [...current.filter(p => p.id !== id), data]); setSelectedId(id); setPreset(saved); setSavedPreset(JSON.stringify(saved)); notify(t.saved);
    } catch (error) { notify(`${t.toastError}: ${error.message}`, true); }
    finally { setBusy(false); }
  }
  function generate() { if (!validName()) return; navigate('result'); }
  function withoutId(item) { const {id,...data} = item; return data; }
  function syncProfiles(library) {
    setProfiles(library.profiles); setActiveProfileId(library.activeProfileId); setProfileFileErrors(library.errors);
    const active = library.profiles.find(item => item.id === library.activeProfileId);
    setProfile(active ? withoutId(active) : {...emptyProfile,inventory:[]});
  }
  function applyUserProfile(id) {
    const item = profiles.find(profile => profile.id === id);
    const data = item ? withoutId(item) : {...profileTemplate,inventory:profileTemplate.inventory.map(item => ({...item}))};
    setEditingProfileId(item?.id || ''); setProfileDraft(data); setProfileBaseline(data); setProfileNameError(false);
  }
  function selectUserProfile(id) {
    if (profileDirty) { setDialog({type:'selectProfile',id}); return; }
    applyUserProfile(id);
  }
  async function saveProfile(asNew = false) {
    if (!profileDraft.name.trim()) { setProfileNameError(true); notify(t.profileNameRequired,true); return; }
    setBusy(true);
    try {
      const clean = validateProfile(profileDraft,{requireName:true});
      const id = editingProfileId && !asNew ? editingProfileId : '';
      const data = await api(id ? `profiles/${encodeURIComponent(id)}` : 'profiles',id ? 'PUT' : 'POST',clean);
      const saved = withoutId(data);
      syncProfiles(await api('profiles')); setEditingProfileId(data.id); setProfileDraft(saved); setProfileBaseline(saved); setProfileNameError(false); notify(t.profileSaved);
    } catch(error) { notify(`${t.toastError}: ${error.message}`,true); }
    finally {setBusy(false);}
  }
  async function activateProfile(id) {
    setBusy(true);
    try { await api('profiles/active','PUT',{activeProfileId:id || null}); syncProfiles(await api('profiles')); notify(id ? t.profileActivated : t.noProfileActive); }
    catch(error) {notify(`${t.toastError}: ${error.message}`,true);}
    finally {setBusy(false);}
  }
  async function deleteUserProfile(id) {
    setBusy(true);
    try {await api(`profiles/${encodeURIComponent(id)}`,'DELETE'); syncProfiles(await api('profiles')); if(editingProfileId === id) applyUserProfile(''); setDialog(null); notify(t.profileDeleted);}
    catch(error) {notify(`${t.toastError}: ${error.message}`,true);}
    finally {setBusy(false);}
  }
  async function importUserProfile(event) {
    const file = event.target.files?.[0]; event.target.value=''; if(!file) return;
    setBusy(true);
    try {if(file.size > 256000) throw new Error(t.profileImportError); const data = validateProfile(JSON.parse(await file.text()),{requireName:true}); await api('profiles','POST',data); syncProfiles(await api('profiles')); notify(t.profileImported);}
    catch(error) {notify(`${t.profileImportError} ${error.message}`,true);}
    finally {setBusy(false);}
  }
  async function importPreset(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 256000) throw new Error(t.fileImportError);
      const data = validatePreset(JSON.parse(await file.text()));
      const stored = await api('presets', 'POST', data); setPresets(current => [...current, stored]); notify(t.imported);
    } catch (error) { notify(`${t.fileImportError} ${error.message}`, true); }
    finally { setBusy(false); }
  }
  async function deletePreset(id) {
    setBusy(true);
    try { await api(`presets/${id}`, 'DELETE'); setPresets(current => current.filter(p => p.id !== id)); if (selectedId === id) { setSelectedId(''); setSavedPreset(''); } setDialog(null); notify(t.deleted); }
    catch (error) { notify(`${t.toastError}: ${error.message}`, true); }
    finally { setBusy(false); }
  }
  const prompt = generatePrompt(preset, profile, outputLang);
  const words = prompt.trim().split(/\s+/).length;
  const completion = ['characterName','archetype','role','tone','intensity','description','questionStyle','initiative','responseLength','challenge','support','goals','setting','rules','vocabulary','opening','boundaries'].filter(key => preset[key]).length;
  const fieldTitle = key => fieldLabels[key][lang === 'uk' ? 1 : 0];
  const select = key => <ChoiceField key={`${key}-${formEpoch}`} title={fieldTitle(key)} value={preset[key]} choices={options[key]} lang={lang} t={t} onChange={value => update(key,value)}/>;
  const textarea = (key, placeholder, rows = 4) => <Field label={fieldTitle(key)} key={key}><textarea rows={rows} value={preset[key]} maxLength={12000} placeholder={placeholder} onChange={e => update(key,e.target.value)} /></Field>;
  const slider = key => <div className="trait" key={key}><div className="trait-label"><label htmlFor={`trait-${key}`}>{fieldTitle(key)}</label><span>{preset[key]}<span>/10</span></span></div><input id={`trait-${key}`} aria-label={fieldTitle(key)} type="range" min="1" max="10" value={preset[key]} style={{ '--progress': `${(preset[key]-1)*100/9}%` }} onChange={e => update(key,Number(e.target.value))} /><div className="range-labels"><span>{t.low}</span><span>{t.high}</span></div></div>;
  const sections = [ { title:t.sectionPersonality, sub:t.sectionPersonalitySub, icon:Fingerprint }, { title:t.sectionConversation, sub:t.sectionConversationSub, icon:MessageCircle }, { title:t.sectionWorld, sub:t.sectionWorldSub, icon:Globe2 }, { title:t.sectionDetails, sub:t.sectionDetailsSub, icon:Sparkles } ];
  const navItems = [{ id:'studio', text:t.studio, icon:WandSparkles }, { id:'profile', text:t.profile, icon:UserRound }, { id:'library', text:t.library, icon:Layers3 }];
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); notify(t.toastCopied); setTimeout(() => setCopied(false), 2500); }
    catch { notify(tr('Clipboard access is unavailable. Download the prompt or select its text to copy.', 'Буфер обміну недоступний. Завантажте промпт або виділіть текст і скопіюйте.'), true); }
  }
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" onClick={e => { e.preventDefault(); navigate('studio'); }}><Mark /><span>persona<span className="brand-period">.</span></span></a>
      <div className="workspace-label">{t.local}<span>01</span></div>
      <nav aria-label={tr('Main navigation','Головна навігація')}>{navItems.map(item => <button key={item.id} className={`nav-item ${(page === item.id || page === 'result' && item.id === 'studio') ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={18} /><span>{item.text}</span>{item.id === 'library' ? <span className="nav-count">{presets.length}</span> : item.id === 'studio' ? <span className="nav-dot" /> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={21} /><h4>{t.private}</h4><p>{t.privateText}</p><div className="local-indicator"><i />{t.localTag}</div></div><div className="sidebar-signature"><span>PERSONA STUDIO</span><span>v1.0</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span>{t.home}</span><ChevronRight size={13}/><strong>{page === 'studio' ? t.new : page === 'result' ? t.outputPage : t[page]}</strong></div><div className="topbar-actions"><Appearance t={t} lang={lang} color={accent} onChange={setAccent}/><span className="offline"><i />{t.localTag}</span><div className="language-switch" aria-label={t.language}><Globe2 size={14}/><button aria-pressed={lang === 'en'} className={lang === 'en' ? 'selected' : ''} onClick={() => changeLanguage('en')}>EN</button><span>/</span><button aria-pressed={lang === 'uk'} className={lang === 'uk' ? 'selected' : ''} onClick={() => changeLanguage('uk')}>UA</button></div></div></header>
      <main>
        {loading ? <div className="loading"><LoaderCircle className="spin"/><p>{t.loading}</p></div> : loadError ? <div className="error-state"><FolderOpen size={36}/><h2>{t.loadError}</h2><button className="button primary" onClick={load}>{t.retry}</button></div> : <>
        {allFileErrors.length > 0 && <div className="file-warning"><FileJson size={18}/><span>{t.errorFiles} {allFileErrors.join(', ')}. {t.unknown}</span><button aria-label={t.dismiss} onClick={() => {setFileErrors([]);setProfileFileErrors([]);}}><X size={16}/></button></div>}
        {page === 'studio' && <>
          <div className="page-intro"><div><p className="eyebrow"><span />{t.eyebrow}</p><h1>{t.title}<br/><span>{t.titleAccent}</span></h1><p className="page-subtitle">{t.subtitle}</p></div><div className="intro-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><Sprout size={56} strokeWidth={1}/><span className="art-dot one"/><span className="art-dot two"/><span className="art-cross">+</span></div></div>
          <div className="studio-toolbar"><div className="toolbar-heading"><span className="icon-box"><WandSparkles size={19}/></span><div><h2>{t.builder}</h2><p>{t.builderSub}</p></div></div><div className="preset-controls"><button className="button icon-only" title={t.clear} aria-label={t.clear} onClick={() => choosePreset('')}><Plus size={17}/></button><div className="preset-picker select-wrap"><Layers3 size={16}/><select aria-label={t.loadPreset} value={selectedId} onChange={e => choosePreset(e.target.value)}><option value="">{t.loadPreset}</option>{presets.map(p => <option value={p.id} key={p.id}>{localizePreset(p,lang).name}</option>)}</select><ChevronDown size={14}/></div></div></div>
          <div className="builder-layout"><section className="builder-panel">
            <div className="step-tabs" role="tablist" aria-label={t.builder}>{sections.map((section,i) => <button key={i} role="tab" aria-selected={step === i} className={step === i ? 'active' : ''} onClick={() => setStep(i)}><span className="step-number">{step > i ? <Check size={12}/> : `0${i+1}`}</span><span>{section.title}</span></button>)}</div>
            <div className="builder-content"><div className={`preset-name ${nameError ? 'invalid' : ''}`}><div className="name-label"><label htmlFor="preset-name">{t.name}<span>*</span></label><span>{t.required}</span></div><input ref={nameRef} id="preset-name" value={preset.name} maxLength={100} placeholder={t.namePlaceholder} onChange={e => update('name',e.target.value)} aria-invalid={nameError} aria-required="true"/>{nameError && <small role="alert">{t.nameError}</small>}</div>
            <div className="section-title"><div><h3>{sections[step].title}</h3><p>{sections[step].sub}</p></div><span className="section-icon">{React.createElement(sections[step].icon,{size:22,strokeWidth:1.5})}</span></div>
            <div className="form-sections" role="tabpanel" key={step}>
            {step === 0 && <><div className="fields-grid"><Field label={fieldTitle('characterName')}><input value={preset.characterName} maxLength={12000} placeholder={t.characterPlaceholder} onChange={e => update('characterName',e.target.value)}/></Field>{select('archetype')}{select('role')}{select('tone')}</div><div className="section-divider"/><div className="subheading"><h4>{t.traits}</h4><p>{t.traitsHelp}</p></div><div className="traits-grid">{['warmth','curiosity','directness','humor'].map(slider)}</div><details className="advanced-traits"><summary><span><Fingerprint size={16}/>{t.bigFive}</span><Plus size={16}/></summary><p>{t.bigFiveHelp}</p><div className="traits-grid">{['openness','conscientiousness','extraversion','agreeableness','emotionalStability'].map(slider)}</div></details></>}
            {step === 1 && <><div className="fields-grid">{['intensity','questionStyle','initiative','responseLength','challenge','support'].map(select)}</div><div className="tip"><MessageCircle size={18}/><p>{tr('Good conversation has room to breathe. Your character will ask one question at a time and adapt to your pace.', 'У хорошій розмові є простір для думок. Персонаж ставитиме по одному питанню та підлаштовуватиметься під ваш темп.')}</p></div></>}
            {step === 2 && <div className="stack">{textarea('goals',t.goalsPlaceholder)}{textarea('setting',t.settingPlaceholder)}{textarea('rules',t.rulesPlaceholder)}<p className="soft-note"><ShieldCheck size={15}/>{t.guard}</p></div>}
            {step === 3 && <div className="stack">{textarea('description',t.descriptionPlaceholder)}<Field label={fieldTitle('vocabulary')}><input value={preset.vocabulary} maxLength={12000} onChange={e => update('vocabulary',e.target.value)} placeholder={t.vocabPlaceholder}/></Field>{textarea('opening',t.openingPlaceholder,3)}{textarea('boundaries',t.boundariesPlaceholder,3)}<div className="include-profile"><div><h4>{t.include}</h4><p>{t.includeHelp}</p></div><button type="button" role="switch" aria-label={t.include} aria-checked={preset.includeProfile} className={`toggle ${preset.includeProfile ? 'on' : ''}`} onClick={() => update('includeProfile',!preset.includeProfile)}><span/></button></div></div>}
            </div></div>
            <div className="step-footer"><span>{t.step} <b>0{step+1}</b> {t.of} 04</span><div>{step > 0 && <button className="button text" onClick={() => setStep(step-1)}><ArrowLeft size={15}/>{t.back}</button>}{step < 3 ? <button className="button secondary" onClick={() => setStep(step+1)}>{t.next}<ArrowRight size={15}/></button> : <button className="button secondary" onClick={generate}>{t.preview}<ArrowRight size={15}/></button>}</div></div>
          </section><aside className="snapshot-column"><div className="snapshot-card"><div className="snapshot-top"><span><i/>{t.live}</span><Sparkles size={16}/></div><div className="avatar-stage"><div className="avatar-orbit"/><div className="persona-avatar"><Mark/></div><span className="avatar-spark a">✦</span><span className="avatar-spark b">+</span></div><h2>{preset.characterName || <>{t.untitled}<br/><em>{t.untitledAccent}</em></>}</h2><p className="snapshot-description">{preset.description || (preset.archetype ? label('archetype',preset.archetype,lang) : t.snapshotText)}</p><div className="character-tags">{preset.role && <span>{label('role',preset.role,lang)}</span>}{preset.tone && <span>{label('tone',preset.tone,lang)}</span>}{!preset.role && !preset.tone && <span><Sprout size={12}/>{t.noRole}</span>}</div><div className="snapshot-divider"/><p className="micro-label">{t.traitSummary}</p><div className="mini-traits">{['warmth','curiosity','directness'].map(key => <div key={key}><span>{fieldTitle(key)}</span><div>{Array.from({length:10},(_,index) => index+1).map(n => <i key={n} className={n <= preset[key] ? 'filled' : ''}/>)}</div></div>)}</div><div className="snapshot-active-select"><label><span>{t.activeProfile}</span><select aria-label={t.activeProfile} disabled={busy} value={activeProfileId || ''} onChange={e => activateProfile(e.target.value)}><option value="">{t.useNoProfile}</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.avatar ? `${item.avatar} ` : ''}{item.name}</option>)}</select></label></div><div className="snapshot-profile"><ProfileAvatar profile={profile}/><div><b>{preset.includeProfile ? t.profileIncluded : t.profileExcluded}</b><span>{profile.name || t.profileEmpty}</span></div><button aria-label={t.editProfile} onClick={() => navigate('profile')}><ArrowRight size={15}/></button></div></div><div className="ready-note"><span className="tiny-spark"><Sparkles size={18}/></span><h4>{t.ready}</h4><p>{t.readyText}</p></div></aside></div>
          <div className="action-bar"><div className="output-language"><Globe2 size={17}/><div><span>{t.output}</span><select title={t.outputHelp} aria-label={t.output} value={outputLang} onChange={e => setOutputLang(e.target.value)}><option value="en">English</option><option value="uk">Українська</option></select></div></div><div className="action-buttons">{selectedId && <button className="button icon-only" title={t.duplicate} aria-label={t.duplicate} disabled={busy} onClick={() => savePreset(true)}><Copy size={17}/></button>}<button className="button secondary" disabled={busy} onClick={() => savePreset()}>{busy ? <LoaderCircle className="spin" size={16}/> : <FolderOpen size={16}/>} {selectedId ? t.update : t.save}</button><button className="button primary" onClick={generate}><WandSparkles size={17}/>{t.generate}<ArrowRight size={16}/></button></div></div><p className="bottom-note"><ShieldCheck size={13}/>{t.localFooter}<span>·</span>{completion}/17 {t.settings}</p>
        </>}
        {page === 'profile' && <ProfilesPage t={t} profiles={profiles} activeId={activeProfileId} editingId={editingProfileId} draft={profileDraft} setDraft={setProfileDraft} dirty={profileDirty} nameError={profileNameError} busy={busy} onSelect={selectUserProfile} onSave={saveProfile} onActivate={activateProfile} onDelete={item => setDialog({type:'deleteProfile',id:item.id,name:item.name,active:item.id === activeProfileId})} onImport={importUserProfile} onExport={item => download(JSON.stringify(withoutId(item),null,2),`${safeFilename(item.name)}.json`)}/>}
        {page === 'library' && <><div className="page-intro compact library-intro"><div><p className="eyebrow"><span/>{t.library.toUpperCase()}</p><h1>{t.libraryTitle}</h1><p className="page-subtitle">{t.librarySub}</p></div><button className="button primary" onClick={() => choosePreset('')}><Plus size={17}/>{t.create}</button></div><div className="library-tools"><span>{presets.length} {t.presets}</span><button className="button secondary small-button" disabled={busy} onClick={() => importRef.current.click()}><Upload size={15}/>{t.import}</button></div><div className="preset-grid">{presets.map((sourceItem,i) => { const item = localizePreset(sourceItem,lang); return <article className="preset-card" key={item.id}><div className="preset-card-top"><span className={`preset-avatar variant-${i%3}`}>{item.archetype === 'archmage' ? <Sparkles/> : item.archetype === 'coach' ? <Sprout/> : <MessageCircle/>}</span><div className="card-menu"><button className="icon-button" aria-label={`${t.export}: ${item.name}`} title={t.export} onClick={() => { const {id,...data} = item; download(JSON.stringify(data,null,2),`${safeFilename(item.name)}.json`); }}><Download size={16}/></button><button className="icon-button danger-hover" aria-label={`${t.delete}: ${item.name}`} onClick={() => setDialog({type:'delete',id:item.id,name:item.name})}><Trash2 size={16}/></button></div></div><h2>{item.name}</h2><span className="preset-archetype">{label('archetype',item.archetype,lang) || t.unnamed}</span><p>{item.description || item.goals || t.snapshotText}</p><div className="preset-card-footer"><span><FileJson size={13}/><code title={`data/presets/${item.id}.json`}>{item.id}.json</code></span><button onClick={() => choosePreset(item.id)}>{t.use}<ArrowRight size={15}/></button></div></article>; })}<button className="add-preset-card" onClick={() => choosePreset('')}><span><Plus size={25}/></span><h3>{t.create}</h3><p>{t.blank}</p></button></div><div className="files-panel"><FolderOpen size={24}/><div><h4>{t.files}</h4><p>{t.filesHelp}</p><code>data/blank.json <span>·</span> data/presets/*.json <span>·</span> data/blank-profile.json <span>·</span> data/profiles/*.json</code></div></div></>}
        {page === 'result' && <><div className="result-intro"><p className="eyebrow"><span/>{t.resultEyebrow}</p><div className="result-symbol"><Sparkles size={28}/></div><h1>{t.resultTitle}</h1><p className="page-subtitle">{t.resultSub}</p></div><section className="prompt-result"><div className="result-toolbar"><div><span className="micro-label">{t.resultLabel}</span><h2>{localizePreset(preset,outputLang).name || t.unnamed}<span>{outputLang === 'en' ? 'EN' : 'UA'}</span></h2></div><button className="button primary" onClick={copyPrompt}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? t.copied : t.copy}</button></div><pre className="prompt-text">{prompt}</pre><div className="result-footer"><span>{words.toLocaleString(lang)} {t.words}<i/> {prompt.length.toLocaleString(lang)} {t.chars}</span><span><ShieldCheck size={13}/>{t.localTag}</span></div></section><div className="result-actions"><button className="button secondary" onClick={() => navigate('studio')}><ArrowLeft size={16}/>{t.edit}</button><div><button className="button secondary" onClick={() => download(prompt,`${safeFilename(preset.name)}.txt`,'text/plain;charset=utf-8')}><ArrowDownToLine size={16}/>{t.download}</button><button className="button secondary" disabled={busy} onClick={() => savePreset()}><FolderOpen size={16}/>{selectedId ? t.update : t.save}</button></div></div><p className="bottom-note"><ShieldCheck size={14}/>{t.resultHint}</p></>}
        </>}
      </main><footer className="app-footer"><span>{tr('Made for meaningful conversations.','Створено для змістовних розмов.')}</span><span><span className="footer-dot"/> PERSONA STUDIO</span></footer>
    </div>
    <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importPreset}/>
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role="status">{toast.error ? <X size={17}/> : <Check size={17}/>}<span>{toast.message}</span><button aria-label={t.dismiss} onClick={() => setToast(null)}><X size={14}/></button></div>}
    {dialog && <div className="modal-backdrop" onClick={() => !busy && setDialog(null)}><Dialog dialog={dialog} t={t} busy={busy} onClose={() => setDialog(null)} onConfirm={() => { if (dialog.type === 'delete') deletePreset(dialog.id); else if (dialog.type === 'deleteProfile') deleteUserProfile(dialog.id); else if (dialog.type === 'selectProfile') {applyUserProfile(dialog.id); setDialog(null);} else if (dialog.type === 'load') { applyPreset(dialog.id); setDialog(null); } else { setProfileDraft(profileBaseline); navigate(dialog.next,true); setDialog(null); } }}/></div>}
  </div>;
}
function Dialog({dialog,t,busy,onClose,onConfirm}) {
  const ref = useRef();
  const deleting = dialog.type === 'delete' || dialog.type === 'deleteProfile';
  const profileChange = dialog.type === 'profile' || dialog.type === 'selectProfile';
  useEffect(() => { const before = document.activeElement; ref.current.focus(); const key = e => { if(e.key === 'Escape' && !busy) onClose(); if(e.key === 'Tab') { const buttons = ref.current.querySelectorAll('button'); const first = buttons[0],last = buttons[buttons.length-1]; if(e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if(!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }; document.addEventListener('keydown',key); return () => { document.removeEventListener('keydown',key); before?.focus(); }; }, [busy]);
  return <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="dialog" onClick={e => e.stopPropagation()}><span className="dialog-icon">{deleting ? <Trash2/> : <FileJson/>}</span><h2 id="dialog-title">{deleting ? t.deleteConfirm : profileChange ? t.restore : (dialog.id ? t.restore : t.resetConfirm)}</h2><p>{deleting ? dialog.name : profileChange ? t.restoreText : t.edited}</p>{dialog.type === 'deleteProfile' && dialog.active && <p>{t.deleteActiveWarning}</p>}<div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={onClose}>{t.cancel}</button><button className={`button ${deleting ? 'destructive' : 'primary'}`} disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle className="spin" size={15}/> : null}{deleting ? t.confirm : profileChange ? t.leave : t.discard}</button></div></section>;
}
createRoot(document.getElementById('root')).render(<App/>);
