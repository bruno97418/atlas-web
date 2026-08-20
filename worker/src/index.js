const corsHeaders = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'Content-Type, X-Job-Token, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Vary': 'Origin'
});

function json(data, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...corsHeaders(origin) } });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || 'https://bruno97418.github.io').split(',').map(x => x.trim());
  return allowed.includes(origin) ? origin : allowed[0];
}

function id() { return crypto.randomUUID(); }
function token() {
  const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
}

async function readMeta(env, jobId) {
  const obj = await env.ATLAS_JOBS.get(`jobs/${jobId}/meta.json`);
  return obj ? JSON.parse(await obj.text()) : null;
}

async function writeMeta(env, jobId, meta) {
  await env.ATLAS_JOBS.put(`jobs/${jobId}/meta.json`, JSON.stringify(meta), { httpMetadata: { contentType: 'application/json' } });
}

async function dispatch(env, jobId, fileName, workerUrl) {
  const repo = env.WORKFLOW_REPO || 'bruno97418/atlas-web';
  const workflow = env.WORKFLOW_FILE || 'atlas-analyze.yml';
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ATLAS-Web-Worker'
    },
    body: JSON.stringify({ ref: 'main', inputs: { job_id: jobId, filename: fileName, worker_url: workerUrl } })
  });
  if (!r.ok) throw new Error(`GitHub dispatch failed: ${r.status} ${await r.text()}`);
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/jobs') {
      try {
        const form = await request.formData();
        const file = form.get('firmware');
        if (!(file instanceof File) || file.size === 0) return json({ error: 'firmware_required' }, 400, origin);
        const max = Number(env.MAX_UPLOAD_BYTES || 33554432);
        if (file.size > max) return json({ error: 'file_too_large', max_bytes: max }, 413, origin);
        const jobId = id(), jobToken = token();
        const safeName = (file.name || 'firmware.bin').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
        await env.ATLAS_JOBS.put(`jobs/${jobId}/input.bin`, file.stream(), { httpMetadata: { contentType: 'application/octet-stream' } });
        await writeMeta(env, jobId, { job_id: jobId, token: jobToken, filename: safeName, size: file.size, status: 'queued', created_at: new Date().toISOString() });
        await dispatch(env, jobId, safeName, url.origin);
        return json({ job_id: jobId, job_token: jobToken, status: 'queued' }, 202, origin);
      } catch (e) { return json({ error: 'submit_failed', detail: String(e.message || e) }, 500, origin); }
    }

    const publicMatch = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]+)$/i);
    if (request.method === 'GET' && publicMatch) {
      const meta = await readMeta(env, publicMatch[1]);
      if (!meta) return json({ error: 'not_found' }, 404, origin);
      if (request.headers.get('X-Job-Token') !== meta.token) return json({ error: 'forbidden' }, 403, origin);
      const out = { ...meta }; delete out.token;
      if (meta.status === 'done') {
        const result = await env.ATLAS_JOBS.get(`jobs/${meta.job_id}/result.json`);
        if (result) out.result = JSON.parse(await result.text());
      }
      return json(out, 200, origin);
    }

    const internalInput = url.pathname.match(/^\/internal\/jobs\/([0-9a-f-]+)\/input$/i);
    if (request.method === 'GET' && internalInput) {
      if (request.headers.get('Authorization') !== `Bearer ${env.WORKER_SHARED_SECRET}`) return new Response('forbidden', { status: 403 });
      const obj = await env.ATLAS_JOBS.get(`jobs/${internalInput[1]}/input.bin`);
      if (!obj) return new Response('not found', { status: 404 });
      return new Response(obj.body, { headers: { 'content-type': 'application/octet-stream' } });
    }

    const internalResult = url.pathname.match(/^\/internal\/jobs\/([0-9a-f-]+)\/result$/i);
    if (request.method === 'PUT' && internalResult) {
      if (request.headers.get('Authorization') !== `Bearer ${env.WORKER_SHARED_SECRET}`) return new Response('forbidden', { status: 403 });
      const jobId = internalResult[1], meta = await readMeta(env, jobId);
      if (!meta) return new Response('not found', { status: 404 });
      const body = await request.arrayBuffer();
      await env.ATLAS_JOBS.put(`jobs/${jobId}/result.json`, body, { httpMetadata: { contentType: 'application/json' } });
      meta.status = 'done'; meta.completed_at = new Date().toISOString();
      await writeMeta(env, jobId, meta);
      await env.ATLAS_JOBS.delete(`jobs/${jobId}/input.bin`);
      return new Response('ok');
    }

    const internalError = url.pathname.match(/^\/internal\/jobs\/([0-9a-f-]+)\/error$/i);
    if (request.method === 'PUT' && internalError) {
      if (request.headers.get('Authorization') !== `Bearer ${env.WORKER_SHARED_SECRET}`) return new Response('forbidden', { status: 403 });
      const jobId = internalError[1], meta = await readMeta(env, jobId);
      if (!meta) return new Response('not found', { status: 404 });
      meta.status = 'error'; meta.error = await request.text(); meta.completed_at = new Date().toISOString();
      await writeMeta(env, jobId, meta); await env.ATLAS_JOBS.delete(`jobs/${jobId}/input.bin`);
      return new Response('ok');
    }

    return json({ service: 'ATLAS Web API', status: 'ok' }, 200, origin);
  }
};
