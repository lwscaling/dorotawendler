const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ALLOWED_ORIGINS = new Set(['https://dorotawendler.de', 'https://www.dorotawendler.de', 'https://dorotawendler.pages.dev']);
const PROJECTS = new Set(['Neue Website', 'Bestehende Website überarbeiten', 'Persönliche Marke schärfen', 'Grafik, Text oder Print']);
const GOALS = new Set(['Klarer auftreten', 'Mehr passende Anfragen', 'Inhalte besser strukturieren', 'Website selbst pflegen können']);
const TIMINGS = new Set(['So bald wie möglich', 'In den nächsten 2 bis 3 Monaten', 'Später, ich plane gerade']);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Ungültige Anfrage.' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 12_000) return json({ error: 'Die Anfrage ist zu groß.' }, 413);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'Ungültige Formulardaten.' }, 400); }
  if (input.website) return json({ ok: true });

  const name = clean(input.name, 100);
  const email = clean(input.email, 180).toLowerCase();
  const project = clean(input.project, 100);
  const timing = clean(input.timing, 100);
  const note = clean(input.note, 2000);
  const goals = Array.isArray(input.goals) ? input.goals.map((goal) => clean(goal, 100)).filter((goal) => GOALS.has(goal)).slice(0, 4) : [];
  const startedAt = Number(input.startedAt || 0);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !PROJECTS.has(project) || !TIMINGS.has(timing) || !goals.length) return json({ error: 'Bitte prüfen Sie Ihre Angaben.' }, 400);
  if (!startedAt || Date.now() - startedAt < 2500 || Date.now() - startedAt > 7_200_000) return json({ error: 'Bitte öffnen Sie das Formular erneut und versuchen Sie es noch einmal.' }, 400);
  if (!input.turnstileToken || !env.TURNSTILE_SECRET) return json({ error: 'Die Sicherheitsprüfung fehlt.' }, 400);

  const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: input.turnstileToken, remoteip: request.headers.get('CF-Connecting-IP') || undefined }),
  });
  const verified = await verification.json();
  if (!verified.success) return json({ error: 'Die Sicherheitsprüfung ist abgelaufen. Bitte versuchen Sie es erneut.' }, 400);

  let relay;
  try {
    relay = await fetch('https://formsubmit.co/ajax/dorota@dorotawendler.de', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', origin: 'https://dorotawendler.de', referer: 'https://dorotawendler.de/' },
      body: JSON.stringify({
        _subject: `Neue Projektanfrage von ${name}`, _cc: 'info@lwscaling.com', _replyto: email, _template: 'table',
        Name: name, 'E-Mail': email, Projekt: project, Ziele: goals.join(', '), Zeitraum: timing, Nachricht: note || 'Keine weiteren Angaben',
      }),
    });
  } catch {
    console.error({ event: 'inquiry_delivery_unreachable' });
    return json({ error: 'Die Anfrage konnte gerade nicht versendet werden. Bitte versuchen Sie es später erneut.' }, 502);
  }
  const relayResult = await relay.json().catch(() => ({}));
  if (!relay.ok || relayResult.success === 'false' || relayResult.success === false) {
    console.error({ event: 'inquiry_delivery_failed', status: relay.status });
    return json({ error: 'Die Anfrage konnte gerade nicht versendet werden. Bitte versuchen Sie es später erneut.' }, 502);
  }
  console.log({ event: 'inquiry_sent', project, timing });
  return json({ ok: true });
}

export function onRequest() { return json({ error: 'Methode nicht erlaubt.' }, 405); }
