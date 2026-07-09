const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../public/coming-soon.html'), 'utf8');

const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const worker = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === '/api/waitlist') {
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
      try {
        const body = await request.json().catch(() => ({}));
        const email = String(body.email || '').trim().toLowerCase();
        if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
          return new Response(JSON.stringify({ error: 'Invalid email' }), {
            status: 400,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        const res = await fetch(\`\${env.SUPABASE_URL}/rest/v1/waitlist_emails\`, {
          method: 'POST',
          headers: {
            Authorization: \`Bearer \${env.SUPABASE_SERVICE_KEY}\`,
            apikey: env.SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ email }),
        });
        if (res.status !== 201 && res.status !== 409) {
          const body = await res.text();
          console.error('[waitlist] supabase', res.status, body);
          return new Response(JSON.stringify({ error: 'supabase ' + res.status, detail: body }), {
            status: 500,
            headers: { ...cors, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('[waitlist] caught', e.message);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },
};

const HTML = \`${escaped}\`;
`;

fs.writeFileSync(path.join(__dirname, 'worker.js'), worker);
console.log('Worker written, size:', worker.length);
