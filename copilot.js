/**
 * Bio Copilot — js/copilot.js
 * ---------------------------------------------------------
 * Frontend-only UI controller. No AI model or backend is
 * connected in this build. Every action that should call a
 * real endpoint is marked with a "BACKEND HOOK" comment —
 * that is the intended integration point.
 *
 * Sections:
 *   1. DOM references
 *   2. Toast helper
 *   3. Conversation state (in-memory, seeded with demo data)
 *   4. Rendering (sidebar history, messages, attachments)
 *   5. Sending messages
 *   6. Suggested prompts
 *   7. File uploads (UI only)
 *   8. Voice input (UI only)
 *   9. Sidebar drawer (mobile)
 *  10. Settings panel (focus-trapped dialog)
 *  11. Theme + language toggles
 *  12. Init
 * ---------------------------------------------------------
 */
(function () {
  'use strict';

  /* =========================================================
     1. DOM references
     ========================================================= */
  var chatBody       = document.getElementById('chatBody');
  var chatBodyInner  = document.getElementById('chatBodyInner');
  var emptyState     = document.getElementById('emptyState');
  var chatSuggested  = document.getElementById('chatSuggested');
  var chatHist       = document.getElementById('chatHist');
  var newChatBtn     = document.getElementById('newChatBtn');

  var chatForm       = document.getElementById('chatForm');
  var chatInput      = document.getElementById('chatInput');
  var sendBtn        = document.getElementById('sendBtn');
  var attachRow      = document.getElementById('attachRow');
  var inputGlass     = document.getElementById('inputGlass');

  var uploadPdfBtn   = document.getElementById('uploadPdfBtn');
  var uploadFastaBtn = document.getElementById('uploadFastaBtn');
  var uploadImageBtn = document.getElementById('uploadImageBtn');
  var fileInputPdf   = document.getElementById('fileInputPdf');
  var fileInputFasta = document.getElementById('fileInputFasta');
  var fileInputImage = document.getElementById('fileInputImage');
  var voiceBtn       = document.getElementById('voiceBtn');

  var sidebar        = document.getElementById('sidebar');
  var sideToggle      = document.getElementById('sideToggle');
  var sideClose        = document.getElementById('sideClose');
  var sideBackdrop    = document.getElementById('sideBackdrop');

  var settingsBtn       = document.getElementById('settingsBtn');
  var settingsPanel     = document.getElementById('settingsPanel');
  var settingsBackdrop  = document.getElementById('settingsBackdrop');
  var settingsClose     = document.getElementById('settingsClose');
  var clearHistoryBtn   = document.getElementById('clearHistoryBtn');

  var themeToggle   = document.getElementById('themeToggle');
  var themeToggle2  = document.getElementById('themeToggle2');
  var langToggle    = document.getElementById('langToggle');

  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  /* =========================================================
     2. Toast helper
     ========================================================= */
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2400);
  }

  /* =========================================================
     3. Conversation state
     Each conversation: { id, title, messages: [{ role, text }] }
     This is in-memory demo data only — nothing is persisted.
     ========================================================= */
  var conversations = [
    { id: 'c1', title: 'CRISPR off-target risk', messages: [
      { role: 'ai', text: "Hi — I'm Bio Copilot. Paste a sequence, ask about a pathway, or upload a paper and I'll get to work." },
      { role: 'user', text: 'What raises off-target risk in a CRISPR guide RNA design?' },
      { role: 'ai', text: 'Off-target risk climbs with guide sequences that closely resemble other genomic loci, especially with mismatches near the PAM-distal end tolerated by the nuclease. Lower GC content and repetitive regions also increase risk — running a genome-wide specificity check before ordering a guide is the standard mitigation.' }
    ]},
    { id: 'c2', title: 'Primer design — TP53', messages: [
      { role: 'ai', text: "Hi — I'm Bio Copilot. Paste a sequence, ask about a pathway, or upload a paper and I'll get to work." },
      { role: 'user', text: 'Design a primer pair for exon 5 of TP53.' },
      { role: 'ai', text: "I'd need the reference sequence to generate exact primers, but as a rule of thumb for exon 5: aim for 18–24 nt primers, 40–60% GC, a melting temperature within 2°C of the reverse primer, and avoid 3' self-complementarity. Upload the FASTA and I'll calculate real Tm and GC values." }
    ]},
    { id: 'c3', title: 'Summarize: Nature 2026 #118', messages: [
      { role: 'ai', text: "Hi — I'm Bio Copilot. Paste a sequence, ask about a pathway, or upload a paper and I'll get to work." },
      { role: 'user', text: 'Summarize the paper I uploaded earlier.' },
      { role: 'ai', text: "I don't have that file in this session yet — use the PDF upload button below and I'll pull out the abstract, methods, and key findings for you." }
    ]},
    { id: 'c4', title: 'Codon optimization, E. coli', messages: [
      { role: 'ai', text: "Hi — I'm Bio Copilot. Paste a sequence, ask about a pathway, or upload a paper and I'll get to work." },
      { role: 'user', text: 'Why does codon optimization matter for E. coli expression?' },
      { role: 'ai', text: 'E. coli has uneven tRNA abundance across synonymous codons. A gene written with rare codons can stall ribosomes, reduce yield, and trigger truncated products — matching codon usage to the host tRNA pool improves translation efficiency and protein expression.' }
    ]},
    { id: 'c5', title: 'Protein fold comparison', messages: [
      { role: 'ai', text: "Hi — I'm Bio Copilot. Paste a sequence, ask about a pathway, or upload a paper and I'll get to work." },
      { role: 'user', text: 'How do I compare two predicted protein folds for similarity?' },
      { role: 'ai', text: 'Structural alignment metrics like TM-score or RMSD after superposition are the standard approach — TM-score is length-independent and more reliable for comparing folds of different sizes. Upload both structure files with the Protein Analyzer for a full comparison.' }
    ]}
  ];

  var activeId = conversations.length ? conversations[0].id : null;
  var attachments = []; // { kind: 'pdf'|'fasta'|'image', name: string }
  var isRecording = false;

  var placeholderReplies = [
    "This is a frontend preview — Bio Copilot isn't connected to a live model yet. Once the API is wired up, a real answer will appear here.",
    'UI preview only: this response is a placeholder. Hook this panel up to your inference endpoint to get real answers.',
    'No model is connected in this build. This message shows where a generated answer will render once the backend is live.'
  ];

  function getActiveConversation() {
    for (var i = 0; i < conversations.length; i++) {
      if (conversations[i].id === activeId) return conversations[i];
    }
    return null;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* =========================================================
     4. Rendering
     ========================================================= */
  function renderHistory() {
    chatHist.innerHTML = '';
    conversations.forEach(function (convo) {
      var row = document.createElement('li');
      row.className = 'chat-hist-row';

      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'chat-hist-item';
      item.dataset.chatId = convo.id;
      item.setAttribute('aria-current', String(convo.id === activeId));
      item.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
        '<span>' + escapeHtml(convo.title) + '</span>';
      item.addEventListener('click', function () { setActiveConversation(convo.id); });

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'hist-del';
      delBtn.setAttribute('aria-label', 'Delete conversation: ' + convo.title);
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteConversation(convo.id);
      });

      row.appendChild(item);
      row.appendChild(delBtn);
      chatHist.appendChild(row);
    });
  }

  function renderMessages() {
    // Remove every rendered message, keep the empty-state node.
    Array.prototype.slice.call(chatBodyInner.children).forEach(function (el) {
      if (el !== emptyState) el.remove();
    });

    var convo = getActiveConversation();
    var hasMessages = !!(convo && convo.messages.length);

    emptyState.style.display = hasMessages ? 'none' : 'flex';
    chatSuggested.classList.toggle('hidden', !hasMessages);

    if (!hasMessages) return;

    convo.messages.forEach(function (m) { appendBubble(m.role, m.text, false); });
    scrollChatToBottom(false);
  }

  function appendBubble(role, text, animate) {
    var row = document.createElement('div');
    row.className = 'msg ' + (role === 'user' ? 'user' : 'ai') + (animate ? '' : ' no-anim');

    var avatar = document.createElement('span');
    avatar.className = 'msg-avatar';
    avatar.setAttribute('aria-hidden', 'true');

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    if (role === 'user') { row.appendChild(bubble); row.appendChild(avatar); }
    else { row.appendChild(avatar); row.appendChild(bubble); }

    chatBodyInner.appendChild(row);
    return row;
  }

  function appendTypingIndicator() {
    var row = document.createElement('div');
    row.className = 'msg ai';
    row.id = 'typingRow';
    row.setAttribute('aria-label', 'Bio Copilot is typing');
    row.innerHTML =
      '<span class="msg-avatar" aria-hidden="true"></span>' +
      '<div class="bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div>';
    chatBodyInner.appendChild(row);
    scrollChatToBottom(true);
  }

  function removeTypingIndicator() {
    var row = document.getElementById('typingRow');
    if (row) row.remove();
  }

  function scrollChatToBottom(smooth) {
    requestAnimationFrame(function () {
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  }

  function renderAttachments() {
    attachRow.innerHTML = '';
    attachments.forEach(function (file, index) {
      var chip = document.createElement('span');
      chip.className = 'attach-chip mono';
      chip.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" aria-hidden="true"><path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48"/></svg>' +
        '<span>' + escapeHtml(file.name) + '</span>';

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', 'Remove attachment: ' + file.name);
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', function () {
        attachments.splice(index, 1);
        renderAttachments();
        updateSendButtonState();
      });

      chip.appendChild(removeBtn);
      attachRow.appendChild(chip);
    });
  }

  function clearAttachments() {
    attachments = [];
    renderAttachments();
  }

  /* =========================================================
     5. Sending messages
     ========================================================= */
  function updateSendButtonState() {
    var hasText = chatInput.value.trim().length > 0;
    sendBtn.disabled = !hasText && attachments.length === 0;
  }

  function autoGrowInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
  }

  function sendMessage(rawText) {
    var text = (rawText || '').trim();
    if (!text && attachments.length === 0) return;

    var convo = getActiveConversation();
    if (!convo) { newConversation(); convo = getActiveConversation(); }

    if (convo.messages.length === 0 && text) {
      convo.title = text.length > 32 ? text.slice(0, 32) + '…' : text;
    }

    var displayText = text;
    if (attachments.length) {
      var names = attachments.map(function (a) { return a.name; }).join(', ');
      displayText = (text ? text + '\n\n' : '') + '📎 Attached: ' + names;
    }

    convo.messages.push({ role: 'user', text: displayText });
    emptyState.style.display = 'none';
    chatSuggested.classList.remove('hidden');
    appendBubble('user', displayText, true);
    scrollChatToBottom(true);

    clearAttachments();
    chatInput.value = '';
    autoGrowInput();
    updateSendButtonState();
    renderHistory();

    appendTypingIndicator();

    // BACKEND HOOK: replace this timeout with a real request, e.g.
    //   fetch(chatForm.dataset.apiEndpoint, { method: 'POST', body: JSON.stringify({ message: text }) })
    var delay = 900 + Math.random() * 900;
    setTimeout(function () {
      removeTypingIndicator();
      var reply = placeholderReplies[Math.floor(Math.random() * placeholderReplies.length)];
      convo.messages.push({ role: 'ai', text: reply });
      appendBubble('ai', reply, true);
      scrollChatToBottom(true);
    }, delay);
  }

  chatForm.addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage(chatInput.value);
  });

  chatInput.addEventListener('input', function () {
    autoGrowInput();
    updateSendButtonState();
  });

  chatInput.addEventListener('keydown', function (e) {
    // Enter sends the message; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage(chatInput.value);
    }
  });

  chatInput.addEventListener('focus', function () { inputGlass.classList.add('is-focused'); });
  chatInput.addEventListener('blur', function () { inputGlass.classList.remove('is-focused'); });

  /* =========================================================
     6. Suggested prompts (empty-state cards + chip row)
     ========================================================= */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-prompt]');
    if (!trigger) return;
    var prompt = trigger.getAttribute('data-prompt');
    chatInput.value = prompt;
    autoGrowInput();
    updateSendButtonState();
    sendMessage(prompt);
  });

  /* =========================================================
     7. File uploads (UI only — no upload actually happens)
     ========================================================= */
  function bindUpload(button, input, kind, label) {
    button.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      attachments.push({ kind: kind, name: file.name });
      renderAttachments();
      updateSendButtonState();
      showToast(label + ' attached — ' + file.name);
      input.value = '';
      // BACKEND HOOK: upload `file` to storage / a parsing endpoint here.
    });
  }
  bindUpload(uploadPdfBtn, fileInputPdf, 'pdf', 'PDF');
  bindUpload(uploadFastaBtn, fileInputFasta, 'fasta', 'FASTA file');
  bindUpload(uploadImageBtn, fileInputImage, 'image', 'Image');

  /* =========================================================
     8. Voice input (UI only — no audio is captured)
     ========================================================= */
  voiceBtn.addEventListener('click', function () {
    isRecording = !isRecording;
    voiceBtn.classList.toggle('is-recording', isRecording);
    voiceBtn.setAttribute('aria-pressed', String(isRecording));
    voiceBtn.setAttribute('aria-label', isRecording ? 'Stop voice input' : 'Start voice input');
    showToast(isRecording ? 'Listening… (voice input preview)' : 'Voice input stopped');
    // BACKEND HOOK: start/stop real speech-to-text capture here.
  });

  /* =========================================================
     9. Sidebar drawer (mobile off-canvas navigation)
     ========================================================= */
  function openSidebar() {
    sidebar.classList.add('open');
    sideBackdrop.classList.add('open');
    sideToggle.setAttribute('aria-expanded', 'true');
    sideClose.focus();
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    sideBackdrop.classList.remove('open');
    sideToggle.setAttribute('aria-expanded', 'false');
  }
  sideToggle.addEventListener('click', function () {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  sideClose.addEventListener('click', function () { closeSidebar(); sideToggle.focus(); });
  sideBackdrop.addEventListener('click', function () { closeSidebar(); sideToggle.focus(); });

  function setActiveConversation(id) {
    activeId = id;
    renderHistory();
    renderMessages();
    if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
  }

  function newConversation() {
    var convo = { id: 'c' + Date.now(), title: 'New chat', messages: [] };
    conversations.unshift(convo);
    activeId = convo.id;
    renderHistory();
    renderMessages();
    chatInput.focus();
    if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
    // BACKEND HOOK: create a conversation record server-side and store its real id.
  }

  function deleteConversation(id) {
    var index = conversations.findIndex(function (c) { return c.id === id; });
    if (index === -1) return;
    var wasActive = activeId === id;
    conversations.splice(index, 1);
    if (wasActive) {
      activeId = conversations.length ? conversations[0].id : null;
      if (!activeId) { newConversation(); return; }
    }
    renderHistory();
    renderMessages();
    showToast('Conversation deleted');
    // BACKEND HOOK: delete the conversation record server-side.
  }

  function clearAllHistory() {
    conversations = [];
    newConversation();
    showToast('All conversations cleared');
    // BACKEND HOOK: bulk-delete all conversation records server-side.
  }

  newChatBtn.addEventListener('click', newConversation);
  clearHistoryBtn.addEventListener('click', clearAllHistory);

  /* =========================================================
     10. Settings panel (focus-trapped dialog)
     ========================================================= */
  var settingsTriggerEl = null;

  function getFocusableIn(container) {
    var selector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(container.querySelectorAll(selector));
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var focusable = getFocusableIn(settingsPanel);
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function openSettings(triggerEl) {
    settingsTriggerEl = triggerEl || document.activeElement;
    settingsPanel.classList.add('open');
    settingsBackdrop.classList.add('open');
    settingsPanel.setAttribute('aria-hidden', 'false');
    settingsBtn.setAttribute('aria-expanded', 'true');
    settingsClose.focus();
    document.addEventListener('keydown', trapFocus);
  }

  function closeSettings() {
    settingsPanel.classList.remove('open');
    settingsBackdrop.classList.remove('open');
    settingsPanel.setAttribute('aria-hidden', 'true');
    settingsBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', trapFocus);
    if (settingsTriggerEl) settingsTriggerEl.focus();
  }

  settingsBtn.addEventListener('click', function () { openSettings(settingsBtn); });
  settingsClose.addEventListener('click', closeSettings);
  settingsBackdrop.addEventListener('click', closeSettings);

  // Escape closes whichever overlay is currently open.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (settingsPanel.classList.contains('open')) closeSettings();
    else if (sidebar.classList.contains('open')) { closeSidebar(); sideToggle.focus(); }
  });

  /* =========================================================
     11. Theme + language toggles
     ========================================================= */
  function applyTheme(isLight) {
    document.body.classList.toggle('theme-light', isLight);
    themeToggle2.textContent = isLight ? 'Light' : 'Dark';
    try { localStorage.setItem('bioai-copilot-theme', isLight ? 'light' : 'dark'); } catch (err) { /* storage unavailable */ }
  }
  function toggleTheme() {
    applyTheme(!document.body.classList.contains('theme-light'));
  }
  themeToggle.addEventListener('click', toggleTheme);
  themeToggle2.addEventListener('click', toggleTheme);

  langToggle.addEventListener('click', function () {
    var next = langToggle.textContent.trim() === 'EN' ? 'FA' : 'EN';
    langToggle.textContent = next;
    showToast('Language preference set to ' + next + ' (translations coming soon)');
    // BACKEND HOOK: swap in localized copy / persist the locale preference here.
  });

  /* =========================================================
     12. Init
     ========================================================= */
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('bioai-copilot-theme'); } catch (err) { /* storage unavailable */ }
    applyTheme(saved === 'light');
  })();

  renderHistory();
  renderMessages();
  updateSendButtonState();
})();
