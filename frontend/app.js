/* ============================================================
   GRAVITY AI — FRONTEND
   Google Auth · Conversations · Gemini Web · File Analysis
   ============================================================ */

const API_URL           = "/api/gemini";
const ANALYZE_FILE_URL  = "/api/analyze-file";
const AUTH_CONFIG_URL   = "/api/auth/config";
const AUTH_GOOGLE_URL   = "/api/auth/google";
const AUTH_ME_URL       = "/api/auth/me";
const CONVERSATIONS_URL = "/api/conversations";

const TOKEN_KEY = "gravity_auth_token";
const USER_KEY  = "gravity_auth_user";
const MAX_FILE_SIZE_MB = 50;

/* DOM */
const $ = (id) => document.getElementById(id);

const messageInput    = $("messageInput");
const sendBtn         = $("sendBtn");
const messages        = $("messages");
const welcome         = $("welcome");
const typingIndicator = $("typingIndicator");
const typingLabel     = $("typingLabel");

const newChatBtn      = $("newChatBtn");
const clearChatBtn    = $("clearChatBtn");

const historyList     = $("historyList");
const historySearch   = $("historySearch");
const historyCount    = $("historyCount");

const menuBtn         = $("menuBtn");
const sidebar         = $("sidebar");
const sidebarOverlay  = $("sidebarOverlay");
const sidebarClose    = $("sidebarClose");

const authScreen      = $("authScreen");
const googleButton    = $("googleButton");
const authStatus      = $("authStatus");
const authError       = $("authError");

const accountName     = $("accountName");
const accountEmail    = $("accountEmail");
const accountAvatar   = $("accountAvatar");
const logoutBtn       = $("logoutBtn");

const attachBtn         = $("attachBtn");
const fileInput         = $("fileInput");
const attachmentPreview = $("attachmentPreview");
const attachmentIcon    = $("attachmentIcon");
const attachmentName    = $("attachmentName");
const attachmentSize    = $("attachmentSize");
const attachmentRemove  = $("attachmentRemove");

const toast = $("toast");

/* STATE */
let conversation    = [];
let chatHistory     = [];
let isLoading       = false;
let isAuthenticated = false;
let currentUser     = null;
let googleClientId  = null;

let selectedFile    = null;
let filePreviewURL  = null;

window.currentChatId = null;

/* HELPERS */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function isImageFile(file) {
  return file && typeof file.type === "string" && file.type.startsWith("image/");
}

function showToast(message, type = "info") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast show" + (type ? ` ${type}` : "");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* AUTH STORAGE */
function getAuthToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function saveAuthSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* JSON */
async function parseJSON(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw new Error(`Invalid server response (${response.status})`); }
}

/* AUTH FETCH */
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && isAuthenticated) {
    handleSessionExpired();
  }
  return response;
}

/* AUTH UI */
function showAuthScreen() {
  authScreen?.classList.remove("hidden");
  document.body.classList.add("auth-visible");
}
function hideAuthScreen() {
  authScreen?.classList.add("hidden");
  document.body.classList.remove("auth-visible");
}
function setAuthStatus(text) {
  if (authStatus) authStatus.textContent = text || "";
}
function showAuthError(message) {
  if (!authError) return;
  authError.textContent = message || "";
  authError.classList.toggle("hidden", !message);
}

/* ACCOUNT UI */
function updateAccountUI(user) {
  if (!user) return;
  if (accountName)  accountName.textContent  = user.name  || "Gravity User";
  if (accountEmail) accountEmail.textContent = user.email || "";
  if (!accountAvatar) return;

  if (user.profileImage) {
    accountAvatar.textContent = "";
    accountAvatar.style.backgroundImage = `url("${user.profileImage}")`;
    accountAvatar.style.backgroundSize = "cover";
    accountAvatar.style.backgroundPosition = "center";
    accountAvatar.classList.remove("fallback");
  } else {
    accountAvatar.style.backgroundImage = "";
    accountAvatar.textContent = (user.name || "G").trim().charAt(0).toUpperCase();
    accountAvatar.classList.add("fallback");
  }
}

/* GOOGLE CONFIG */
async function loadGoogleConfig() {
  try {
    const response = await fetch(AUTH_CONFIG_URL);
    const data = await parseJSON(response);
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to load Google configuration.");
    }
    googleClientId = data.googleClientId || null;
    if (!googleClientId) throw new Error("Google Client ID is missing.");
    return true;
  } catch (error) {
    showAuthError(error.message);
    return false;
  }
}

function waitForGoogleSDK(timeout = 15000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) { clearInterval(timer); resolve(); return; }
      if (Date.now() - started >= timeout) {
        clearInterval(timer);
        reject(new Error("Google Sign-In SDK could not be loaded."));
      }
    }, 100);
  });
}

async function initializeGoogleLogin() {
  if (!googleButton) return;
  setAuthStatus("Preparing secure sign-in…");
  showAuthError("");

  const configured = await loadGoogleConfig();
  if (!configured) { setAuthStatus("Google sign-in unavailable."); return; }

  try {
    await waitForGoogleSDK();
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });

    googleButton.innerHTML = "";
    window.google.accounts.id.renderButton(googleButton, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: 320
    });

    setAuthStatus("Continue with your Google account.");
  } catch (error) {
    setAuthStatus("Google sign-in could not be loaded.");
    showAuthError(error.message);
  }
}

/* GOOGLE LOGIN */
async function handleGoogleCredential(response) {
  if (!response?.credential) {
    showAuthError("Google did not return a valid credential.");
    return;
  }

  try {
    setAuthStatus("Signing you in…");
    showAuthError("");

    const authResponse = await fetch(AUTH_GOOGLE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await parseJSON(authResponse);

    if (!authResponse.ok || !data.success || !data.token || !data.user) {
      throw new Error(data.error || "Google authentication failed.");
    }

    saveAuthSession(data.token, data.user);
    currentUser     = data.user;
    isAuthenticated = true;

    updateAccountUI(currentUser);
    hideAuthScreen();

    conversation         = [];
    window.currentChatId = null;

    await loadServerConversations();
    messageInput?.focus();
  } catch (error) {
    isAuthenticated = false;
    currentUser     = null;
    setAuthStatus("Sign-in failed.");
    showAuthError(error.message);
  }
}

/* SESSION RESTORE */
async function restoreSession() {
  const token = getAuthToken();
  if (!token) {
    showAuthScreen();
    await initializeGoogleLogin();
    return false;
  }

  try {
    const response = await authFetch(AUTH_ME_URL);
    const data = await parseJSON(response);

    if (!response.ok || !data.success || !data.user) {
      throw new Error(data.error || "Session expired.");
    }

    currentUser     = data.user;
    isAuthenticated = true;

    saveAuthSession(token, currentUser);
    updateAccountUI(currentUser);
    hideAuthScreen();

    await loadServerConversations();
    return true;
  } catch {
    clearAuthSession();
    isAuthenticated = false;
    currentUser     = null;
    showAuthScreen();
    await initializeGoogleLogin();
    return false;
  }
}

function handleSessionExpired() {
  isAuthenticated = false;
  currentUser     = null;
  clearAuthSession();
  conversation   = [];
  chatHistory    = [];
  window.currentChatId = null;

  clearAttachment();
  if (messages) messages.innerHTML = "";
  welcome?.classList.remove("hidden");
  hideTyping();
  renderHistory();
  showAuthScreen();
  setAuthStatus("Your session expired. Please sign in again.");
  showAuthError("Your Gravity session has expired.");
}

/* LOGOUT */
async function logout() {
  if (isLoading) return;

  isAuthenticated = false;
  currentUser     = null;
  clearAuthSession();
  conversation   = [];
  chatHistory    = [];
  window.currentChatId = null;

  clearAttachment();
  if (messages) messages.innerHTML = "";
  welcome?.classList.remove("hidden");
  renderHistory();

  showAuthScreen();
  setAuthStatus("Signing out…");
  showAuthError("");
  closeMobileSidebar();

  await initializeGoogleLogin();
}

/* CONVERSATIONS */
async function loadServerConversations() {
  if (!isAuthenticated) return;

  try {
    const response = await authFetch(CONVERSATIONS_URL);
    const data = await parseJSON(response);

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to load conversations.");
    }

    chatHistory = Array.isArray(data.conversations) ? data.conversations : [];
    renderHistory(historySearch?.value || "");
  } catch (error) {
    console.error("Conversation loading error:", error);
  }
}

function renderHistory(searchText = "") {
  if (!historyList) return;
  historyList.innerHTML = "";

  const query = String(searchText || "").trim().toLowerCase();

  const filtered = chatHistory.filter((chat) => {
    const title = String(chat.title || "").toLowerCase();
    return !query || title.includes(query);
  });

  if (historyCount) {
    historyCount.textContent = filtered.length ? `${filtered.length}` : "";
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = query ? "No matching conversations" : "No conversations yet";
    historyList.appendChild(empty);
    return;
  }

  filtered.forEach((chat) => {
    const conversationId = chat.id || chat._id;
    if (!conversationId) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    if (conversationId === window.currentChatId) button.classList.add("active");
    button.dataset.id = conversationId;

    const icon = document.createElement("span");
    icon.className = "history-item-icon";
    icon.textContent = "◈";

    const label = document.createElement("span");
    label.className = "history-item-label";
    label.textContent = chat.title || "New Chat";

    button.appendChild(icon);
    button.appendChild(label);
    button.addEventListener("click", () => openConversation(conversationId));
    historyList.appendChild(button);
  });
}

/* OPEN CONVERSATION */
async function openConversation(conversationId) {
  if (!conversationId) { showToast("Invalid conversation", "error"); return; }
  if (isLoading) { showToast("Please wait a moment…", "info"); return; }
  if (!isAuthenticated || !getAuthToken()) {
    showToast("Session expired. Please sign in again.", "error");
    showAuthScreen();
    return;
  }

  try {
    showTyping("Loading conversation…");

    const response = await authFetch(`/api/conversation/${conversationId}/history`);
    const data     = await parseJSON(response);

    if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);
    if (!data.success) throw new Error(data.error || "Unable to open conversation.");

    const msgs =
      Array.isArray(data.messages) ? data.messages :
      Array.isArray(data.conversation?.messages) ? data.conversation.messages :
      [];

    window.currentChatId = conversationId;
    conversation = msgs;

    if (messages) messages.innerHTML = "";
    welcome?.classList.add("hidden");
    hideTyping();

    if (msgs.length === 0) {
      addMessageToUI("assistant", "This conversation is empty.");
    } else {
      msgs.forEach((message) => {
        if (message.role === "user") {
          const fileMeta = message.file
            ? { originalName: message.file.originalName, mimeType: message.file.mimeType, size: message.file.size }
            : null;
          addMessageToUI("user", message.content || "", null, fileMeta);
        } else {
          const blocks = textToBlocks(message.content || "");
          addMessageToUI("assistant", message.content || "", blocks);
        }
      });
    }

    renderHistory(historySearch?.value || "");
    closeMobileSidebar();
    scrollToBottom();
    showToast("Conversation loaded", "success");
  } catch (error) {
    hideTyping();
    console.error("Open conversation error:", error);
    showToast(error.message || "Unable to open conversation", "error");
    if (messages) messages.innerHTML = "";
    addMessageToUI("assistant", `Could not load this conversation.\n\n${error.message}`);
    welcome?.classList.add("hidden");
  }
}

/* NEW CHAT */
function newChat() {
  if (isLoading) return;

  conversation         = [];
  window.currentChatId = null;

  clearAttachment();
  if (messages) messages.innerHTML = "";
  welcome?.classList.remove("hidden");
  hideTyping();
  renderHistory(historySearch?.value || "");

  if (messageInput) {
    messageInput.value = "";
    autoResize();
    messageInput.focus();
  }
}

async function clearChat() {
  if (isLoading || !window.currentChatId) { newChat(); return; }

  const conversationId = window.currentChatId;

  try {
    const response = await authFetch(`/api/conversation/${conversationId}`, { method: "DELETE" });
    const data = await parseJSON(response);

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to delete conversation.");
    }

    showToast("Conversation deleted", "success");
    newChat();
    await loadServerConversations();
  } catch (error) {
    showToast(error.message || "Delete failed", "error");
  }
}

/* FILE ATTACHMENT */
function clearAttachment() {
  selectedFile = null;
  if (filePreviewURL) { URL.revokeObjectURL(filePreviewURL); filePreviewURL = null; }
  if (fileInput) fileInput.value = "";
  attachmentPreview?.classList.add("hidden");
  attachBtn?.classList.remove("has-file");
  if (attachmentIcon) attachmentIcon.innerHTML = "";
  if (attachmentName) attachmentName.textContent = "";
  if (attachmentSize) attachmentSize.textContent = "";
}

function setAttachment(file) {
  if (!file) return;

  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast(`File too large. Maximum ${MAX_FILE_SIZE_MB} MB.`, "error");
    clearAttachment();
    return;
  }

  clearAttachment();
  selectedFile = file;

  attachmentPreview?.classList.remove("hidden");
  attachBtn?.classList.add("has-file");

  if (attachmentName) attachmentName.textContent = file.name || "file";
  if (attachmentSize) attachmentSize.textContent = formatBytes(file.size);

  if (attachmentIcon) {
    attachmentIcon.innerHTML = "";
    if (isImageFile(file)) {
      filePreviewURL = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.src = filePreviewURL;
      img.alt = file.name || "image";
      attachmentIcon.appendChild(img);
    } else {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z");
      const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      poly.setAttribute("points", "14 2 14 8 20 8");
      svg.appendChild(path);
      svg.appendChild(poly);
      attachmentIcon.appendChild(svg);
    }
  }
}

/* TYPING */
function showTyping(text = "Gravity is thinking") {
  if (typingLabel) typingLabel.textContent = text;
  typingIndicator?.classList.remove("hidden");
  scrollToBottom();
}
function hideTyping() {
  typingIndicator?.classList.add("hidden");
}

/* MESSAGE UI */
function addMessageToUI(role, content, blocks = null, fileMeta = null) {
  if (!messages) return;

  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar gravity-avatar";
    avatar.textContent = "G";
    wrapper.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  if (role === "user") {
    if (fileMeta && (fileMeta.originalName || fileMeta.mimeType)) {
      const card = document.createElement("div");
      card.className = "file-card";

      const cardIcon = document.createElement("div");
      cardIcon.className = "file-card-icon";
      cardIcon.textContent = fileMeta.mimeType?.startsWith("image/") ? "🖼" : "📄";

      const info = document.createElement("div");
      info.className = "file-card-info";

      const nameEl = document.createElement("strong");
      nameEl.textContent = fileMeta.originalName || "file";

      const sizeEl = document.createElement("small");
      sizeEl.textContent = formatBytes(fileMeta.size || 0);

      info.appendChild(nameEl);
      info.appendChild(sizeEl);

      const tag = document.createElement("span");
      tag.className = "file-card-tag";
      tag.textContent = fileMeta.mimeType?.startsWith("image/") ? "Image" : "File";

      card.appendChild(cardIcon);
      card.appendChild(info);
      card.appendChild(tag);
      bubble.appendChild(card);
    }

    if (content && String(content).trim()) {
      const textNode = document.createElement("div");
      textNode.textContent = content;
      bubble.appendChild(textNode);
    }
  } else {
    const finalBlocks = Array.isArray(blocks) && blocks.length
      ? blocks
      : textToBlocks(content || "");
    renderBlocks(bubble, finalBlocks);
  }

  wrapper.appendChild(bubble);
  messages.appendChild(wrapper);
  scrollToBottom();
}

/* RENDER BLOCKS */
function renderBlocks(parent, blocks) {
  blocks.forEach((block) => {
    if (!block) return;
    const type    = block.type || "paragraph";
    const content = block.content || block.text || "";

    if (type === "heading") {
      const level = Math.min(Math.max(Number(block.level || 2), 1), 6);
      const el = document.createElement(`h${level}`);
      el.className = `block-heading block-heading-${level}`;
      appendInlineMarkdown(el, content);
      parent.appendChild(el);
      return;
    }
    if (type === "paragraph") {
      const p = document.createElement("p");
      p.className = "block-paragraph";
      appendInlineMarkdown(p, content);
      parent.appendChild(p);
      return;
    }
    if (type === "quote") {
      const q = document.createElement("blockquote");
      q.className = "block-quote";
      appendInlineMarkdown(q, content);
      parent.appendChild(q);
      return;
    }
    if (type === "code" || type === "code-block" || type === "formatted-code-block" || type === "g-code-block") {
      parent.appendChild(buildCodeBlock(content, block.language || ""));
      return;
    }
    if (type === "unordered-list") { renderList(parent, block.items || [], false); return; }
    if (type === "ordered-list")   { renderList(parent, block.items || [], true);  return; }
    if (type === "hr")             { parent.appendChild(document.createElement("hr")); return; }
    if (type === "table")          { renderTable(parent, block); return; }

    const p = document.createElement("p");
    p.className = "block-paragraph";
    appendInlineMarkdown(p, content);
    parent.appendChild(p);
  });
}

function buildCodeBlock(codeText, language) {
  const wrap = document.createElement("div");
  wrap.className = "code-block";

  const header = document.createElement("div");
  header.className = "code-header";

  const lang = document.createElement("span");
  lang.className = "code-language";
  lang.textContent = language || "code";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy-code-btn";
  copy.textContent = "Copy";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      copy.textContent = "Copied ✓";
      copy.classList.add("copied");
      setTimeout(() => { copy.textContent = "Copy"; copy.classList.remove("copied"); }, 1400);
    } catch {}
  });

  header.appendChild(lang);
  header.appendChild(copy);

  const body = document.createElement("div");
  body.className = "code-body";

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = codeText;
  pre.appendChild(code);
  body.appendChild(pre);

  wrap.appendChild(header);
  wrap.appendChild(body);
  return wrap;
}

function renderList(parent, items, ordered) {
  const list = document.createElement(ordered ? "ol" : "ul");
  list.className = ordered ? "block-ordered-list" : "block-unordered-list";
  items.forEach((item) => {
    const li = document.createElement("li");
    const text = typeof item === "string" ? item : item.text || item.content || "";
    appendInlineMarkdown(li, text);
    list.appendChild(li);
  });
  parent.appendChild(list);
}

function renderTable(parent, block) {
  const table = document.createElement("table");
  const rows = block.rows || [];
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const cells = Array.isArray(row) ? row : row.cells || [];
    cells.forEach((cell) => {
      const el = document.createElement(rowIndex === 0 ? "th" : "td");
      el.textContent = typeof cell === "string" ? cell : cell.text || cell.content || "";
      tr.appendChild(el);
    });
    table.appendChild(tr);
  });
  parent.appendChild(table);
}

/* TEXT → BLOCKS */
function textToBlocks(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [{ type: "paragraph", text: "" }];

  if (looksLikeFullHtml(raw)) {
    const cleaned = cleanHtmlPrefix(raw);
    return [{ type: "code", language: "html", text: cleaned }];
  }

  const lines = raw.split("\n");
  const blocks = [];

  let paragraph = [];
  let unordered = [];
  let ordered = [];

  let inCode = false;
  let codeLanguage = "";
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (joined) {
      if (looksLikeHtmlCode(joined)) {
        blocks.push({ type: "code", language: "html", text: cleanHtmlPrefix(joined) });
      } else {
        blocks.push({ type: "paragraph", text: joined });
      }
    }
    paragraph = [];
  };

  const flushLists = () => {
    if (unordered.length) {
      blocks.push({ type: "unordered-list", items: [...unordered] });
      unordered = [];
    }
    if (ordered.length) {
      blocks.push({ type: "ordered-list", items: [...ordered] });
      ordered = [];
    }
  };

  const flushCode = () => {
    if (!codeLines.length) return;
    blocks.push({
      type: "code",
      language: codeLanguage || "",
      text: codeLines.join("\n").trim()
    });
    codeLines = [];
    codeLanguage = "";
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (!inCode) {
        flushParagraph();
        flushLists();
        inCode = true;
        codeLanguage = trimmed.slice(3).trim();
      } else {
        inCode = false;
        flushCode();
      }
      return;
    }

    if (inCode) { codeLines.push(line); return; }

    if (!trimmed) { flushParagraph(); flushLists(); return; }

    if (looksLikeHtmlCode(trimmed)) {
      flushParagraph();
      flushLists();
      codeLines.push(line);
      codeLanguage = codeLanguage || "html";
      inCode = true;
      return;
    }

    const markdownHeading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (markdownHeading) {
      flushParagraph();
      flushLists();
      blocks.push({
        type: "heading",
        level: markdownHeading[1].length,
        text: markdownHeading[2].replace(/\*\*/g, "").trim()
      });
      return;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph();
      flushLists();
      blocks.push({ type: "hr" });
      return;
    }

    const emojiNumberMatch = trimmed.match(
      /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]+)\s+(\d+)[.)]\s+(.+)$/u
    );
    if (emojiNumberMatch) {
      flushParagraph();
      flushLists();
      blocks.push({
        type: "heading",
        level: 2,
        text: `${emojiNumberMatch[1]} ${emojiNumberMatch[2]}. ${emojiNumberMatch[3].replace(/\*\*/g, "").trim()}`
      });
      return;
    }

    const numberHeadingMatch = trimmed.match(/^(\d+)[.)]\s+([A-Z📱🔄⚙️🎯✨💡🚀📌🔹][^\n]{0,80})$/);
    if (numberHeadingMatch) {
      flushParagraph();
      flushLists();
      blocks.push({
        type: "heading",
        level: 2,
        text: `${numberHeadingMatch[1]}. ${numberHeadingMatch[2].replace(/\*\*/g, "").trim()}`
      });
      return;
    }

    const boldLabelMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*(.*)$/);
    if (boldLabelMatch) {
      flushParagraph();
      flushLists();
      const label = boldLabelMatch[1].trim();
      const rest = boldLabelMatch[2].trim();
      blocks.push({
        type: "paragraph",
        text: rest ? `**${label}** ${rest}` : `**${label}**`
      });
      return;
    }

    const bulletMatch = trimmed.match(/^[-+•]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (ordered.length) flushLists();
      unordered.push(bulletMatch[1].trim());
      return;
    }

    const starMatch = trimmed.match(/^\*\s+(.+)$/);
    if (starMatch && !/^\*\s*\{/.test(trimmed) && !/^\*\s*,\s*\*/.test(trimmed)) {
      flushParagraph();
      if (ordered.length) flushLists();
      unordered.push(starMatch[1].trim());
      return;
    }

    const numberMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numberMatch) {
      flushParagraph();
      if (unordered.length) flushLists();
      ordered.push(numberMatch[2].trim());
      return;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      flushLists();
      blocks.push({
        type: "quote",
        text: trimmed.replace(/^>\s?/, "").trim()
      });
      return;
    }

    if (unordered.length || ordered.length) flushLists();
    paragraph.push(trimmed);
  });

  if (inCode) flushCode();
  flushParagraph();
  flushLists();

  if (!blocks.length) blocks.push({ type: "paragraph", text: raw });

  return blocks;
}

/* HTML detection */
function looksLikeHtmlCode(str) {
  if (!str) return false;
  const s = String(str);

  const startsWithHtmlWord = /^HTML\s/i.test(s);
  const hasHtmlTag = /<(html|head|body|style|script|div|span|section|header|footer|nav|main|article|h[1-6]|p|a|img|ul|ol|li|table|tr|td|th|form|input|button|meta|link|title)\b[^>]*>/i.test(s);
  const hasDoctype = /<!DOCTYPE\s+html/i.test(s);
  const hasCssBlock = /\{\s*[a-z-]+\s*:\s*[^}]+\}/i.test(s);
  const hasCssAsterisk = /^\s*\*\s*\{/m.test(s) || /\*\s*,\s*\*/m.test(s);

  return startsWithHtmlWord || hasHtmlTag || hasDoctype || hasCssBlock || hasCssAsterisk;
}

function looksLikeFullHtml(text) {
  const t = String(text || "").trim();
  if (t.length < 60) return false;

  const hasDoctype = /<!DOCTYPE\s+html/i.test(t);
  const hasHtmlTag = /<html[\s>]/i.test(t);
  const hasBodyTag = /<body[\s>]/i.test(t);
  const hasStyleTag = /<style[\s>]/i.test(t);
  const hasCloseHtml = /<\/html>/i.test(t);

  const markers = [hasDoctype, hasHtmlTag, hasBodyTag, hasStyleTag, hasCloseHtml]
    .filter(Boolean).length;

  return markers >= 3;
}

function cleanHtmlPrefix(text) {
  return String(text || "")
    .replace(/^\s*HTML\s+(?=<!DOCTYPE|<html)/i, "")
    .trim();
}

/* INLINE MARKDOWN */
function appendInlineMarkdown(parent, text) {
  const source = String(text || "");
  let index = 0;

  while (index < source.length) {
    if (source.startsWith("**", index)) {
      const end = source.indexOf("**", index + 2);
      if (end !== -1) {
        const strong = document.createElement("strong");
        strong.textContent = source.slice(index + 2, end);
        parent.appendChild(strong);
        index = end + 2;
        continue;
      }
    }

    if (source[index] === "*" && source[index + 1] !== "*") {
      const end = source.indexOf("*", index + 1);
      if (end !== -1 && end > index + 1) {
        const em = document.createElement("em");
        em.textContent = source.slice(index + 1, end);
        parent.appendChild(em);
        index = end + 1;
        continue;
      }
    }

    if (source[index] === "`") {
      const end = source.indexOf("`", index + 1);
      if (end !== -1) {
        const code = document.createElement("code");
        code.className = "inline-code";
        code.textContent = source.slice(index + 1, end);
        parent.appendChild(code);
        index = end + 1;
        continue;
      }
    }

    const linkMatch = source.slice(index).match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);
    if (linkMatch) {
      const link = document.createElement("a");
      link.textContent = linkMatch[1];
      link.href = linkMatch[2];
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      parent.appendChild(link);
      index += linkMatch[0].length;
      continue;
    }

    let next = source.length;
    ["`", "*", "["].forEach((c) => {
      const pos = source.indexOf(c, index + 1);
      if (pos !== -1 && pos < next) next = pos;
    });

    parent.appendChild(document.createTextNode(source.slice(index, next)));
    index = next;
  }
}

/* SEND MESSAGE */
async function sendMessage(providedQuestion = null) {
  if (isLoading) return;
  if (!isAuthenticated) { showAuthScreen(); return; }

  const question = providedQuestion !== null
    ? String(providedQuestion).trim()
    : String(messageInput?.value || "").trim();

  const hasFile = Boolean(selectedFile);
  if (!question && !hasFile) return;

  isLoading = true;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add("loading"); }
  if (messageInput) messageInput.disabled = true;
  if (attachBtn) attachBtn.disabled = true;

  welcome?.classList.add("hidden");

  const fileToSend = selectedFile;
  const fileMeta = fileToSend
    ? { originalName: fileToSend.name, mimeType: fileToSend.type, size: fileToSend.size }
    : null;

  const userText = hasFile
    ? (question || `Analyze this file: ${fileToSend.name}`)
    : question;

  addMessageToUI("user", userText, null, fileMeta);
  conversation.push({ role: "user", content: userText, file: fileMeta });

  clearAttachment();

  if (providedQuestion === null && messageInput) {
    messageInput.value = "";
    autoResize();
  }

  showTyping(
    hasFile
      ? (isImageFile(fileToSend) ? "Gravity is analyzing your image" : "Gravity is analyzing your file")
      : "Gravity is thinking"
  );

  try {
    if (hasFile) {
      await sendFileAnalysis(fileToSend, question);
    } else {
      await sendChat(question);
    }
  } catch (error) {
    hideTyping();
    const errorMessage = `Sorry, I couldn't complete that request.\n\n${error.message}`;
    addMessageToUI("assistant", errorMessage);
    conversation.push({ role: "assistant", content: errorMessage });
    showToast(error.message || "Request failed", "error");
  } finally {
    isLoading = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove("loading"); }
    if (messageInput) { messageInput.disabled = false; messageInput.focus(); }
    if (attachBtn) attachBtn.disabled = false;
    scrollToBottom();
  }
}

async function sendChat(question) {
  const response = await authFetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, conversationId: window.currentChatId || null })
  });
  const data = await parseJSON(response);

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || data.error || data.message || `Request failed (${response.status})`);
  }

  if (data.conversationId) window.currentChatId = data.conversationId;

  const answer = data.answer || "Gravity received an empty response.";
  const blocks = Array.isArray(data.blocks) && data.blocks.length
    ? data.blocks
    : textToBlocks(answer);

  hideTyping();
  addMessageToUI("assistant", answer, blocks);
  conversation.push({ role: "assistant", content: answer, blocks });

  await loadServerConversations();
  renderHistory(historySearch?.value || "");
}

async function sendFileAnalysis(file, question) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("question", question || "");
  if (window.currentChatId) formData.append("conversationId", window.currentChatId);

  const response = await authFetch(ANALYZE_FILE_URL, { method: "POST", body: formData });
  const data = await parseJSON(response);

  if (!response.ok || !data.success) {
    const rawError = data.error?.message || data.error || data.message || `File analysis failed (${response.status})`;
    const isOverloaded = response.status === 503 || /UNAVAILABLE|high demand|503|overload/i.test(String(rawError));
    if (isOverloaded) {
      throw new Error("The AI model is temporarily overloaded. Please try again in a few seconds.");
    }
    throw new Error(rawError);
  }

  if (data.conversationId) window.currentChatId = data.conversationId;

  const answer = data.answer || "Gravity could not analyze this file.";
  const blocks = Array.isArray(data.blocks) && data.blocks.length
    ? data.blocks
    : textToBlocks(answer);

  hideTyping();
  addMessageToUI("assistant", answer, blocks);
  conversation.push({ role: "assistant", content: answer, blocks });

  await loadServerConversations();
  renderHistory(historySearch?.value || "");
}

/* AUTO RESIZE */
function autoResize() {
  if (!messageInput) return;
  messageInput.style.height = "auto";
  messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
}

/* SCROLL */
function scrollToBottom() {
  requestAnimationFrame(() => {
    const chatArea = $("chatArea");
    if (!chatArea) return;
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

/* MOBILE SIDEBAR */
function openMobileSidebar() {
  sidebar?.classList.add("open");
  sidebarOverlay?.classList.add("show");
}
function closeMobileSidebar() {
  sidebar?.classList.remove("open");
  sidebarOverlay?.classList.remove("show");
}

/* EVENTS */
function setupEvents() {
  sendBtn?.addEventListener("click", (e) => { e.preventDefault(); sendMessage(); });

  messageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  messageInput?.addEventListener("input", autoResize);

  newChatBtn?.addEventListener("click", () => { newChat(); closeMobileSidebar(); });
  clearChatBtn?.addEventListener("click", clearChat);

  historySearch?.addEventListener("input", () => renderHistory(historySearch.value));

  menuBtn?.addEventListener("click", openMobileSidebar);
  sidebarClose?.addEventListener("click", closeMobileSidebar);
  sidebarOverlay?.addEventListener("click", closeMobileSidebar);

  document.querySelectorAll(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.question;
      if (q) sendMessage(q);
    });
  });

  logoutBtn?.addEventListener("click", logout);

  attachBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
  });
  attachmentRemove?.addEventListener("click", clearAttachment);

  const chatArea = $("chatArea");
  if (chatArea) {
    chatArea.addEventListener("dragover", (e) => { e.preventDefault(); chatArea.classList.add("drag-over"); });
    chatArea.addEventListener("dragleave", () => chatArea.classList.remove("drag-over"));
    chatArea.addEventListener("drop", (e) => {
      e.preventDefault();
      chatArea.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file) setAttachment(file);
    });
  }

  messageInput?.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) { setAttachment(file); e.preventDefault(); return; }
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      newChat();
    }
  });
}

/* GLOBAL ERRORS */
window.addEventListener("error", (e) => console.error("Frontend error:", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.error("Unhandled promise:", e.reason));

/* INIT */
async function initializeGravity() {
  autoResize();
  setupEvents();
  showAuthScreen();
  await restoreSession();
  if (isAuthenticated) messageInput?.focus();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGravity);
} else {
  initializeGravity();
}