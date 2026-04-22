// Tiny SSE-over-fetch helper used by admin/agency AI generation pages.
// EventSource doesn't support POST, so we POST + parse the SSE body manually.
//
// Usage:
//   await streamSSE('/api/admin/ai/tour', payload, {
//     token: (delta) => { textarea.value += delta; },
//     done:  (data)  => { fillForm(data); },
//     error: (err)   => { showError(err.message); },
//   });
window.streamSSE = async function streamSSE(url, body, handlers) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    let detail = '';
    try { detail = await r.text(); } catch {}
    throw new Error('HTTP ' + r.status + (detail ? ': ' + detail.slice(0, 200) : ''));
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      // Parse a single SSE event block (lines: "event: x", "data: y")
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed;
      try { parsed = JSON.parse(data); } catch { parsed = data; }
      const fn = handlers[event];
      if (fn) {
        try { fn(parsed); } catch (e) { console.error('SSE handler error:', e); }
      }
    }
  }
};
