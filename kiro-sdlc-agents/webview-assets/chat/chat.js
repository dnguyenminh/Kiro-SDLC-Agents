/**
 * Chat Panel Main Logic — KSA-210 + KSA-230 (Kiro-style)
 * Handles message rendering, streaming, tool calls, context chips,
 * model selector, autopilot toggle, attachments, and extension comms.
 */

(function () {
  "use strict";

  var vscode = acquireVsCodeApi();

  // === DOM References ===
  var messagesEl = document.getElementById("chat-messages");
  var inputEl = document.getElementById("chat-input");
  var sendBtn = document.getElementById("send-btn");
  var statusEl = document.getElementById("status-indicator");
  var welcomeEl = document.getElementById("welcome-state");
  var workingBar = document.getElementById("working-bar");
  var workingText = document.getElementById("working-text");
  var cancelBtn = document.getElementById("cancel-btn");
  var followBtn = document.getElementById("follow-btn");
  var stopBtn = document.getElementById("stop-btn");
  var ctxBtn = document.getElementById("ctx-btn");
  var attachBtn = document.getElementById("attach-btn");
  var modelBtn = document.getElementById("model-btn");
  var modelLabel = document.getElementById("model-label");
  var modelDropdown = document.getElementById("model-dropdown");
  var contextMenu = document.getElementById("context-menu");
  var autopilotToggle = document.getElementById("autopilot-toggle");
  var inputChipsEl = document.getElementById("input-context-chips");

  // === State ===
  var streamingNodes = {};
  var isStreaming = false;
  var hasMessages = false;
  var currentModel = "auto";
  var currentMode = "autopilot";
  var contextItems = [];
  var toolCalls = {};
  var messageHistory = [];
  var historyIndex = -1;
  var pendingInput = "";

  // === Initialization ===
  vscode.postMessage({ type: "ready" });

  // === Welcome Suggestions ===
  var suggestionBtns = welcomeEl.querySelectorAll(".welcome-suggestions button");
  for (var i = 0; i < suggestionBtns.length; i++) {
    suggestionBtns[i].addEventListener("click", function () {
      var cmd = this.getAttribute("data-cmd");
      inputEl.value = cmd;
      inputEl.focus();
      if (cmd === "status" || cmd === "resume") {
        sendMessage();
      }
    });
  }

  // === Send ===
  sendBtn.addEventListener("click", sendMessage);

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "#" && inputEl.value === "") {
      e.preventDefault();
      toggleContextMenu();
    }
    // Up/Down arrow history navigation
    if (e.key === "ArrowUp" && inputEl.value === "" && messageHistory.length > 0) {
      e.preventDefault();
      if (historyIndex === -1) {
        pendingInput = inputEl.value;
        historyIndex = messageHistory.length - 1;
      } else if (historyIndex > 0) {
        historyIndex--;
      }
      inputEl.value = messageHistory[historyIndex];
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 300) + "px";
    }
    if (e.key === "ArrowDown" && historyIndex !== -1) {
      e.preventDefault();
      if (historyIndex < messageHistory.length - 1) {
        historyIndex++;
        inputEl.value = messageHistory[historyIndex];
      } else {
        historyIndex = -1;
        inputEl.value = pendingInput;
      }
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 300) + "px";
    }
  });

  inputEl.addEventListener("input", function () {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 300) + "px";
  });

  // === Paste Image Handler ===
  var inputAttachmentsEl = document.getElementById("input-attachments");
  var pastedAttachments = []; // { type, name, dataUrl }

  inputEl.addEventListener("paste", function (e) {
    var items = (e.clipboardData || window.clipboardData).items;
    if (!items) return;

    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (!file) continue;

        var reader = new FileReader();
        reader.onload = function (ev) {
          var dataUrl = ev.target.result;
          var name = "pasted-image-" + (pastedAttachments.length + 1) + ".png";
          pastedAttachments.push({ type: "image", name: name, dataUrl: dataUrl });
          renderAttachments();
        };
        reader.readAsDataURL(file);
      }
    }
  });

  // === Drag & Drop Image/File ===
  var inputWrapper = document.querySelector(".input-wrapper");

  inputWrapper.addEventListener("dragover", function (e) {
    e.preventDefault();
    inputWrapper.style.borderColor = "var(--vscode-focusBorder, #6366f1)";
  });

  inputWrapper.addEventListener("dragleave", function () {
    inputWrapper.style.borderColor = "";
  });

  inputWrapper.addEventListener("drop", function (e) {
    e.preventDefault();
    inputWrapper.style.borderColor = "";
    var files = e.dataTransfer.files;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (file.type.indexOf("image") !== -1) {
        var reader = new FileReader();
        reader.onload = (function (f) {
          return function (ev) {
            pastedAttachments.push({ type: "image", name: f.name, dataUrl: ev.target.result });
            renderAttachments();
          };
        })(file);
        reader.readAsDataURL(file);
      } else {
        pastedAttachments.push({ type: "file", name: file.name, dataUrl: null });
        renderAttachments();
      }
    }
  });

  function renderAttachments() {
    inputAttachmentsEl.innerHTML = "";
    for (var i = 0; i < pastedAttachments.length; i++) {
      var att = pastedAttachments[i];
      if (att.type === "image" && att.dataUrl) {
        var wrapper = document.createElement("div");
        wrapper.className = "input-attachment";
        var img = document.createElement("img");
        img.src = att.dataUrl;
        img.alt = att.name;
        wrapper.appendChild(img);
        var removeBtn = document.createElement("button");
        removeBtn.className = "attach-remove";
        removeBtn.textContent = "\u00D7";
        removeBtn.setAttribute("data-idx", i.toString());
        removeBtn.addEventListener("click", function () {
          var idx = parseInt(this.getAttribute("data-idx"));
          pastedAttachments.splice(idx, 1);
          renderAttachments();
        });
        wrapper.appendChild(removeBtn);
        inputAttachmentsEl.appendChild(wrapper);
      } else {
        var ref = document.createElement("div");
        ref.className = "input-file-ref";
        ref.innerHTML = '<span class="file-ref-icon">\u1F4C4</span>' +
          '<span class="file-ref-name">' + escapeHtml(att.name) + '</span>' +
          '<span class="file-ref-remove" data-idx="' + i + '">\u00D7</span>';
        ref.querySelector(".file-ref-remove").addEventListener("click", function () {
          var idx = parseInt(this.getAttribute("data-idx"));
          pastedAttachments.splice(idx, 1);
          renderAttachments();
        });
        inputAttachmentsEl.appendChild(ref);
      }
    }
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 300) + "px";
  }

  function addFileReference(item) {
    if (item.type === "file" || item.type === "folder") {
      pastedAttachments.push({ type: "file", name: item.label, dataUrl: null });
      renderAttachments();
    }
  }

  // === Cancel / Stop ===
  cancelBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "chat:cancelStream" });
    setWorking(false);
  });

  stopBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "chat:cancelStream" });
    setWorking(false);
  });

  followBtn.addEventListener("click", function () {
    scrollToBottom();
  });

  // === Context Menu (#) ===
  ctxBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleContextMenu();
  });

  function toggleContextMenu() {
    contextMenu.classList.toggle("hidden");
    modelDropdown.classList.add("hidden");
  }

  var ctxMenuBtns = contextMenu.querySelectorAll("button");
  for (var c = 0; c < ctxMenuBtns.length; c++) {
    ctxMenuBtns[c].addEventListener("click", function () {
      var ctxType = this.getAttribute("data-ctx");
      vscode.postMessage({ type: "chat:pickContext", contextType: ctxType });
      contextMenu.classList.add("hidden");
    });
  }

  // === Attachment Button ===
  attachBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "chat:pickAttachment" });
  });

  // === Model Selector ===
  modelBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    modelDropdown.classList.toggle("hidden");
    contextMenu.classList.add("hidden");
  });

  // Available models are populated dynamically from the extension
  // (chat:models message) based on the configured SDLC provider.
  var availableModels = [];
  var supportsAuto = true;

  // Delegate clicks on dynamically-rendered model buttons.
  modelDropdown.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("button[data-model]") : null;
    if (!btn) return;
    var model = btn.getAttribute("data-model");
    setModel(model);
    modelDropdown.classList.add("hidden");
    vscode.postMessage({ type: "chat:setModel", model: model });
  });

  function renderModelDropdown() {
    modelDropdown.innerHTML = "";
    if (supportsAuto) {
      modelDropdown.appendChild(makeModelButton({ id: "auto", name: "Auto" }));
    }
    for (var i = 0; i < availableModels.length; i++) {
      modelDropdown.appendChild(makeModelButton(availableModels[i]));
    }
    // Reflect current selection
    var allBtns = modelDropdown.querySelectorAll("button");
    for (var j = 0; j < allBtns.length; j++) {
      allBtns[j].classList.toggle("active", allBtns[j].getAttribute("data-model") === currentModel);
    }
  }

  function makeModelButton(model) {
    var btn = document.createElement("button");
    btn.setAttribute("data-model", model.id);
    // KSA-237: render name + rate badge like Kiro IDE
    var nameSpan = document.createElement("span");
    nameSpan.className = "model-item-name";
    nameSpan.textContent = model.name;
    btn.appendChild(nameSpan);

    if (typeof model.rateMultiplier === "number") {
      var badge = document.createElement("span");
      badge.className = "model-rate-badge";
      if (model.rateMultiplier === 0) {
        badge.textContent = "Free";
        badge.classList.add("rate-free");
      } else {
        badge.textContent = model.rateMultiplier + (model.rateMultiplier === 1 ? " Credit" : " Credits");
      }
      btn.appendChild(badge);
    }

    if (model.description) {
      var desc = document.createElement("span");
      desc.className = "model-item-desc";
      desc.textContent = model.description;
      btn.appendChild(desc);
    }

    return btn;
  }

  function labelForModel(model) {
    if (model === "auto") return "Auto";
    for (var i = 0; i < availableModels.length; i++) {
      if (availableModels[i].id === model) {
        var lbl = availableModels[i].name;
        // KSA-237: show compact rate in the button label
        if (typeof availableModels[i].rateMultiplier === "number" && availableModels[i].rateMultiplier !== 1) {
          if (availableModels[i].rateMultiplier === 0) {
            lbl += " (Free)";
          } else {
            lbl += " (" + availableModels[i].rateMultiplier + "x)";
          }
        }
        return lbl;
      }
    }
    return model;
  }

  function setModel(model) {
    currentModel = model;
    modelLabel.textContent = labelForModel(model);
    var allBtns = modelDropdown.querySelectorAll("button");
    for (var i = 0; i < allBtns.length; i++) {
      allBtns[i].classList.toggle("active", allBtns[i].getAttribute("data-model") === model);
    }
  }

  // === Autopilot Toggle ===
  autopilotToggle.addEventListener("click", function () {
    var isOn = autopilotToggle.classList.contains("on");
    autopilotToggle.classList.toggle("on", !isOn);
    currentMode = isOn ? "supervised" : "autopilot";
    vscode.postMessage({ type: "chat:setMode", mode: currentMode });
  });

  // === Close dropdowns on outside click ===
  document.addEventListener("click", function () {
    modelDropdown.classList.add("hidden");
    contextMenu.classList.add("hidden");
  });

  // === Message Handler from Extension ===
  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case "chat:streamChunk":
        handleStreamChunk(msg);
        break;
      case "chat:streamComplete":
        handleStreamComplete(msg);
        break;
      case "chat:graphUpdate":
        break;
      case "chat:approvalRequest":
        renderApprovalCard(msg.checkpoint);
        break;
      case "chat:chatHistory":
        renderChatHistory(msg.messages);
        break;
      case "chat:pipelineStatus":
        handlePipelineStatus(msg);
        break;
      case "chat:resumePrompt":
        renderResumePrompt(msg);
        break;
      case "chat:error":
        renderError(msg);
        setWorking(false);
        break;
      case "chat:toolCall":
        renderToolCall(msg.toolCall);
        break;
      case "chat:toolCallUpdate":
        updateToolCall(msg);
        break;
      case "chat:contextPicked":
        addContextChip(msg.item);
        addFileReference(msg.item);
        break;
      case "chat:configUpdate":
        setModel(msg.model);
        if (msg.mode) {
          currentMode = msg.mode;
          autopilotToggle.classList.toggle("on", msg.mode === "autopilot");
        }
        break;
      case "chat:models":
        availableModels = Array.isArray(msg.models) ? msg.models : [];
        supportsAuto = msg.supportsAuto !== false;
        renderModelDropdown();
        if (msg.selected) {
          setModel(msg.selected);
        } else if (supportsAuto) {
          setModel("auto");
        } else if (availableModels.length > 0) {
          setModel(availableModels[0].id);
        }
        break;
      case "chat:workingStatus":
        setWorking(msg.working, msg.label);
        break;
      case "chat:nodeDetails":
        break;
      case "serverStatus":
        updateServerStatus(msg.status);
        break;
    }
  });

  // === Send Message ===
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text && pastedAttachments.length === 0) return;

    showMessages();
    if (text) appendMessage("user", text);
    if (pastedAttachments.length > 0) {
      for (var a = 0; a < pastedAttachments.length; a++) {
        if (pastedAttachments[a].type === "image") {
          appendMessage("user", "[Image: " + pastedAttachments[a].name + "]");
        }
      }
    }
    setWorking(true);

    var attachments = pastedAttachments.map(function (att) {
      return { name: att.name, type: att.type === "image" ? "image/png" : "application/octet-stream", size: 0, uri: att.dataUrl || "" };
    });

    vscode.postMessage({
      type: "chat:userMessage",
      text: text || "(attached files)",
      context: contextItems.length > 0 ? contextItems : undefined,
      attachments: attachments.length > 0 ? attachments : undefined
    });

    inputEl.value = "";
    inputEl.style.height = "auto";
    clearContextChips();
    pastedAttachments = [];
    renderAttachments();
    // Save to history for Up/Down navigation
    if (text) {
      messageHistory.push(text);
      if (messageHistory.length > 50) messageHistory.shift();
    }
    historyIndex = -1;
    pendingInput = "";
  }

  // === Working Status ===
  function setWorking(active, label) {
    if (active) {
      workingBar.classList.add("active");
      workingText.textContent = label || "Working...";
      stopBtn.style.display = "inline-flex";
      isStreaming = true;
    } else {
      workingBar.classList.remove("active");
      stopBtn.style.display = "none";
      isStreaming = false;
    }
  }

  // Map a node status signal to a friendly working-bar label.
  function statusLabel(nodeId, status) {
    var node = (nodeId || "agent").toString();
    var s = (status || "").toString();
    if (s === "active" || s === "") {
      return node === "chat" ? "Thinking..." : node.toUpperCase() + " working...";
    }
    return node.toUpperCase() + ": " + s;
  }

  // === Show messages (hide welcome) ===
  function showMessages() {
    if (!hasMessages) {
      welcomeEl.classList.add("hidden");
      messagesEl.classList.remove("hidden");
      hasMessages = true;
    }
  }

  // === Message Rendering ===
  function appendMessage(role, content, nodeId) {
    showMessages();
    var el = document.createElement("div");
    el.className = "message " + role;

    if (nodeId) {
      var badge = document.createElement("span");
      badge.className = "node-badge " + nodeId;
      badge.textContent = nodeId.toUpperCase();
      el.appendChild(badge);
    }

    var contentEl = document.createElement("span");
    if (role === "user") {
      contentEl.textContent = content;
    } else {
      contentEl.innerHTML = MarkdownRenderer.render(content);
      addCodeActions(contentEl);
    }
    el.appendChild(contentEl);

    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function renderChatHistory(messages) {
    messagesEl.innerHTML = "";
    if (messages && messages.length > 0) {
      showMessages();
      for (var i = 0; i < messages.length; i++) {
        appendMessage(messages[i].role, messages[i].content, messages[i].nodeId);
      }
    }
  }

  // === Streaming ===
  function handleStreamChunk(msg) {
    showMessages();
    setWorking(true, "Working...");

    if (!streamingNodes[msg.nodeId]) {
      var el = document.createElement("div");
      el.className = "message assistant streaming";

      var badge = document.createElement("span");
      badge.className = "node-badge " + msg.nodeId;
      badge.textContent = msg.nodeId.toUpperCase();
      el.appendChild(badge);

      var contentEl = document.createElement("span");
      contentEl.className = "stream-content";
      el.appendChild(contentEl);

      messagesEl.appendChild(el);
      streamingNodes[msg.nodeId] = { el: el, content: "" };
    }

    var node = streamingNodes[msg.nodeId];

    if (msg.eventType === "token") {
      node.content += msg.content;
      var contentSpan = node.el.querySelector(".stream-content");
      contentSpan.innerHTML = MarkdownRenderer.render(node.content);
      addCodeActions(contentSpan);
    } else if (msg.eventType === "status") {
      // Status is a node lifecycle signal (e.g. "active"), NOT answer content.
      // Show it on the working bar only — never concatenate into the reply
      // bubble, otherwise the bubble shows literal "active" (KSA-237).
      setWorking(true, statusLabel(msg.nodeId, msg.content));
    } else if (msg.eventType === "error") {
      node.el.classList.add("error");
      node.el.classList.remove("streaming");
      var errSpan = node.el.querySelector(".stream-content");
      errSpan.innerHTML = MarkdownRenderer.render("**Error:** " + msg.content);
      delete streamingNodes[msg.nodeId];
    }

    scrollToBottom();
  }

  function handleStreamComplete(msg) {
    var node = streamingNodes[msg.nodeId];
    if (node) {
      node.el.classList.remove("streaming");
      if (!node.content && msg.finalContent && !msg.finalContent.startsWith("Node ")) {
        var contentSpan = node.el.querySelector(".stream-content");
        contentSpan.innerHTML = MarkdownRenderer.render(msg.finalContent);
        addCodeActions(contentSpan);
      }
      delete streamingNodes[msg.nodeId];
    }

    if (Object.keys(streamingNodes).length === 0) {
      setWorking(false);
    }
  }

  // === Tool Calls (Collapsible) ===
  function renderToolCall(tc) {
    showMessages();
    var block = document.createElement("div");
    block.className = "tool-call-block";
    block.id = "tc-" + tc.id;

    var header = document.createElement("div");
    header.className = "tool-call-header";
    header.innerHTML = '<span class="tool-chevron">&#x25B6;</span>' +
      '<span class="tool-icon">&#x1F527;</span>' +
      '<span class="tool-name">' + escapeHtml(tc.name) + '</span>' +
      '<span class="tool-status ' + tc.status + '">' + statusIcon(tc.status) + '</span>';

    header.addEventListener("click", function () {
      block.classList.toggle("expanded");
    });

    var body = document.createElement("div");
    body.className = "tool-call-body";
    body.textContent = tc.args ? JSON.stringify(tc.args, null, 2) : "";

    block.appendChild(header);
    block.appendChild(body);
    messagesEl.appendChild(block);
    toolCalls[tc.id] = block;
    scrollToBottom();
  }

  function updateToolCall(msg) {
    var block = toolCalls[msg.id];
    if (!block) return;
    var statusSpan = block.querySelector(".tool-status");
    statusSpan.className = "tool-status " + msg.status;
    statusSpan.textContent = statusIcon(msg.status);
    if (msg.result) {
      var body = block.querySelector(".tool-call-body");
      body.textContent = msg.result;
    }
    if (msg.duration) {
      var dur = document.createElement("span");
      dur.style.cssText = "margin-left:8px;opacity:0.5;font-size:10px;";
      dur.textContent = msg.duration + "ms";
      block.querySelector(".tool-call-header").appendChild(dur);
    }
  }

  function statusIcon(status) {
    if (status === "running") return "\u23F3";
    if (status === "completed") return "\u2713";
    if (status === "failed") return "\u2717";
    return "";
  }

  // === Context Chips ===
  function addContextChip(item) {
    contextItems.push(item);
    renderContextChips();
  }

  function removeContextChip(index) {
    contextItems.splice(index, 1);
    renderContextChips();
  }

  function clearContextChips() {
    contextItems = [];
    inputChipsEl.innerHTML = "";
  }

  function renderContextChips() {
    inputChipsEl.innerHTML = "";
    for (var i = 0; i < contextItems.length; i++) {
      var chip = document.createElement("span");
      chip.className = "context-chip";
      chip.innerHTML = '<span class="chip-icon">#</span>' +
        escapeHtml(contextItems[i].label) +
        '<span class="chip-remove" data-idx="' + i + '">\u00D7</span>';
      inputChipsEl.appendChild(chip);
    }
    var removeBtns = inputChipsEl.querySelectorAll(".chip-remove");
    for (var r = 0; r < removeBtns.length; r++) {
      removeBtns[r].addEventListener("click", function () {
        removeContextChip(parseInt(this.getAttribute("data-idx")));
      });
    }
  }

  // === Pipeline Status ===
  function handlePipelineStatus(msg) {
    if (msg.status === "running") {
      setWorking(true, msg.ticketKey + " \u2014 " + msg.phase);
    } else if (msg.status === "completed" || msg.status === "cancelled" || msg.status === "failed") {
      setWorking(false);
    }
    var statusText = msg.ticketKey
      ? msg.ticketKey + " \u2014 " + msg.phase + " (" + msg.status + ")"
      : msg.status;
    appendMessage("system", statusText);
  }

  // === Approval Card ===
  function renderApprovalCard(checkpoint) {
    showMessages();
    setWorking(false);
    var card = document.createElement("div");
    card.className = "approval-card";

    var title = document.createElement("h4");
    title.textContent = checkpoint.gateId + ": " + checkpoint.summary;
    card.appendChild(title);

    if (checkpoint.criteria && checkpoint.criteria.length > 0) {
      var ul = document.createElement("ul");
      for (var i = 0; i < checkpoint.criteria.length; i++) {
        var li = document.createElement("li");
        li.textContent = checkpoint.criteria[i];
        ul.appendChild(li);
      }
      card.appendChild(ul);
    }

    var actions = document.createElement("div");
    actions.className = "actions";

    var approveBtn = document.createElement("button");
    approveBtn.className = "approve";
    approveBtn.textContent = "Approve";
    approveBtn.addEventListener("click", function () {
      vscode.postMessage({ type: "chat:approvalAction", decision: "approve" });
      card.remove();
      appendMessage("system", "Approved \u2014 continuing pipeline...");
      setWorking(true);
    });

    var reviseBtn = document.createElement("button");
    reviseBtn.className = "revise";
    reviseBtn.textContent = "Revise";
    reviseBtn.addEventListener("click", function () {
      vscode.postMessage({ type: "chat:approvalAction", decision: "revise" });
      card.remove();
      appendMessage("system", "Revision requested \u2014 re-running phase...");
      setWorking(true);
    });

    var rejectBtn = document.createElement("button");
    rejectBtn.className = "reject";
    rejectBtn.textContent = "Reject";
    rejectBtn.addEventListener("click", function () {
      vscode.postMessage({ type: "chat:approvalAction", decision: "reject" });
      card.remove();
      appendMessage("system", "Rejected \u2014 pipeline stopped.");
    });

    actions.appendChild(approveBtn);
    actions.appendChild(reviseBtn);
    actions.appendChild(rejectBtn);
    card.appendChild(actions);
    messagesEl.appendChild(card);
    scrollToBottom();
  }

  // === Resume Prompt ===
  function renderResumePrompt(msg) {
    showMessages();
    var prompt = document.createElement("div");
    prompt.className = "resume-prompt";

    var p = document.createElement("p");
    p.textContent = "Pipeline paused: " + msg.ticketKey + " \u2014 " + msg.phase;
    prompt.appendChild(p);

    var resumeBtn = document.createElement("button");
    resumeBtn.textContent = "Resume";
    resumeBtn.addEventListener("click", function () {
      vscode.postMessage({ type: "chat:resumePipeline", threadId: msg.threadId });
      prompt.remove();
      setWorking(true, "Resuming...");
    });

    var freshBtn = document.createElement("button");
    freshBtn.textContent = "Start Fresh";
    freshBtn.addEventListener("click", function () {
      vscode.postMessage({ type: "chat:startFresh" });
      prompt.remove();
    });

    prompt.appendChild(resumeBtn);
    prompt.appendChild(freshBtn);
    messagesEl.appendChild(prompt);
    scrollToBottom();
  }

  // === Error ===
  function renderError(msg) {
    showMessages();
    appendMessage("error", msg.message);
  }

  // === Server Status ===
  function updateServerStatus(status) {
    statusEl.textContent = status;
    statusEl.className = "status " + status;
  }

  // === Code Actions (Copy, Apply, Insert) ===
  function addCodeActions(container) {
    var preBlocks = container.querySelectorAll("pre");
    for (var i = 0; i < preBlocks.length; i++) {
      if (preBlocks[i].querySelector(".code-actions")) continue;
      var pre = preBlocks[i];
      var actionsDiv = document.createElement("div");
      actionsDiv.className = "code-actions";

      actionsDiv.appendChild(createCodeBtn("Copy", pre, function (p) {
        var code = p.querySelector("code");
        var text = code ? code.textContent : p.textContent;
        navigator.clipboard.writeText(text || "");
      }));

      actionsDiv.appendChild(createCodeBtn("Apply", pre, function (p) {
        var code = p.querySelector("code");
        var text = code ? code.textContent : p.textContent;
        vscode.postMessage({ type: "chat:applyCode", code: text || "" });
      }));

      actionsDiv.appendChild(createCodeBtn("Insert", pre, function (p) {
        var code = p.querySelector("code");
        var text = code ? code.textContent : p.textContent;
        vscode.postMessage({ type: "chat:insertCode", code: text || "" });
      }));

      pre.appendChild(actionsDiv);

      // Language label
      var codeEl = pre.querySelector("code");
      if (codeEl && codeEl.className) {
        var langMatch = codeEl.className.match(/language-(\w+)/);
        if (langMatch) {
          var langLabel = document.createElement("span");
          langLabel.className = "code-lang-label";
          langLabel.textContent = langMatch[1];
          pre.appendChild(langLabel);
        }
      }
    }
  }

  function createCodeBtn(label, pre, handler) {
    var btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", (function (p) {
      return function () { handler(p); };
    })(pre));
    return btn;
  }

  // === Utilities ===
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function escapeHtml(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
})();
