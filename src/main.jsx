import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowDownRight, Menu, X } from 'lucide-react';
import './styles.css';
import { getLegalPage, LegalPage } from './legal.jsx';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const projects = [
  ['Gynäkologische Praxis', 'Dr. med. Marion Rütten', '/assets/project-1.png'],
  ['Versicherungen & Finanzen', 'Thorsten Eichsteller', '/assets/project-2.png'],
  ['Werkstatt', 'Autoklinik Karlsruhe', '/assets/project-3.png'],
  ['Webalbum', 'Photo Album', '/assets/project-4.png'],
  ['Interaktive Präsentation', 'Kunsthalle Karlsruhe', '/assets/project-5.png'],
  ['Künstlerportfolio', 'Wolfgang Wendler', '/assets/project-6.png'],
];

const services = [
  ['Positionierung', 'Gemeinsam finden wir heraus, was Sie besonders macht und wie Ihre Kundinnen und Kunden das sofort verstehen.'],
  ['Webdesign', 'Ihre Website soll gut aussehen, sich leicht anfühlen und vor allem wirklich zu Ihnen passen.'],
  ['Inhalt & Sprache', 'Ich bringe Texte, Bilder und Gestaltung so zusammen, dass alles dieselbe Geschichte erzählt.'],
  ['Umsetzung', 'Ich begleite Sie von der ersten Idee bis zum fertigen Auftritt. Persönlich, verständlich und zuverlässig.'],
];

const statementWords = 'Eine gute Website klingt nach Ihnen und macht es anderen leicht, Vertrauen zu fassen.'.split(' ');

const inquirySteps = [
  { title: 'Wobei kann ich Sie unterstützen?', copy: 'Wählen Sie einfach aus, was Ihrem Projekt am nächsten kommt.' },
  { title: 'Wann möchten Sie starten?', copy: 'Eine grobe Einschätzung reicht vollkommen.' },
  { title: 'Wie kann ich Sie erreichen?', copy: 'Ein paar Angaben genügen. Dorota meldet sich persönlich per E-Mail.' }
];

function InquiryModal({ open, onClose }) {
  const modalRef = useRef();
  const turnstileRef = useRef();
  const widgetRef = useRef();
  const [step, setStep] = useState(0);
  const [project, setProject] = useState('');
  const [timing, setTiming] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [startedAt, setStartedAt] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setStartedAt(Date.now());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const context = gsap.context(() => {
      gsap.fromTo('.inquiry-backdrop', { opacity: 0 }, { opacity: 1, duration: .28 });
      gsap.fromTo('.inquiry-panel', { y: 35, scale: .97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: .5, ease: 'power3.out' });
    }, modalRef);
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); context.revert(); };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    setStep(0); setProject(''); setTiming('');
    setName(''); setEmail(''); setNote(''); setWebsite('');
    setTurnstileToken(''); setSubmitting(false); setSent(false); setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = modalRef.current?.querySelector('.inquiry-panel');
    panel?.scrollTo({ top: 0, behavior: 'smooth' });
    gsap.fromTo('.inquiry-step-content', { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: .35, ease: 'power2.out' });
    window.setTimeout(() => modalRef.current?.querySelector('#inquiry-title')?.focus(), 60);
  }, [step, open]);

  useEffect(() => {
    if (!open || step !== 2 || sent) return;
    let cancelled = false;
    let timer;
    const render = () => {
      if (cancelled || !turnstileRef.current || !window.turnstile) return false;
      widgetRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: '0x4AAAAAAEScPpy8Pm5ZW3Pm', theme: 'light', size: 'flexible', language: 'de',
        callback: setTurnstileToken,
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      });
      return true;
    };
    if (!render()) timer = window.setInterval(() => { if (render()) window.clearInterval(timer); }, 150);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (widgetRef.current !== undefined && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = undefined;
    };
  }, [open, step, sent]);

  if (!open) return null;
  const next = () => {
    if (step === 0 && !project) return setError('Bitte wählen Sie eine Projektart aus.');
    if (step === 1 && !timing) return setError('Bitte wählen Sie einen ungefähren Zeitraum aus.');
    setError(''); setStep((current) => Math.min(current + 1, 2));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setError('Bitte geben Sie Ihren Namen und eine gültige E-Mail-Adresse ein.');
    if (!turnstileToken) return setError('Bitte schließen Sie die Sicherheitsprüfung ab.');
    setError(''); setSubmitting(true);
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project, timing, name, email, note, website, turnstileToken, startedAt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Die Anfrage konnte nicht versendet werden.');
      setSent(true);
    } catch (submissionError) {
      setError(submissionError.message || 'Die Anfrage konnte nicht versendet werden.');
      setTurnstileToken('');
      if (widgetRef.current !== undefined && window.turnstile) window.turnstile.reset(widgetRef.current);
    } finally { setSubmitting(false); }
  };
  const options = (items, value, setter) => <div className="choice-grid">{items.map((item) => {
    const selected = value === item;
    return <button type="button" className={`choice ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => setter(item)} key={item}>{item}</button>;
  })}</div>;

  return <div className="inquiry-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="inquiry-title">
    <button className="inquiry-backdrop" aria-label="Anfrage schließen" onClick={onClose}/>
    <section className="inquiry-panel">
      <header className="inquiry-header"><a className="wordmark" href="/">Dorota Wendler</a><button className="modal-close" onClick={onClose} aria-label="Anfrage schließen"><X size={20}/></button></header>
      <div className="progress" aria-label={`Schritt ${step + 1} von 3`}><span style={{width:`${((step + 1) / 3) * 100}%`}}/></div>
      {sent ? <div className="inquiry-success" role="status"><p className="step-count">Anfrage versendet</p><h2>Vielen Dank<br/>für Ihre Anfrage.</h2><p>Dorota schaut sich Ihre Angaben persönlich an und meldet sich innerhalb von zwei Werktagen per E-Mail bei Ihnen.</p><button type="button" className="button primary" onClick={onClose}>Schließen</button></div> : <form className="inquiry-form" onSubmit={submit}>
        <div className="inquiry-step-content" key={step}>
          <p className="step-count">Schritt {step + 1} von 3</p><h2 id="inquiry-title" tabIndex="-1">{inquirySteps[step].title}</h2><p className="step-copy">{inquirySteps[step].copy}</p>
          {step === 0 && options(['Neue Website', 'Bestehende Website überarbeiten', 'Branding und Website', 'Grafik, Text oder Print', 'Ich bin noch nicht sicher'], project, setProject)}
          {step === 1 && <div className="timeline-choices">{options(['So bald wie möglich', 'In den nächsten 2 bis 3 Monaten', 'Später im Jahr', 'Ich bin zeitlich flexibel'], timing, setTiming)}</div>}
          {step === 2 && <><div className="contact-fields"><label>Name<input value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" required/></label><label>E-Mail-Adresse<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required/></label><label className="full-field">Erzählen Sie mir kurz von Ihrem Projekt <span className="optional-label">(optional)</span><textarea value={note} onChange={(e)=>setNote(e.target.value)} rows="4" placeholder="Was möchten Sie verändern, neu aufbauen oder erreichen? Ein oder zwei Sätze reichen." maxLength="2000"/></label><label className="honeypot" aria-hidden="true">Website<input value={website} onChange={(e)=>setWebsite(e.target.value)} tabIndex="-1" autoComplete="off"/></label></div><div className="turnstile-wrap" ref={turnstileRef}/><p className="privacy-note">Mit dem Absenden werden Ihre Angaben zur Bearbeitung Ihrer Anfrage übermittelt. Mehr dazu in der <a href="/datenschutz" target="_blank" rel="noreferrer">Datenschutzerklärung</a>.</p></>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <footer className="inquiry-actions">{step > 0 ? <button type="button" className="back-button" onClick={()=>{setError('');setStep(step-1)}}>Zurück</button> : <span/>}{step < 2 ? <button type="button" className="button primary" onClick={next}>Weiter</button> : <button type="submit" className="button primary" disabled={submitting}>{submitting ? 'Wird versendet…' : 'Anfrage senden'}</button>}</footer>
      </form>}
    </section>
  </div>;
}

function App() {
  const root = useRef();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const openInquiry = () => { setMenuOpen(false); setInquiryOpen(true); };

  useGSAP(() => {
    gsap.from('.hero-word', { yPercent: 105, stagger: .09, duration: 1.15, ease: 'power4.out' });
    gsap.from('.hero-visual', { scale: .88, opacity: 0, duration: 1.4, delay: .25, ease: 'power3.out' });
    gsap.utils.toArray('.reveal').forEach((el) => gsap.from(el, {
      y: 70, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 86%' }
    }));
    gsap.utils.toArray('.project-image').forEach((el) => gsap.fromTo(el,
      { scale: .82, opacity: .35 },
      { scale: 1, opacity: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 92%', end: 'center 55%', scrub: true } }
    ));
    gsap.fromTo('.statement-word',
      { opacity: .1 },
      { opacity: 1, stagger: .08, ease: 'none', scrollTrigger: { trigger: '.statement', start: 'top 72%', end: 'bottom 58%', scrub: true } }
    );
    const desktop = gsap.matchMedia();
    desktop.add('(min-width: 901px)', () => ScrollTrigger.create({ trigger: '.work-layout', start: 'top 12%', end: 'bottom 78%', pin: '.work-intro', pinSpacing: false }));
    return () => desktop.revert();
  }, { scope: root });

  return <main ref={root} className="page" id="main-content">
    <a className="skip-link" href="#main-content">Direkt zum Inhalt</a>
    <nav className="nav shell">
      <a className="wordmark" href="/" aria-label="Startseite neu laden">Dorota Wendler</a>
      <div className="nav-links">
        <a href="#expertise">Expertise</a><a href="#work">Arbeiten</a><a href="#contact">Kontakt</a>
      </div>
      <button className="button primary nav-cta" onClick={openInquiry}>Projekt besprechen <ArrowDownRight size={17}/></button>
      <button className="menu-btn" onClick={() => setMenuOpen((current) => !current)} aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} aria-controls="mobile-navigation">{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
      {menuOpen && <div className="mobile-menu" id="mobile-navigation"><a onClick={() => setMenuOpen(false)} href="#expertise">Expertise</a><a onClick={() => setMenuOpen(false)} href="#work">Arbeiten</a><a onClick={() => setMenuOpen(false)} href="#contact">Kontakt</a><button className="button primary" onClick={openInquiry}>Projekt besprechen <ArrowDownRight size={16}/></button></div>}
    </nav>

    <header id="top" className="hero shell">
      <div className="hero-copy">
        <p className="eyebrow">Personal Branding & Webdesign · Karlsruhe</p>
        <h1 aria-label="Ihr Geschäft. Nur persönlicher.">
          <span className="line"><span className="hero-word">Ihr Geschäft.</span></span>
          <span className="line serif"><span className="hero-word">Nur persönlicher.</span></span>
        </h1>
        <p className="hero-lead">Ich entwickle digitale Auftritte die nach Ihnen aussehen. Klar gestaltet, eigenständig und mit viel Liebe zum Detail.</p>
        <div className="hero-actions"><button className="button primary" onClick={openInquiry}>Projekt besprechen <ArrowDownRight size={18}/></button><a className="button secondary" href="#work">Projekte ansehen</a></div>
      </div>
      <div className="hero-visual">
        <img className="hero-studio" src="/assets/hero-studio-v2.png" alt="Offener Laptop in einem ruhigen Designstudio" fetchPriority="high" decoding="async"/>
        <p className="studio-note">Ideen werden sichtbar.<br/>Marken werden spürbar.</p>
      </div>
    </header>

    <section className="statement shell">
      <p className="eyebrow">Was Ihre Website leisten soll</p>
      <h2>{statementWords.map((word, i) => <span className="statement-word" key={`${word}-${i}`}>{word}{' '}</span>)}</h2>
    </section>

    <section id="expertise" className="services shell">
      <div className="section-heading reveal"><p className="eyebrow">Was ich Ihnen abnehme</p><h2>Von der Idee<br/><em>bis zur Website.</em></h2><p>Sie bringen Ihr Wissen und Ihre Geschichte mit. Ich höre zu, sortiere, gestalte und setze um. So entsteht ein Auftritt, den Sie gerne zeigen.</p></div>
      <div className="service-grid">
        {services.map((service, i) => <article key={service[0]} className={`service-card s${i+1} reveal`}>
          <div><h3>{service[0]}</h3><p>{service[1]}</p></div>
        </article>)}
      </div>
    </section>

    <section id="work" className="work shell">
      <div className="work-layout">
        <div className="work-intro"><p className="eyebrow">Ein Blick auf meine Arbeiten</p><h2>Arbeit, die<br/><em>Charakter zeigt.</em></h2><p>Jedes Projekt ist anders, weil auch jeder Mensch und jedes Unternehmen etwas Eigenes mitbringt.</p></div>
        <div className="project-list">
          {projects.map((project) => <article className="project-card" key={project[1]}>
            <div className="project-image"><img src={project[2]} alt={`${project[0]}, ${project[1]}`} loading="lazy" decoding="async"/></div>
            <div className="project-meta"><div><p>{project[0]}</p><h3>{project[1]}</h3></div></div>
          </article>)}
        </div>
      </div>
    </section>

    <section className="about shell reveal">
      <div className="about-image"><img src="/assets/dorota-about-v2.png" alt="Dorota Wendler, Webdesignerin aus Karlsruhe" loading="lazy" decoding="async"/></div>
      <div className="about-copy"><p className="eyebrow">Lernen wir uns kennen</p><h2>Hallo, ich bin Dorota.</h2><p>Ich bin freiberufliche Webdesignerin aus Karlsruhe. Ich höre gerne genau hin und entwickle Lösungen, die wirklich zu den Menschen dahinter passen.</p><p>Bei mir sprechen Sie immer direkt mit der Person, die Ihr Projekt gestaltet. Ich begleite Sie von den ersten Gedanken über Text und Design bis zur fertigen Website.</p><button className="button primary" onClick={openInquiry}>Projekt besprechen <ArrowDownRight size={17}/></button></div>
    </section>

    <section id="contact" className="contact">
      <div className="shell contact-inner reveal"><p className="eyebrow">Eine erste Idee reicht</p><h2>Was möchten Sie<br/><em>verändern?</em></h2><p className="contact-copy">Erzählen Sie mir kurz von Ihrem Projekt. Ich melde mich persönlich und sage Ihnen ehrlich, wie ich helfen kann.</p><div className="contact-row"><button className="button primary" onClick={openInquiry}>Projekt besprechen <ArrowDownRight/></button><div><a href="mailto:dorota@dorotawendler.de">dorota@dorotawendler.de</a></div></div></div>
      <footer className="shell"><a className="wordmark inverse" href="/">Dorota Wendler</a><p>Personal Branding & Webdesign aus Karlsruhe</p><div><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><a href="/nutzungsbedingungen">Nutzungsbedingungen</a></div></footer>
    </section>
    <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)}/>
  </main>
}

const legalPage = getLegalPage(window.location.pathname);
createRoot(document.getElementById('root')).render(legalPage ? <LegalPage page={legalPage}/> : <App/>);
