/**
 * Copy of https://www.checkthesite.com/SMSConsentForm.html rendered via iframe `srcDoc`.
 * The live page is cross-origin (no CORS / not scriptable from our app), so we keep its markup and
 * styles here verbatim except: Subscribe button, status message and validation script removed;
 * inputs and the consent checkbox are disabled and pre-filled from the employee form.
 * Keep in sync with the live page when its copy changes.
 */

export interface SmsConsentFormValues {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  consentChecked: boolean;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const STYLES = `
:root{--bg:#f3f5f8;--card:#fff;--ink:#17202e;--muted:#566176;--line:#cfd6e2;--accent:#1d3557;--signal:#b45309;--ok:#14663a;--focus:#1d4ed8;
box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Public Sans",system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 20px 56px}
header{border-left:6px solid var(--signal);padding-left:16px;margin-bottom:28px}
header p{margin:0;color:var(--muted);font-weight:500}
h1{font-size:clamp(1.7rem,5vw,2.3rem);line-height:1.15;margin:4px 0 0;font-weight:800;color:var(--accent);letter-spacing:-.01em}
h2{font-size:1.1rem;margin:0 0 8px;font-weight:700}
section,form{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:22px;margin-bottom:18px}
p{margin:0 0 10px}
.row{display:grid;gap:16px;grid-template-columns:1fr 1fr}
@media(max-width:560px){.row{grid-template-columns:1fr}}
label.f{display:block;font-weight:600;font-size:.95rem;margin-bottom:14px}
label.f span{font-weight:400;color:var(--muted)}
input[type=text],input[type=tel],input[type=email]{display:block;width:100%;margin-top:6px;padding:11px 12px;font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:6px}
input:disabled{color:var(--ink);-webkit-text-fill-color:var(--ink);opacity:1;cursor:not-allowed}
input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.consent{display:flex;gap:12px;align-items:flex-start;border:2px solid var(--accent);border-radius:8px;padding:14px;margin:6px 0 0;font-size:.95rem}
.consent input{width:22px;height:22px;margin-top:3px;flex:none;accent-color:var(--accent)}
.fine{font-size:.88rem;color:var(--muted)}
blockquote{margin:8px 0 12px;padding:10px 14px;background:var(--bg);border-left:4px solid var(--line);border-radius:4px;font-size:.93rem}
.ph{background:rgba(180,83,9,.14);padding:0 4px;border-radius:3px}
ul{margin:6px 0 0;padding-left:20px}
a{color:var(--accent)}
`;

export function buildSmsConsentFormHtml(values: SmsConsentFormValues): string {
  const first = escapeHtml(values.firstName);
  const last = escapeHtml(values.lastName);
  const phone = escapeHtml(values.phoneNumber);
  const email = escapeHtml(values.email);
  const checked = values.consentChecked ? ' checked' : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<title>SMS Text Alert Consent Form | Stone Public Safety Solutions LLC</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;700;800&display=swap">
<style>${STYLES}</style>
</head>
<body>
<main>
<header>
<p>Stone Public Safety Solutions LLC</p>
<h1>SMS Text Alert Consent Form</h1>
</header>

<section>
<h2>About these text alerts</h2>
<p>Stone Public Safety Solutions LLC ("Stone Public Safety") sends text message alerts and notifications about public safety services, including safety alerts, schedule and service notifications, and account updates. Sign up below to receive them on your mobile phone.</p>
<p class="fine">Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase or of receiving any services.</p>
</section>

<form onsubmit="return false">
<h2>Sign up for text alerts</h2>
<div class="row">
<label class="f">First name<input type="text" name="first" value="${first}" disabled></label>
<label class="f">Last name<input type="text" name="last" value="${last}" disabled></label>
</div>
<label class="f">Mobile phone number<input type="tel" name="phone" value="${phone}" placeholder="(555) 555-5555" disabled></label>
<label class="f">Email address<input type="email" name="email" value="${email}" disabled></label>

<label class="consent">
<input type="checkbox" name="consent"${checked} disabled>
<span>By checking this box, I agree to receive text messages from Stone Public Safety Solutions LLC, including safety alerts, schedule and service notifications, and account updates, at the mobile number provided. Message frequency varies. Message and data rates may apply. Reply <strong>STOP</strong> to cancel or <strong>HELP</strong> for help. Consent is not a condition of purchase. See our <a href="https://www.CheckTheSite.com/terms.html">Terms of Service</a> and <a href="https://www.CheckTheSite.com/privacy.html">Privacy Policy</a>.</span>
</label>
</form>

<section>
<h2>Message samples</h2>
<p><strong>Confirmation (sent after you subscribe):</strong></p>
<blockquote>Stone Public Safety Solutions: You're subscribed to safety alerts and schedule notifications. Msg frequency varies. Msg &amp; data rates may apply. Reply HELP for help, STOP to cancel. Terms: https://www.CheckTheSite.com/terms.html Privacy: https://www.CheckTheSite.com/privacy.html </blockquote>
<p><strong>Example notification:</strong></p>
<blockquote>Stone Public Safety Solutions: Reminder: your scheduled service on [date] at [time] is confirmed. Reply STOP to opt out.</blockquote>
</section>

<section>
<h2>Opting out and getting help</h2>
<ul>
<li>Text <strong>STOP</strong> at any time to cancel. You will get one confirmation message and no further texts.</li>
<li>Text <strong>HELP</strong> for assistance, or contact us at <span class="ph">ContactUs@CheckTheSite.com</span> or <span class="ph">888-430-4007</span>.</li>
<li>Text <strong>START</strong> to resubscribe after opting out.</li>
</ul>
</section>

<section>
<h2>Your privacy</h2>
<p>Your mobile number and text messaging consent are used only to send the messages described above. We do not sell, rent, or share mobile opt-in data or phone numbers with third parties or affiliates for their marketing or promotional purposes. Supported carriers are not liable for delayed or undelivered messages. See our <a href="https://www.CheckTheSite.com">Privacy Policy</a> for details.</p>
</section>
</main>
</body>
</html>`;
}
