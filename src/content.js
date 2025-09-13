import Compressor from "compressorjs";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
// =============================================================================
// CRITICAL FIX: Tell pdf.js where to find its worker file.
// Your bundler must be configured to copy 'pdf.worker.mjs' from 'node_modules'
// into your 'dist' folder as 'pdf.worker.js'.
// =============================================================================
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.js");

const PROMPT_TEXTAREA_SELECTOR =
  'textarea[data-id="root"], textarea[placeholder*="Message"]';
let isInitialized = false;
let typingTimeout = null;

function init() {
  if (isInitialized) return;
  const textarea = document.querySelector(PROMPT_TEXTAREA_SELECTOR);
  if (textarea) {
    console.log("AI Optimizer Suite: Initializing...");
    textarea.addEventListener("keyup", handleTypingSearch);
    textarea.addEventListener("keydown", handleSendAndCache);
    window.addEventListener("drop", handleFileDrop, true);
    window.addEventListener("dragover", (e) => e.preventDefault(), true);
    isInitialized = true;
    console.log("AI Optimizer Suite: Initialized successfully");
  } else {
    setTimeout(init, 500);
  }
}

// ... (The rest of your content.js code remains the same as the previous correct version)

async function handleTypingSearch(event) {
  clearTimeout(typingTimeout);
  const promptText = event.target.value.trim();
  if (promptText.length < 25) return;

  typingTimeout = setTimeout(async () => {
    try {
      const result = await chrome.runtime.sendMessage({
        action: "searchCache",
        text: promptText,
      });
      if (result && result.match) {
        showMemoryNotification(result.match, result.similarity);
      }
    } catch (error) {
      if (error.message.includes("Receiving end does not exist")) {
        console.warn(
          "AI Optimizer Suite: Could not connect to background script. It might be inactive."
        );
      } else {
        console.error("Error searching cache:", error.message);
      }
    }
  }, 1000);
}

function handleSendAndCache(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    const prompt = event.target.value.trim();
    if (prompt) {
      observeForResponse(prompt);
    }
  }
}

function observeForResponse(prompt) {
  const chatContainer = document.querySelector("main .overflow-y-auto");
  if (!chatContainer) return;

  const observer = new MutationObserver((mutationsList, obs) => {
    const stopGeneratingButton = document.querySelector(
      'button[aria-label="Stop generating"], button[data-testid="stop-button"]'
    );
    if (stopGeneratingButton) return;

    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        if (
          Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              node.querySelector(".markdown")
          )
        ) {
          cachePromptAndAnswer(prompt);
          obs.disconnect();
          return;
        }
      }
    }
  });
  observer.observe(chatContainer, { childList: true, subtree: true });
}

async function cachePromptAndAnswer(prompt) {
  try {
    const responseElements = document.querySelectorAll(".markdown");
    const lastResponse = responseElements[responseElements.length - 1];
    if (lastResponse) {
      const answerText = lastResponse.textContent || lastResponse.innerText;
      if (answerText && answerText.length > 10) {
        await chrome.runtime.sendMessage({
          action: "cachePrompt",
          prompt,
          answer: answerText,
        });
      }
    }
  } catch (error) {
    console.error("Error caching prompt:", error);
  }
}

function showMemoryNotification(match, similarity) {
  const existingNotification = document.getElementById(
    "ai-optimizer-notification"
  );
  if (existingNotification) existingNotification.remove();

  const notification = document.createElement("div");
  notification.id = "ai-optimizer-notification";
  notification.className = "ai-optimizer-notification";

  const similarityPercent = Math.round(similarity * 100);

  notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-header">
                <strong>🧠 Memory Found</strong>
                <span class="similarity-score">${similarityPercent}% match</span>
                <button class="close-btn">×</button>
            </div>
            <div class="notification-body">
                <p class="match-prompt"><strong>You asked:</strong> ${truncateText(
                  match.prompt,
                  100
                )}</p>
                <details class="match-details">
                    <summary>View previous conversation</summary>
                    <div class="match-answer">
                        <strong>AI answered:</strong> ${truncateText(
                          match.answer,
                          200
                        )}
                    </div>
                </details>
            </div>
        </div>
    `;

  const textarea = document.querySelector(PROMPT_TEXTAREA_SELECTOR);
  if (textarea) {
    const container = textarea.closest("form") || textarea.parentElement;
    container.insertBefore(notification, container.firstChild);

    notification
      .querySelector(".close-btn")
      .addEventListener("click", () => notification.remove());

    setTimeout(() => notification.remove(), 10000);
  }
}

function handleFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const file = e.dataTransfer.files[0];
  if (file) showFileOptionsModal(file);
}

function showFileOptionsModal(file) {
  const existingModal = document.getElementById("file-processor-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "file-processor-modal";
  modal.className = "file-processor-modal";

  let optionsHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🔧 Optimize File?</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="modal-body">
                <p class="file-info">
                    <strong>File:</strong> ${file.name}<br>
                    <strong>Size:</strong> ${formatFileSize(file.size)}<br>
                    <strong>Type:</strong> ${file.type}
                </p>
                <div class="options">`;

  if (file.type.startsWith("image/")) {
    optionsHTML += `<button class="option-btn compress-btn" data-action="compress">🗜️ Compress Image</button>`;
  }
  if (file.type === "application/pdf") {
    optionsHTML += `<button class="option-btn extract-btn" data-action="extract">📄 Extract PDF Text</button>`;
  }
  optionsHTML += `<button class="option-btn upload-btn" data-action="upload">📤 Upload Original</button></div></div></div>`;

  modal.innerHTML = optionsHTML;
  document.body.appendChild(modal);

  modal
    .querySelector(".close-btn")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    const target = e.target;
    if (target.classList.contains("option-btn")) {
      const action = target.dataset.action;
      handleFileAction(file, action);
      modal.remove();
    } else if (target === modal) {
      modal.remove();
    }
  });
}

async function handleFileAction(file, action) {
  try {
    switch (action) {
      case "compress":
        await compressImage(file);
        break;
      case "extract":
        await extractPdfText(file);
        break;
      case "upload":
        await uploadOriginalFile(file);
        break;
    }
  } catch (error) {
    console.error("Error processing file:", error);
    showErrorNotification("Failed to process file: " + error.message);
  }
}

function compressImage(file) {
  new Compressor(file, {
    quality: 0.6,
    maxWidth: 1920,
    maxHeight: 1080,
    success(result) {
      pasteBlobIntoChat(result, `compressed-${file.name}`);
      showSuccessNotification("Image compressed and ready to send!");
    },
    error(err) {
      showErrorNotification("Failed to compress image: " + err.message);
    },
  });
}

async function extractPdfText(file) {
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const pdf = await pdfjsLib.getDocument({ data: event.target.result })
        .promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item) => item.str).join(" ") + "\n";
      }
      const textarea = document.querySelector(PROMPT_TEXTAREA_SELECTOR);
      if (textarea) {
        textarea.value = `Extracted text from ${file.name}:\n\n${fullText}`;
        textarea.focus();
        showSuccessNotification("PDF text extracted and inserted!");
      }
    } catch (error) {
      showErrorNotification("Failed to extract PDF text: " + error.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function uploadOriginalFile(file) {
  pasteBlobIntoChat(file, file.name);
  showSuccessNotification("File ready to send!");
}

function pasteBlobIntoChat(blob, filename) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File([blob], filename, { type: blob.type }));
  const chatFileInput = document.querySelector('input[type="file"]');
  if (chatFileInput) {
    chatFileInput.files = dataTransfer.files;
    chatFileInput.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    showErrorNotification("Couldn't find ChatGPT's file input.");
  }
}

// Helper Functions
function showSuccessNotification(message) {
  showNotification(message, "success");
}
function showErrorNotification(message) {
  showNotification(message, "error");
}

function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `ai-optimizer-toast ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

function truncateText(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Re-initialize for SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    isInitialized = false;
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });
