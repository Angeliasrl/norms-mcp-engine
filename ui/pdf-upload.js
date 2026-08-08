(() => {
  'use strict';
  const input = document.querySelector('#pdf');
  const send = document.querySelector('#send');
  const cancel = document.querySelector('#cancel');
  const remove = document.querySelector('#delete');
  const progress = document.querySelector('#progress');
  const status = document.querySelector('#status');
  let activeRequest = null;

  const session = window.openai?.toolOutput ?? {};
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const uploadCapability = fragment.get('upload_capability');
  history.replaceState(null, '', `${location.pathname}${location.search}`);

  const messageFor = (statusCode) => ({
    401: 'Capability non valida o revocata.',
    408: 'La sessione è scaduta. Creane una nuova.',
    409: 'La sessione è già stata usata o si trova in uno stato incompatibile.',
    413: 'Il PDF supera il limite consentito.',
    415: 'Il contenuto è stato rifiutato: deve essere un PDF passivo supportato.',
    422: 'Il PDF contiene elementi non supportati o attivi ed è stato rifiutato.',
  }[statusCode] ?? `Upload rifiutato (${statusCode}).`);

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    send.disabled = !file || !session.upload_url || !uploadCapability;
    status.textContent = file && file.size > Number(session.max_bytes ?? Infinity)
      ? 'Il PDF supera il limite della sessione.' : '';
  });

  send.addEventListener('click', () => {
    const file = input.files?.[0];
    if (!file || !session.upload_url || !uploadCapability) {
      status.textContent = 'Sessione di upload non disponibile o scaduta.'; return;
    }
    if (new URL(session.upload_url, location.origin).search) {
      status.textContent = 'Sessione rifiutata: le capability non possono essere nella query.'; return;
    }
    const target = new URL(session.upload_url, location.origin); target.hash = '';
    if (target.origin !== location.origin) { status.textContent = 'Destinazione upload non autorizzata.'; return; }
    activeRequest = new XMLHttpRequest();
    activeRequest.open('PUT', target.href, true);
    activeRequest.setRequestHeader('Content-Type', 'application/pdf');
    activeRequest.setRequestHeader('Authorization', `Capability ${uploadCapability}`);
    activeRequest.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      progress.value = Math.round((event.loaded / event.total) * 100);
      progress.textContent = `${progress.value}%`;
    };
    activeRequest.onload = () => {
      status.textContent = activeRequest.status >= 200 && activeRequest.status < 300
        ? 'PDF ricevuto e sottoposto ai controlli. Finalizza la sessione per proseguire.'
        : messageFor(activeRequest.status);
      activeRequest = null; cancel.disabled = true;
    };
    activeRequest.onerror = () => { status.textContent = 'Errore di rete durante il caricamento.'; activeRequest = null; cancel.disabled = true; };
    activeRequest.onabort = () => { status.textContent = 'Caricamento annullato. La capability monouso non può essere riutilizzata.'; activeRequest = null; cancel.disabled = true; };
    progress.value = 0; send.disabled = true; cancel.disabled = false; status.textContent = 'Caricamento in corso…';
    activeRequest.send(file);
  });

  cancel.addEventListener('click', () => activeRequest?.abort());
  remove.addEventListener('click', async () => {
    if (!session.upload_id || !session.delete_capability || typeof window.openai?.callTool !== 'function') {
      status.textContent = 'Cancellazione non disponibile in questo client.'; return;
    }
    remove.disabled = true;
    try {
      await window.openai.callTool('delete_pdf_upload', { upload_id: session.upload_id, delete_capability: session.delete_capability });
      status.textContent = 'Sessione eliminata.'; input.value = ''; send.disabled = true;
    } catch { status.textContent = 'Cancellazione non confermata. La retention di sicurezza resta attiva.'; }
    finally { remove.disabled = false; }
  });
})();
