// ---------------------------------------------------------------------------
// Shared rewrite-with-AI handler. Wires up any element with
// `data-rewrite-target="<fieldName>"` + `data-rewrite-kind="<kind>"` to:
//
//   1. Open a small modal asking for an optional instruction.
//   2. Stream the AI rewrite into a preview pane.
//   3. On accept → replace the target field's value and trigger an `input`
//      event so listeners (counters, autosave) refresh.
//
// Loaded as `<script is:inline src="/admin-rewrite.js"></script>` on edit
// pages. Requires /admin-sse.js to be loaded first (uses window.streamSSE).
// ---------------------------------------------------------------------------
(function () {
  if (window.__rewriteWired) return;
  window.__rewriteWired = true;

  // --- Build the modal once, lazily on first use ---
  let modal = null;
  let currentTarget = null; // the textarea/input being rewritten
  let currentKind = 'free';

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'rewriteModal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.55);
      display: none; align-items: center; justify-content: center;
      z-index: 9999; padding: 1rem;
    `;
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; max-width: 720px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
          <h3 style="margin: 0; font-size: 1.05rem; color: #f97a07;">✨ Βελτίωση με AI</h3>
          <button type="button" id="rwClose" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #718096;">×</button>
        </div>
        <div style="padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; overflow: auto;">
          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem;">Συγκεκριμένη οδηγία (προαιρετικά)</label>
            <textarea id="rwInstruction" rows="2" placeholder="π.χ. 'Πιο σύντομο', 'Πρόσθεσε αναφορά στο φαγητό', 'Λιγότερα bullet points'" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 0.9rem; font-family: inherit;"></textarea>
            <div style="font-size: 0.75rem; color: #718096; margin-top: 0.25rem;">Άφησέ το κενό για γενική βελτίωση (αφαίρεση κλισέ, ροή, πρακτικά).</div>
          </div>
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
              <strong style="font-size: 0.85rem;">Πρωτότυπο</strong>
              <span id="rwOrigLen" style="font-size: 0.75rem; color: #718096;"></span>
            </div>
            <pre id="rwOrigPreview" style="margin: 0; padding: 0.6rem; background: #f7fafc; color: #2d3748; font-family: ui-monospace, Menlo, monospace; font-size: 0.72rem; max-height: 120px; overflow: auto; border-radius: 6px; white-space: pre-wrap; word-break: break-word; border: 1px solid #e2e8f0;"></pre>
          </div>
          <div id="rwOutWrap" style="display: none;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem;">
              <strong style="font-size: 0.85rem; color: #f97a07;">📝 Νέο κείμενο</strong>
              <span id="rwOutLen" style="font-size: 0.75rem; color: #718096;">0 χαρακτήρες</span>
            </div>
            <pre id="rwOutPreview" style="margin: 0; padding: 0.6rem; background: #1a202c; color: #cbd5e0; font-family: ui-monospace, Menlo, monospace; font-size: 0.78rem; max-height: 320px; overflow: auto; border-radius: 6px; white-space: pre-wrap; word-break: break-word;"></pre>
          </div>
          <div id="rwStatus" style="font-size: 0.85rem;"></div>
        </div>
        <div style="padding: 0.75rem 1.25rem; border-top: 1px solid #e2e8f0; display: flex; gap: 0.5rem; justify-content: flex-end; background: #f7fafc;">
          <button type="button" id="rwCancel" class="btn btn-secondary">Άκυρο</button>
          <button type="button" id="rwGenerate" class="btn btn-primary">✨ Δημιουργία</button>
          <button type="button" id="rwAccept" class="btn btn-primary" style="display: none; background: #10b981;">✓ Αντικατάσταση</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#rwClose').addEventListener('click', closeModal);
    modal.querySelector('#rwCancel').addEventListener('click', closeModal);
    modal.querySelector('#rwGenerate').addEventListener('click', runRewrite);
    modal.querySelector('#rwAccept').addEventListener('click', acceptRewrite);
    // Click outside to close.
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    return modal;
  }

  function openModal(target, kind) {
    ensureModal();
    currentTarget = target;
    currentKind = kind || 'free';
    const text = target.value || '';
    modal.querySelector('#rwInstruction').value = '';
    modal.querySelector('#rwOrigPreview').textContent = text;
    modal.querySelector('#rwOrigLen').textContent = text.length.toLocaleString('el-GR') + ' χαρακτήρες';
    modal.querySelector('#rwOutWrap').style.display = 'none';
    modal.querySelector('#rwOutPreview').textContent = '';
    modal.querySelector('#rwOutLen').textContent = '0 χαρακτήρες';
    modal.querySelector('#rwStatus').innerHTML = '';
    modal.querySelector('#rwGenerate').style.display = '';
    modal.querySelector('#rwGenerate').disabled = false;
    modal.querySelector('#rwAccept').style.display = 'none';
    modal.style.display = 'flex';
  }

  function closeModal() {
    if (modal) modal.style.display = 'none';
    currentTarget = null;
  }

  async function runRewrite() {
    if (!currentTarget) return;
    const text = currentTarget.value || '';
    if (!text.trim()) {
      modal.querySelector('#rwStatus').innerHTML = '<span style="color:#c53030;">Το πεδίο είναι κενό.</span>';
      return;
    }
    const instruction = modal.querySelector('#rwInstruction').value.trim() || undefined;
    const genBtn = modal.querySelector('#rwGenerate');
    const outWrap = modal.querySelector('#rwOutWrap');
    const outPre = modal.querySelector('#rwOutPreview');
    const outLen = modal.querySelector('#rwOutLen');
    const status = modal.querySelector('#rwStatus');

    genBtn.disabled = true;
    outWrap.style.display = '';
    outPre.textContent = '';
    outLen.textContent = '0 χαρακτήρες';
    status.innerHTML = '<span class="spinner"></span> AI γράφει…';

    let streamed = '';
    let finalText = '';
    try {
      await window.streamSSE('/api/admin/ai/rewrite', {
        text, kind: currentKind, instruction,
      }, {
        token: (delta) => {
          streamed += delta;
          outPre.textContent = streamed;
          outLen.textContent = streamed.length.toLocaleString('el-GR') + ' χαρακτήρες';
          outPre.scrollTop = outPre.scrollHeight;
        },
        done: (data) => {
          finalText = (data && data.text) || streamed;
          outPre.textContent = finalText;
          status.innerHTML = '<span style="color:#10b981;">✓ Έτοιμο. Έλεγξε και πάτα Αντικατάσταση.</span>';
          genBtn.style.display = 'none';
          const acc = modal.querySelector('#rwAccept');
          acc.style.display = '';
          acc.dataset.text = finalText;
        },
        error: (errData) => {
          status.innerHTML = `<span style="color:#c53030;">✗ ${String(errData.message || 'AI error').slice(0, 200)}</span>`;
          genBtn.disabled = false;
        },
      });
    } catch (e) {
      status.innerHTML = `<span style="color:#c53030;">✗ ${String(e.message || e).slice(0, 200)}</span>`;
      genBtn.disabled = false;
    }
  }

  function acceptRewrite() {
    if (!currentTarget) return;
    const acc = modal.querySelector('#rwAccept');
    const newText = acc.dataset.text || modal.querySelector('#rwOutPreview').textContent;
    currentTarget.value = newText;
    currentTarget.dispatchEvent(new Event('input', { bubbles: true }));
    if (window.toast) window.toast('Αντικαταστάθηκε', 'success');
    closeModal();
  }

  // --- Global delegated click handler ---
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rewrite-target]');
    if (!btn) return;
    e.preventDefault();
    const targetName = btn.dataset.rewriteTarget;
    const kind = btn.dataset.rewriteKind || 'free';
    const target =
      document.querySelector(`[name="${targetName}"]`) ||
      document.getElementById(targetName);
    if (!target) {
      console.warn('[rewrite] target not found:', targetName);
      return;
    }
    openModal(target, kind);
  });
})();
