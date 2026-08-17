const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const ALLOWED_ORIGINS = new Set(['https://dorotawendler.de', 'https://www.dorotawendler.de', 'https://dorotawendler.pages.dev']);
const PROJECTS = new Set(['Neue Website', 'Bestehende Website überarbeiten', 'Branding und Website', 'Grafik, Text oder Print', 'Ich bin noch nicht sicher']);
const TIMINGS = new Set(['So bald wie möglich', 'In den nächsten 2 bis 3 Monaten', 'Später im Jahr', 'Ich bin zeitlich flexibel']);
const json = (data, status = 200) => {
  const payload = typeof data.success === 'boolean' ? data : { success: status < 400 && !data.error, ...data };
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
};
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
  const startedAt = Number(input.startedAt || 0);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !PROJECTS.has(project) || !TIMINGS.has(timing)) return json({ error: 'Bitte prüfen Sie Ihre Angaben.' }, 400);
  if (!startedAt || Date.now() - startedAt < 2500 || Date.now() - startedAt > 7_200_000) return json({ error: 'Bitte öffnen Sie das Formular erneut und versuchen Sie es noch einmal.' }, 400);
  if (!input.turnstileToken || !env.TURNSTILE_SECRET) return json({ error: 'Die Sicherheitsprüfung fehlt.' }, 400);

  let verified;
  try {
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: input.turnstileToken, remoteip: request.headers.get('CF-Connecting-IP') || undefined }),
    });
    if (!verification.ok || !verification.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new Error('invalid verification response');
    verified = await verification.json();
  } catch {
    console.error({ event: 'turnstile_verification_unreachable' });
    return json({ success: false, error: 'Die Sicherheitsprüfung ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.' }, 502);
  }
  if (!verified.success) return json({ error: 'Die Sicherheitsprüfung ist abgelaufen. Bitte versuchen Sie es erneut.' }, 400);

  let relay;
  try {
    relay = await fetch('https://formsubmit.co/ajax/157d3ce329195da1d307fb2c3740f5e9', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', origin: 'https://dorotawendler.de', referer: 'https://dorotawendler.de/' },
      body: JSON.stringify({
        _subject: `Neue Projektanfrage für Dorota von ${name}`, _cc: 'dorota@dorotawendler.de', _replyto: email, _template: 'table',
        Name: name, 'E-Mail': email, Projekt: project, Zeitraum: timing, Nachricht: note || 'Keine weiteren Angaben',
      }),
    });
  } catch {
    console.error({ event: 'inquiry_delivery_unreachable' });
    return json({ error: 'Die Anfrage konnte gerade nicht versendet werden. Bitte versuchen Sie es später erneut.' }, 502);
  }
  const relayText = await relay.text();
  let relayResult = null;
  if (relayText) try { relayResult = JSON.parse(relayText); } catch { relayResult = null; }
  const delivered = relay.ok && (relayResult?.success === true || relayResult?.success === 'true');
  if (!delivered) {
    console.error({ event: 'inquiry_delivery_failed', status: relay.status });
    return json({ success: false, error: 'Die Anfrage konnte gerade nicht versendet werden. Bitte versuchen Sie es später erneut.' }, 502);
  }
  console.log({ event: 'inquiry_sent', project, timing });
  return json({ success: true });
}

export function onRequest() { return json({ success: false, error: 'Methode nicht erlaubt.' }, 405); }
