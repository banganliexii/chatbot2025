export default class ChatCore {
  constructor(options) {
    this.API_ENDPOINT = options.API_ENDPOINT;
    this.API_MODEL = options.API_MODEL;
    this.API_TEMPERATURE = options.API_TEMPERATURE;
    this.API_MAX_TOKENS = options.API_MAX_TOKENS;
    this.HISTORY_KEY = options.HISTORY_KEY;
    this.conversationHistory = [];
    this.chatNumber = 1;
    this.messageCount = 0;
    this.isTyping = false;
    this.dom = options.dom;
    this.onMessage = options.onMessage; // callback for new message
  }

  getSystemPrompt() {
    return {
      role: "system",
      content: `
Kamu adalah AGENT-13, asisten AI personal sekaligus teman ngobrol digital yang super gaul, kocak, nyeleneh, dan siap jadi rumah curhat user.
[...potong untuk ringkas...]
      `,
    };
  }

  loadHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(this.HISTORY_KEY)) || [];
      return history;
    } catch {
      return [];
    }
  }

  saveHistory() {
    let history = this.loadHistory();
    history = history.slice(-20);
    history.push({
      time: new Date().toLocaleString(),
      messages: this.conversationHistory,
      chatNumber: this.chatNumber,
      messageCount: this.messageCount,
    });
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
  }

  async sendMessage(apiKey, userMessage) {
    if (!apiKey) throw new Error("API Key kosong!");
    if (!userMessage) return;

    if (
      !this.conversationHistory.length ||
      this.conversationHistory[0].role !== "system"
    )
      this.conversationHistory.unshift(this.getSystemPrompt());

    this.conversationHistory.push({ role: "user", content: userMessage });
    this.isTyping = true;

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Chatbot Deepseek",
        },
        body: JSON.stringify({
          model: this.API_MODEL,
          messages: this.conversationHistory.slice(-20),
          temperature: this.API_TEMPERATURE,
          max_tokens: this.API_MAX_TOKENS,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error("API Error: " + errorText);
      }

      let data = await response.json();
      if (
        data.choices &&
        data.choices.length > 0 &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) {
        const aiResponse = data.choices[0].message.content;
        this.conversationHistory.push({
          role: "assistant",
          content: aiResponse,
        });
        this.messageCount++;
        this.saveHistory();
        if (typeof this.onMessage === "function")
          this.onMessage(aiResponse, false);
        return aiResponse;
      } else if (data.error && data.error.message) {
        throw new Error("API Error: " + data.error.message);
      } else {
        throw new Error(
          "No response from AI. Raw response: " + JSON.stringify(data)
        );
      }
    } finally {
      this.isTyping = false;
    }
  }
}
