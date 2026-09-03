import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('recursos/original.html', root), 'utf8');
let body = source.slice(source.indexOf('<div class="mobile-navigation'), source.indexOf('</footer>') + 9);
body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
body = body.replace(/<div class="homepage-chatbot">[\s\S]*?(?=<div style="display:none;">)/, '');
body = body.replace(/\s+on\w+="[^"]*"/g, '');
body = body.replace(/<input\b[^>]*type="hidden"[^>]*>/gi, '');
body = body.replace(/href="(\/en[^"#]*|\/tr[^"#]*)"/g, (_, url) =>
  url === '/en' ? 'href="/en"' : `href="https://www.ziraatbank.com.tr${url}" target="_blank" rel="noopener noreferrer"`
);
body = body.replace(/href="javascript:;"/g, 'href="#"');
body = body.replace(
  /class="langUrl" href="#"/g,
  'class="langUrl" href="https://www.ziraatbank.com.tr/tr" target="_blank" rel="noopener noreferrer"'
);
body = body.replace(
  /href="#" class="langUrl"/g,
  'href="https://www.ziraatbank.com.tr/tr" class="langUrl" target="_blank" rel="noopener noreferrer"'
);
body = body.replace(
  /<div class="item box-height owl-lazy default"/,
  '<div class="item box-height owl-lazy default active"'
);
body = body.replace(/data-src="(\/en\/Banners\/[^"]+)"/g, 'data-src="$1" style="background-image:url(\'$1\')"');
body = body.replace(/(<img[^>]+)src="\/SiteAssets\/images\/transparent.png" data-src="([^"]+)"/g, '$1src="$2"');
body = body.replace(/(id="home-icon-[^"]+">)/g, '$1<span class="animation" aria-hidden="true"><span></span></span>');
body += '</div></div>';
const cookie = (source.match(/<div class="cookie-box[\s\S]*?<\/div>/)?.[0] || '').replace(
  /href="(\/tr[^"]+)"/g,
  'href="https://www.ziraatbank.com.tr$1" target="_blank" rel="noopener noreferrer"'
);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ziraat Bank — Local Site</title><meta name="description" content="Local visual reproduction of the public Ziraat Bank English homepage.">
<meta name="robots" content="noindex,nofollow"><link rel="icon" href="/SiteAssets/images/favicon.ico">
<link rel="stylesheet" href="/SiteAssets/css/min/magiclick.min.css"><link rel="stylesheet" href="/clone.css">
<script type="module" src="/app.js"></script></head><body class="home-page global en">
<a class="clone-skip" href="#main-box">Skip to content</a>
${body}
<p class="site-note">Local site · Unaffiliated reproduction · No banking transactions. Product links open the official website.</p>
${cookie}
<button class="chat-launch" type="button" aria-label="Abrir chat" aria-expanded="false" aria-controls="customer-chat"><span class="icon-comment" aria-hidden="true"></span></button>
<section class="customer-chat" id="customer-chat" aria-label="Support chat" hidden>
  <header><div><strong>Online support</strong><small>An operator will reply here</small></div><button class="chat-close" type="button" aria-label="Close chat">×</button></header>
  <div class="chat-messages" role="log" aria-live="polite"><p class="chat-welcome">Hello, how can we help you?</p></div>
  <p class="chat-error" role="alert" hidden></p>
  <form class="chat-form"><label class="sr-only" for="chat-text">Message</label><textarea id="chat-text" maxlength="2000" rows="2" placeholder="Write your message…" required></textarea><button type="submit">Send</button></form>
</section>
<dialog id="local-dialog" aria-labelledby="dialog-title"><button class="dialog-close" aria-label="Close dialog">×</button><h2 id="dialog-title"></h2><div id="dialog-content"></div></dialog>
</body></html>`;
await mkdir(new URL('public/', root), { recursive: true });
await writeFile(new URL('public/index.html', root), html);
const refs = [...html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)].map((m) => m[1]).filter((p) => p !== '/en');
for (const ref of new Set(refs)) await stat(new URL('public' + ref, root));
console.log('Built public/index.html from recursos/original.html. Local HTML assets verified.');
