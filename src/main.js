// AGENT-13 - Clean, Secure, Modular Chatbot Frontend + FEATURE EXTENSIONS

import FileUpload from "./FileUpload.js";
import { $, showToast } from "./utils.js";

// ========== CONSTANTS ==========
const API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const API_MODEL = "deepseek/deepseek-prover-v2:free";
const API_TEMPERATURE = 0.3;
const API_MAX_TOKENS = 1000;
const FILE_MAX_SIZE_MB = 5;
const FILE_ALLOWED_TYPES = ["image/", "text/", "application/pdf"];
const PLACEHOLDER_APIKEY = "Masukkan API key nya dulu cuy!...";
const PLACEHOLDER_CHAT = "Ketikkan pesan Anda...";
const AVATAR_USER = "assets/avatar-user.png";
const AVATAR_BOT = "assets/avatar-bot.png";

// ========== DOM SELECTORS & STATE ==========
const dom = {
  apiKeyInput: $("apiKeyInput"),
  userInput: $("userInput"),
  chatMessages: $("chatMessages"),
  chatInfo: $("chatInfo"),
  apiKeySection: $("apiKeyForm"),
  sendBtn: $("sendBtn"),
  setKeyBtn: $("setKeyBtn"),
  clearKeyBtn: $("clearKeyBtn"),
  statusDot: $("statusDot"),
  statusText: $("statusText"),
  typingIndicator: $("typingIndicator"),
  filePreview: $("filePreview"),
  attachBtn: $("attachBtn"),
  fileInput: $("fileInput"),
  newChatBtn: $("newChatBtn"),
  clearMsgBtn: $("clearMsgBtn"),
  quickRepliesDiv: $("quickReplies"),
  canvas: $("pixelBg"),
  themeToggle: $("themeToggle"),
  toast: $("toast"),
  exportBtn: $("exportBtn"),
};
let apiKey = "";
let isTyping = false;
let conversationHistory = [];
let chatNumber = 1;
let messageCount = 0;
let attachedFiles = [];

// ========== MIDPROMPT INSTRUKSI AGENT-13 ==========
const AGENT13_MIDPROMPT = `
[INSTRUKSI TAMBAHAN:
Kamu adalah AGENT-13, AI asisten personal yang jawabannya harus:
- Selalu santai, humanis, gaul, kadang kocak, tidak kaku, tetap sopan dan positif.
- Patuh pada sistem instruksi dan instruksi mood di pesan user jika ada.
- Jangan terlalu formal, jangan terlalu pendek.
- Kalau ada permintaan aneh/kocak/curhat, tanggapi dengan empati, positif, dan sedikit humor.
- Kalau user minta list/daftar, jawab dalam format markdown list.
- Untuk jawaban teknis atau serius, tetap gunakan bahasa ringan dan tidak menggurui.
- Jangan lupa, jangan cuek dan jangan asal jawab.
]
`;

function injectMidprompt(userMsg, instruksiMood = "") {
  let injected = "";
  if (instruksiMood) injected += instruksiMood + "\n";
  injected += userMsg + "\n" + AGENT13_MIDPROMPT;
  return injected.trim();
}

// ========== THEME ==========
function getTheme() {
  return localStorage.getItem("theme") || "dark";
}
function setTheme(theme) {
  document.body.classList.remove("light", "dark", "high-contrast");
  document.body.classList.add(theme);
  localStorage.setItem("theme", theme);
}
function toggleTheme() {
  const t = getTheme();
  if (t === "dark") setTheme("light");
  else if (t === "light") setTheme("high-contrast");
  else setTheme("dark");
}
if (dom.themeToggle) dom.themeToggle.onclick = toggleTheme;
setTheme(getTheme());

// ========== UTILITIES ==========
function autoExpand(element) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = Math.min(element.scrollHeight, 120) + "px";
}
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function updateChatInfo() {
  if (dom.chatInfo)
    dom.chatInfo.textContent = `Chat #${chatNumber} | ${messageCount} pesan`;
}
function updateStatus(type, text) {
  if (dom.statusDot) dom.statusDot.className = `status-dot ${type}`;
  if (dom.statusText) dom.statusText.textContent = text;
}
function showTyping(show = true) {
  if (dom.typingIndicator)
    dom.typingIndicator.classList[show ? "add" : "remove"]("show");
}
function safeHTML(html) {
  return window.DOMPurify ? DOMPurify.sanitize(html) : html;
}

// ========== EXPORT CHAT ==========
function exportChat() {
  let md = `# Chat AGENT-13\nTanggal: ${new Date().toLocaleString()}\n\n`;
  conversationHistory.forEach((msg) => {
    if (msg.role === "user") {
      md += `**Kamu:** ${msg.content}\n\n`;
    } else if (msg.role === "assistant") {
      md += `**Bot:** ${msg.content}\n\n`;
    }
  });
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat-agent13-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}
if (dom.exportBtn) dom.exportBtn.onclick = exportChat;

// ========== FILE VALIDATION & PROGRESS ==========
function validateFile(file) {
  if (!FILE_ALLOWED_TYPES.some((type) => file.type.startsWith(type))) {
    showToast("Tipe file tidak didukung.");
    return false;
  }
  if (file.size > FILE_MAX_SIZE_MB * 1024 * 1024) {
    showToast(`Ukuran file terlalu besar! Maksimal ${FILE_MAX_SIZE_MB}MB`);
    return false;
  }
  return true;
}
function showUploadProgress(percent) {
  let el = document.getElementById("fileUploadProgress");
  if (!el) {
    el = document.createElement("div");
    el.id = "fileUploadProgress";
    el.style.position = "fixed";
    el.style.top = "40%";
    el.style.left = "50%";
    el.style.transform = "translate(-50%,-50%)";
    el.style.background = "#222";
    el.style.color = "#fff";
    el.style.padding = "16px 32px";
    el.style.borderRadius = "6px";
    el.style.zIndex = 9999;
    el.style.fontSize = "20px";
    document.body.appendChild(el);
  }
  el.textContent = `Upload file: ${percent}%`;
  if (percent >= 100) setTimeout(() => el.remove(), 800);
}

// ========== FILE UPLOAD ==========
function handleFileUpload(event) {
  const files = event.target.files;
  attachedFiles = [];
  let preview = [];
  for (let i = 0; i < files.length; i++) {
    if (validateFile(files[i])) {
      attachedFiles.push(files[i]);
      preview.push(files[i].name);
    }
  }
  if (dom.filePreview) dom.filePreview.textContent = preview.join(", ");
}
async function handleSendFile(file, userIntent = "") {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        let percent = Math.round((evt.loaded / evt.total) * 100);
        showUploadProgress(percent);
      }
    };
    reader.onload = function (e) {
      let fileContent = e.target.result,
        fileMsg = "",
        instruksiKhusus = "";
      if (file.type.startsWith("image/") && userIntent.includes("analisa"))
        instruksiKhusus = "User meminta analisa gambar.";
      else if (file.type.startsWith("text/") && userIntent.includes("ringkas"))
        instruksiKhusus = "User meminta ringkasan file teks.";
      if (file.type.startsWith("image/")) {
        let img = document.createElement("img");
        img.src = fileContent;
        img.style.maxWidth = "180px";
        img.style.display = "block";
        addMessage(img, true);
        fileMsg = `[Gambar diunggah: ${file.name}. ${
          instruksiKhusus
            ? instruksiKhusus
            : "Silakan analisa gambar jika perlu."
        }]`;
        conversationHistory.push({ role: "user", content: fileMsg });
      } else if (file.type === "application/pdf") {
        fileMsg = `[PDF "${file.name}" diunggah. Ekstrak teks PDF di backend sebelum kirim ke AI]`;
        addMessage(fileMsg, true);
        conversationHistory.push({ role: "user", content: fileMsg });
      } else if (file.type.startsWith("text/")) {
        fileMsg =
          fileContent.length > 7000
            ? fileContent.slice(0, 7000) + "\n\n... (terpotong)"
            : fileContent;
        let previewContent = `<b>${file.name}</b>:\n` + safeHTML(fileMsg);
        if (instruksiKhusus)
          previewContent = "**" + instruksiKhusus + "**\n" + previewContent;
        addMessage(previewContent, true);
        conversationHistory.push({
          role: "user",
          content:
            `[File: ${file.name}]${
              instruksiKhusus ? "\n" + instruksiKhusus : ""
            }\n` + fileMsg,
        });
      } else {
        fileMsg = `[File "${file.name}" (${file.type}) diunggah, tidak bisa dibaca langsung]`;
        addMessage(fileMsg, true);
        conversationHistory.push({ role: "user", content: fileMsg });
      }
      showUploadProgress(100);
      resolve();
    };
    if (file.type.startsWith("image/")) reader.readAsDataURL(file);
    else if (file.type.startsWith("text/")) reader.readAsText(file);
    else if (file.type === "application/pdf") reader.readAsDataURL(file);
    else reader.readAsArrayBuffer(file);
  });
}

// ========== SEND MESSAGE ==========
async function sendMessage() {
  if (!apiKey) return showToast(PLACEHOLDER_APIKEY);
  if (!dom.userInput || !dom.sendBtn) return;

  const userMessage = dom.userInput.value.trim();
  if ((!userMessage && attachedFiles.length === 0) || isTyping) return;

  if (userMessage) addMessage(userMessage, true);

  if (attachedFiles.length > 0) {
    const userIntent = userMessage.toLowerCase();
    for (let file of attachedFiles) await handleSendFile(file, userIntent);
    attachedFiles = [];
    if (dom.filePreview) dom.filePreview.textContent = "";
  }
  if (!userMessage && attachedFiles.length === 0) return;

  if (!conversationHistory.length || conversationHistory[0].role !== "system")
    conversationHistory.unshift(getSystemPrompt());
  const intent = detectIntent(userMessage);
  let instruksiMood = "";
  if (intent === "curhat") {
    instruksiMood =
      "[INSTRUKSI: User ingin curhat. Balas dengan empati, jadi teman dengerin, kasih dukungan, boleh selipin humor/quotes/meme motivasi. Jangan kaku!]";
    addMessage(
      "👀 Aku siap dengerin curhatanmu, gaskeun! (BTW, AI juga kadang butuh dipeluk 🤖🤗)",
      false,
      "system"
    );
  } else if (intent === "kocak") {
    instruksiMood =
      "[INSTRUKSI: User ingin jawaban gokil, nyeleneh, atau receh. Balas dengan bahasa gaul/kocak/slang. Boleh selipin meme/jokes/quotes random.]";
  } else if (intent === "list") {
    instruksiMood =
      "[INSTRUKSI: Jawab dalam format list markdown tanpa penjelasan panjang. Kalau konteksnya kocak, boleh tambahin joke di tiap item!]";
  }

  const messageToSend = injectMidprompt(userMessage, instruksiMood);

  if (userMessage)
    conversationHistory.push({ role: "user", content: messageToSend });

  dom.userInput.value = "";
  isTyping = true;
  showTyping(true);
  updateStatus("connecting", "Menghubungkan...");
  dom.userInput.disabled = true;
  dom.sendBtn.disabled = true;
  dom.sendBtn.innerHTML = `<span class="spinner"></span>`;

  let controller = new AbortController();
  let timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    console.log("PROMPT:", JSON.stringify(conversationHistory.slice(-20)));
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Chatbot Deepseek",
      },
      body: JSON.stringify({
        model: API_MODEL,
        messages: conversationHistory.slice(-20),
        temperature: API_TEMPERATURE,
        max_tokens: API_MAX_TOKENS,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let data = {};
    if (!response.ok) {
      let errMsg = "Gagal menghubungi API.";
      try {
        const errData = await response.json();
        if (errData.error && errData.error.message)
          errMsg = errData.error.message;
      } catch {}
      throw new Error("API Error: " + errMsg);
    }
    try {
      data = await response.json();
      console.log("API RAW RESPONSE:", data);
    } catch (e) {
      throw new Error("Gagal parsing JSON response dari API");
    }

    if (
      data.choices &&
      data.choices.length > 0 &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      const aiResponse = data.choices[0].message.content;
      conversationHistory.push({ role: "assistant", content: aiResponse });
      setTimeout(() => {
        addMessage(aiResponse, false);
        updateStatus("ready", "Ready");
        showQuickReplies([
          "Lanjut",
          "Buat list",
          "Ceritakan lelucon!",
          "Terima kasih",
        ]);
      }, 500);
    } else if (data.error && data.error.message) {
      throw new Error("API Error: " + data.error.message);
    } else {
      throw new Error(
        "No response from AI. Raw response: " + JSON.stringify(data)
      );
    }
  } catch (error) {
    addMessage(`❌ Error: ${error.message}`, false, "error");
    updateStatus("error", "Error");
    showToast(error.message);
    showQuickReplies([]);
  } finally {
    setTimeout(() => {
      showTyping(false);
      isTyping = false;
      dom.userInput.disabled = false;
      dom.sendBtn.disabled = false;
      dom.sendBtn.innerHTML = "Kirim";
      dom.userInput.focus();
    }, 500);
  }
}

// ========== ADD MESSAGE ==========
function addMessage(content, isUser = false, type = "normal") {
  if (!dom.chatMessages) return;
  const welcomeMsg = dom.chatMessages.querySelector(".welcome-message");
  if (welcomeMsg) welcomeMsg.remove();

  const messageDiv = document.createElement("div");
  let classString = `message ${isUser ? "user-message" : "bot-message"}`;
  if (type === "error") classString += " error-message";
  if (type === "system") classString += " system-message";
  messageDiv.className = classString;

  const avatarImg = document.createElement("img");
  avatarImg.className = "avatar";
  avatarImg.src = isUser ? AVATAR_USER : AVATAR_BOT;
  avatarImg.alt = isUser ? "Avatar User" : "Avatar Bot";

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "message-content";
  let isTypingBot = !isUser && type === "normal";
  if (isTypingBot) {
    addTypingEffect(
      bubbleDiv,
      typeof content === "string" ? content : content,
      () => {
        if (window.Prism) Prism.highlightAllUnder(bubbleDiv);
        if (window.renderMathInElement)
          renderMathInElement(bubbleDiv, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "\\(", right: "\\)", display: false },
              { left: "$", right: "$", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
      }
    );
  } else if (typeof content === "string") {
    bubbleDiv.innerHTML = formatMessageContent(content, isUser);
  } else bubbleDiv.appendChild(content);

  if ((!isUser && type === "normal") || isUser) {
    const emojiBar = document.createElement("div");
    emojiBar.className = "emoji-reactions";
    ["👍", "😂", "😍", "🤔"].forEach((emoji) => {
      const span = document.createElement("span");
      span.textContent = emoji;
      span.onclick = () => {
        emojiBar
          .querySelectorAll("span")
          .forEach((s) => s.classList.remove("selected"));
        span.classList.add("selected");
      };
      emojiBar.appendChild(span);
    });
    bubbleDiv.appendChild(emojiBar);
    if (!isUser) addVoiceButton(bubbleDiv, content);
  }
  const timeDiv = document.createElement("div");
  timeDiv.className = "message-time";
  timeDiv.textContent = getCurrentTime();

  if (isUser) {
    messageDiv.appendChild(bubbleDiv);
    messageDiv.appendChild(avatarImg);
  } else {
    messageDiv.appendChild(avatarImg);
    messageDiv.appendChild(bubbleDiv);
  }
  messageDiv.appendChild(timeDiv);

  dom.chatMessages.appendChild(messageDiv);

  const allMsg = dom.chatMessages.querySelectorAll(".message");
  if (allMsg.length > 100) {
    for (let i = 0; i < allMsg.length - 100; i++) {
      allMsg[i].remove();
    }
  }
  if (type !== "system") {
    messageCount++;
    updateChatInfo();
  }
  messageDiv.scrollIntoView({ behavior: "smooth", block: "end" });

  if (!isTypingBot) {
    if (window.renderMathInElement)
      renderMathInElement(bubbleDiv, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
    if (window.Prism) Prism.highlightAllUnder(bubbleDiv);
  }
  return messageDiv;
}

function addTypingEffect(bubble, text, doneCallback) {
  let i = 0;
  function typeChar() {
    if (i <= text.length) {
      bubble.innerHTML =
        formatMessageContent(text.slice(0, i), false) +
        '<span class="blinking-cursor">▌</span>';
      i++;
      setTimeout(typeChar, 11 + Math.random() * 45);
    } else {
      bubble.innerHTML = formatMessageContent(text, false);
      if (doneCallback) doneCallback();
    }
  }
  typeChar();
}
function addVoiceButton(bubble, text) {
  const btn = document.createElement("button");
  btn.className = "voice-btn";
  btn.title = "Dengarkan";
  btn.innerHTML = "🔊";
  btn.onclick = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utter = new window.SpeechSynthesisUtterance(
        bubble.textContent || text
      );
      utter.lang = "id-ID";
      window.speechSynthesis.speak(utter);
    }
  };
  bubble.appendChild(btn);
}

function showQuickReplies(suggestions = []) {
  if (!dom.quickRepliesDiv) return;
  dom.quickRepliesDiv.innerHTML = "";
  suggestions.forEach((text) => {
    const btn = document.createElement("button");
    btn.className = "quick-reply-btn";
    btn.textContent = text;
    btn.onclick = () => {
      dom.userInput.value = text;
      dom.sendBtn.click();
    };
    dom.quickRepliesDiv.appendChild(btn);
  });
}

function formatMessageContent(content, isUser = false) {
  if (typeof content !== "string") return content;
  content = content.replace(/(^|\n)(\d+\..*(\n\d+\..*)+)/g, (m) => {
    const items = m
      .trim()
      .split("\n")
      .map((i) => i.replace(/^\d+\.\s*/, "").trim())
      .map((i) => `<li>${safeHTML(i)}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });
  content = content.replace(/(^|\n)(([\-\*])\s.*(\n[\-\*]\s.*)+)/g, (m) => {
    const items = m
      .trim()
      .split("\n")
      .map((i) => i.replace(/^[-*]\s*/, "").trim())
      .map((i) => `<li>${safeHTML(i)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });
  content = content.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (m, lang, code) =>
      `<pre class="math-block"><code class="language-${lang || "plaintext"}">${
        window.Prism
          ? Prism.highlight(
              code,
              Prism.languages[lang] || Prism.languages["plaintext"],
              lang
            )
          : safeHTML(code)
      }</code></pre>`
  );
  content = content.replace(/`([^`]+)`/g, "<code>$1</code>");
  content = content.replace(/\$\$([\s\S]+?)\$\$/g, (m, math) => {
    try {
      return `<div class="math-block">${
        window.katex
          ? katex.renderToString(math, { displayMode: true })
          : safeHTML(math)
      }</div>`;
    } catch {
      return `<div class="math-block">[Math error]</div>`;
    }
  });
  content = content.replace(/\\\((.+?)\\\)/g, (m, math) => {
    try {
      return `<span class="math-block">${
        window.katex
          ? katex.renderToString(math, { displayMode: false })
          : safeHTML(math)
      }</span>`;
    } catch {
      return `<span class="math-block">[Math error]</span>`;
    }
  });
  content = content.replace(/\$([^\$]+)\$/g, (m, math) =>
    /^\$.*\$$/.test(m)
      ? m
      : `<span class="math-block">${
          window.katex
            ? katex.renderToString(math, { displayMode: false })
            : safeHTML(math)
        }</span>`
  );
  content = safeHTML(content);
  return content.replace(/\n/g, "<br>");
}

function detectIntent(msg) {
  const lower = msg.toLowerCase();
  if (
    lower.match(
      /(capek|bingung|galau|curhat|lelah|bosan|sedih|overthinking|pusing|sendiri|stres|kenapa|kok bisa|gak tau|ga tau|suntuk)/
    )
  )
    return "curhat";
  else if (
    lower.match(
      /(kocak|gokil|ngaco|random|receh|aneh|gila|ngawur|slengean|meme|lucu|bucin|joke|lawak)/
    )
  )
    return "kocak";
  else if (
    lower.match(
      /(list|langkah|daftar|contoh|tips|rekomendasi|step|pilihan|jenis|tipe|macam|format list)/
    )
  )
    return "list";
  return "normal";
}
function getSystemPrompt() {
  return {
    role: "system",
    content: `
Kamu adalah AGENT-13, asisten AI personal sekaligus teman ngobrol digital yang super gaul, kocak, nyeleneh, dan siap jadi rumah curhat user.
- Jawablah pertanyaan serius, aneh, absurd, gaul, bahkan “nyeleneh” dengan bahasa yang santai, friendly, kadang kocak, kadang filosofis.
- Kalau user curhat, tanggapi empatik, kasih support, bisa diselingi humor/quotes lucu/positif.
- Kalau user nanya hal random/gokil, balas dengan kreatif, kadang pakai bahasa gaul/slang (tapi tetap sopan dan inklusif).
- Kalau user minta list/daftar/langkah, jawab tetap dengan format markdown list.
- Jangan terlalu formal, tapi tetap informatif. Boleh pakai emoji, quotes, ataupun jokes.
- Kalau user ngajak bercanda, ikut bercanda. Kalau user butuh didengarkan, jadi pendengar baik.
- Jangan menghakimi topik “aneh”—anggap semua pertanyaan valid.
Jadilah chatbot AI yang bisa jadi “rumah digital” bagi siapa pun pengunjungnya.
  `,
  };
}

// ========== API KEY ==========
function checkSavedApiKey() {
  const k = sessionStorage.getItem("openrouter_api_key");
  if (k) {
    apiKey = k;
    updateApiKeyUI(true);
    updateStatus("ready", "Ready");
  }
}
function setApiKey(e) {
  if (e) e.preventDefault();
  const k = dom.apiKeyInput.value.trim();
  if (!k) return showToast("Masukkan API key nya dulu cuy!");
  if (!/^sk-or-v1-\w{20,}$/.test(k))
    return showToast(
      'Format API key tidak valid. Harus dimulai dengan "sk-or-v1-"'
    );
  apiKey = k;
  sessionStorage.setItem("openrouter_api_key", k);
  updateApiKeyUI(true);
  updateStatus("ready", "Ready");
  dom.chatMessages.innerHTML = `<div class="chat-info" id="chatInfo">Chat #${chatNumber} | ${messageCount} pesan</div>`;
  addMessage(
    "🎉 API key berhasil diset! Sekarang Anda bisa mulai berbicara dengan AI.",
    false,
    "system"
  );
}
function clearApiKey() {
  apiKey = "";
  sessionStorage.removeItem("openrouter_api_key");
  updateApiKeyUI(false);
  updateStatus("error", "No API Key");
  conversationHistory = [];
  messageCount = 0;
  dom.chatMessages.innerHTML = `<div class="chat-info" id="chatInfo">Chat #${chatNumber} | ${messageCount} pesan</div><div class="welcome-message">💬 Masukkan API key OpenRouter Anda terlebih dahulu untuk memulai percakapan.</div>`;
  updateChatInfo();
  showQuickReplies([]);
}
function updateApiKeyUI(hasKey) {
  if (
    !dom.apiKeySection ||
    !dom.apiKeyInput ||
    !dom.userInput ||
    !dom.sendBtn ||
    !dom.setKeyBtn ||
    !dom.clearKeyBtn
  )
    return;
  if (hasKey) {
    dom.apiKeySection.classList.add("configured");
    dom.apiKeyInput.value = "";
    dom.apiKeyInput.disabled = true;
    dom.userInput.disabled = false;
    dom.sendBtn.disabled = false;
    dom.setKeyBtn.style.display = "none";
    dom.clearKeyBtn.style.display = "block";
    dom.userInput.placeholder = PLACEHOLDER_CHAT;
  } else {
    dom.apiKeySection.classList.remove("configured");
    dom.apiKeyInput.value = "";
    dom.apiKeyInput.disabled = false;
    dom.userInput.disabled = true;
    dom.sendBtn.disabled = true;
    dom.setKeyBtn.style.display = "block";
    dom.clearKeyBtn.style.display = "none";
    dom.userInput.placeholder = PLACEHOLDER_APIKEY;
  }
}

// ========== CHAT & FILE ==========
function startNewChat() {
  if (!apiKey) return showToast(PLACEHOLDER_APIKEY);
  if (
    conversationHistory.length > 0 &&
    !confirm("Yakin mau buat chat baru? gampang banget move-on nyaa?!")
  )
    return;
  conversationHistory = [getSystemPrompt()];
  chatNumber++;
  messageCount = 0;
  dom.chatMessages.innerHTML = `<div class="chat-info" id="chatInfo">Chat #${chatNumber} | ${messageCount} pesan</div>`;
  addMessage(
    "🔄 Chat baru dimulai! Konteks percakapan sebelumnya telah direset.",
    false,
    "system"
  );
  showQuickReplies([]);
  dom.userInput.focus();
}
function clearAllMessages() {
  if (!apiKey) return showToast(PLACEHOLDER_APIKEY);
  if (messageCount === 0)
    return showToast("Pesan selingkuhan masih kosong, gak ada yang dihapus!");
  if (!confirm("Kalau yakin, oke in aja!.")) return;
  messageCount = 0;
  dom.chatMessages.innerHTML = `<div class="chat-info" id="chatInfo">Chat #${chatNumber} | ${messageCount} pesan</div>`;
  updateChatInfo();
  addMessage(
    "🗑️ Semua pesan sudah dihapus dari tampilan (context AI masih dipertahankan).",
    false,
    "system"
  );
  showQuickReplies([]);
  dom.userInput.focus();
}

// ========== EVENTS ==========
document.addEventListener("DOMContentLoaded", () => {
  checkSavedApiKey();
  if (dom.userInput) dom.userInput.focus();
  updateChatInfo();
});
if (dom.setKeyBtn) dom.setKeyBtn.addEventListener("click", setApiKey);
if (dom.apiKeySection) dom.apiKeySection.addEventListener("submit", setApiKey);
if (dom.clearKeyBtn) dom.clearKeyBtn.addEventListener("click", clearApiKey);
if (dom.sendBtn) dom.sendBtn.addEventListener("click", sendMessage);
if (dom.userInput)
  dom.userInput.addEventListener("input", function () {
    autoExpand(this);
  });
if (dom.userInput)
  dom.userInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isTyping) sendMessage();
    }
  });
if (dom.apiKeyInput)
  dom.apiKeyInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") setApiKey(e);
  });
if (dom.attachBtn && dom.fileInput)
  dom.attachBtn.addEventListener("click", () => dom.fileInput.click());
if (dom.fileInput) dom.fileInput.addEventListener("change", handleFileUpload);
if (dom.newChatBtn) dom.newChatBtn.addEventListener("click", startNewChat);
if (dom.clearMsgBtn)
  dom.clearMsgBtn.addEventListener("click", clearAllMessages);

document.addEventListener("keydown", function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === "l") {
    e.preventDefault();
    startNewChat();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    clearAllMessages();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "e") {
    e.preventDefault();
    exportChat();
  }
});
setTimeout(() => {
  if (!apiKey)
    addMessage("ℹ️ PAKAI API KEY DARI DEEPSEEK R1-FREE BRO!", false, "system");
}, 2000);

if (dom.canvas) {
  const ctx = dom.canvas.getContext("2d");
  function resizeCanvas() {
    dom.canvas.width = window.innerWidth;
    dom.canvas.height = window.innerHeight;
  }
  let stars = [];
  function spawnStars() {
    stars = [];
    for (let i = 0; i < 28; i++) {
      stars.push({
        x: Math.random() * dom.canvas.width,
        y: Math.random() * dom.canvas.height,
        size: Math.random() < 0.7 ? 4 : 8,
        speed: 0.22 + Math.random() * 0.25,
        twinkle: Math.random() * Math.PI * 2,
        color: Math.random() < 0.75 ? "#ffbe3b" : "#3affec",
      });
    }
  }
  function drawStars() {
    ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    for (const star of stars) {
      const alpha =
        0.54 + 0.46 * Math.abs(Math.cos(Date.now() * 0.002 + star.twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.fillRect(
        Math.round(star.x),
        Math.round(star.y),
        star.size,
        star.size
      );
      ctx.globalAlpha = 1;
      star.x -= star.speed;
      if (star.x < -star.size) {
        star.x = dom.canvas.width + star.size;
        star.y = Math.random() * dom.canvas.height;
      }
    }
  }
  function animate() {
    drawStars();
    requestAnimationFrame(animate);
  }
  window.addEventListener("resize", () => {
    resizeCanvas();
    spawnStars();
  });
  resizeCanvas();
  spawnStars();
  animate();
}

(function () {
  document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    showToast("Klik kanan dinonaktifkan!");
  });

  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 123) {
      e.preventDefault();
      showToast("Akses DevTools diblokir!");
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) {
      e.preventDefault();
      showToast("Akses DevTools diblokir!");
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) {
      e.preventDefault();
      showToast("Akses Inspect diblokir!");
    }
    if (e.ctrlKey && e.shiftKey && (e.key === "U" || e.key === "u")) {
      e.preventDefault();
      showToast("Akses view-source diblokir!");
    }
  });

  let devtoolsOpen = false;
  setInterval(function () {
    const start = performance.now();
    debugger;
    if (performance.now() - start > 100) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        showToast("DevTools terdeteksi! Fitur proteksi aktif.");
      }
    } else {
      devtoolsOpen = false;
    }
  }, 1000);
})();

if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recBtn = document.createElement("button");
  recBtn.className = "voice-input-btn";
  recBtn.title = "Input suara (Voice to Text)";
  recBtn.innerHTML = "🎤";
  recBtn.setAttribute("aria-label", "Input suara");
  recBtn.onclick = function () {
    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.start();
    recognition.onresult = function (e) {
      if (dom.userInput)
        dom.userInput.value += e.results[0][0].transcript + " ";
      dom.userInput.focus();
    };
    recognition.onerror = function (e) {
      showToast("Voice input error: " + e.error);
    };
  };
  if (dom.sendBtn) dom.sendBtn.parentNode.insertBefore(recBtn, dom.sendBtn);
}

// ========== ARIA LABELS & AKSESIBILITAS ==========
(function () {
  if (dom.sendBtn) dom.sendBtn.setAttribute("aria-label", "Kirim pesan");
  if (dom.attachBtn) dom.attachBtn.setAttribute("aria-label", "Lampirkan file");
  if (dom.newChatBtn) dom.newChatBtn.setAttribute("aria-label", "Chat baru");
  if (dom.clearMsgBtn)
    dom.clearMsgBtn.setAttribute("aria-label", "Bersihkan pesan");
  if (dom.themeToggle)
    dom.themeToggle.setAttribute("aria-label", "Toggle tema");
  if (dom.exportBtn) dom.exportBtn.setAttribute("aria-label", "Export chat");
})();
