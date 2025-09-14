// Import CSS directly
import "./styles.css";

const PROMPT_TEXTAREA_SELECTOR = "#prompt-textarea";
let isInitialized = false;
let typingTimeout = null;

// Lazy load heavy dependencies
let Compressor = null;
let pdfjsLib = null;

async function loadCompressor() {
  if (!Compressor) {
    const module = await import("compressorjs");
    Compressor = module.default;
  }
  return Compressor;
}

async function loadPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      chrome.runtime.getURL("pdf.worker.js");
  }
  return pdfjsLib;
}

// 1. INITIALIZATION: Attaches all the event listeners when the page is ready.
function init() {
  if (isInitialized) return;
  const textarea = document.querySelector(PROMPT_TEXTAREA_SELECTOR);
  if (textarea) {
    console.log("✅ DEBUG: AI Optimizer Suite: Initializing...");
    textarea.addEventListener("keyup", handleTypingSearch);
    textarea.addEventListener("keydown", handleSendAndCache);
    window.addEventListener("drop", handleFileDrop, true);
    window.addEventListener("dragover", (e) => e.preventDefault(), true);
    isInitialized = true;
    console.log("✅ DEBUG: AI Optimizer Suite: Initialized successfully");
  } else {
    console.warn(
      "🟡 DEBUG: AI Optimizer Suite: Textarea not found. Retrying in 500ms..."
    );
    setTimeout(init, 500);
  }
}

// 2. SEARCH TRIGGER: Called every time you type in the input box.
async function handleTypingSearch(event) {
  clearTimeout(typingTimeout);
  const promptText = event.currentTarget.textContent.trim();

  // This is a critical condition. The search will ONLY run if the prompt is 25+ characters.
  if (promptText.length < 25) {
    return;
  }

  console.log(
    "▶️ DEBUG: Prompt is long enough. Starting 1-second timer to search..."
  );

  typingTimeout = setTimeout(async () => {
    try {
      console.log(
        "➡️ DEBUG: Timer finished. Sending search request to background script..."
      );

      // This sends the request to your background script. The background script does the actual search.
      const result = await chrome.runtime.sendMessage({
        action: "searchCache",
        text: promptText,
      });

      console.log(
        "◀️ DEBUG: Received response from background script:",
        result
      );

      if (result && result.match) {
        console.log("✅ DEBUG: Match found! Showing notification.");
        showMemoryNotification(result.match, result.similarity);
      } else {
        console.log("🟡 DEBUG: No match found or result was empty.");
      }
    } catch (error) {
      // This catch block is very important. If it fires, there's a problem with your background script.
      console.error(
        "🔴 DEBUG: Error communicating with the background script!",
        error.message || error
      );
      if (
        error.message &&
        error.message.includes("Receiving end does not exist")
      ) {
        console.warn(
          "🔴 DEBUG: This means the background script is not running or has crashed. Check the Service Worker console."
        );
      }
    }
  }, 1000);
}

// 3. CACHE TRIGGER: Called when you press Enter to send a prompt.
function handleSendAndCache(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    const prompt = event.currentTarget.textContent.trim();
    if (prompt) {
      console.log(
        "▶️ DEBUG: Enter pressed. Starting process to observe for a response..."
      );
      observeForResponse(prompt);
    }
  }
}

// 4. OBSERVER: Watches the chat window for the AI's response to appear.
function observeForResponse(prompt) {
  const chatContainer = document.querySelector("main .overflow-y-auto");
  if (!chatContainer) {
    console.error("🔴 DEBUG: Could not find chat container to observe.");
    return;
  }

  console.log("👀 DEBUG: Observing for AI response...");

  const observer = new MutationObserver((mutationsList, obs) => {
    const stopGeneratingButton = document.querySelector(
      'button[aria-label="Stop generating"], button[data-testid="stop-button"]'
    );
    if (stopGeneratingButton) {
      return;
    }

    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        if (
          Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              node.querySelector(".markdown")
          )
        ) {
          console.log(
            "✅ DEBUG: Detected a complete AI response. Preparing to cache."
          );
          cachePromptAndAnswer(prompt);
          obs.disconnect();
          return;
        }
      }
    }
  });
  observer.observe(chatContainer, { childList: true, subtree: true });
}

// 5. CACHE ACTION: Sends the finished conversation to the background script to be saved.
async function cachePromptAndAnswer(prompt) {
  try {
    const responseElements = document.querySelectorAll(".markdown");
    const lastResponse = responseElements[responseElements.length - 1];
    if (lastResponse) {
      const answerText = lastResponse.textContent || lastResponse.innerText;
      if (answerText && answerText.length > 10) {
        console.log(
          "➡️ DEBUG: Sending prompt and answer to background script to be cached."
        );
        await chrome.runtime.sendMessage({
          action: "cachePrompt",
          prompt,
          answer: answerText,
        });
        console.log("✅ DEBUG: Cache request sent successfully.");
      }
    }
  } catch (error) {
    console.error(
      "🔴 DEBUG: Error sending cache request to background script:",
      error
    );
  }
}

function showMemoryNotification(match, similarity) {
  console.log("DEBUG: showMemoryNotification called with match:", match);
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

  console.log("▶️ DEBUG: File dropped onto the window.");
  const file = e.dataTransfer.files[0];
  if (file) {
    console.log("DEBUG: File identified:", file.name);
    showFileOptionsModal(file);
  } else {
    console.warn("🟡 DEBUG: A drop event occurred but no file was found.");
  }
}

function showFileOptionsModal(file) {
  console.log("DEBUG: Showing file options modal.");
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
      console.log(`DEBUG: File action '${action}' selected.`);
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
    console.error("🔴 DEBUG: Error processing file action:", error);
    showErrorNotification(
      "Failed to process file: " + (error.message || error)
    );
  }
}

async function compressImage(file) {
  console.log("DEBUG: Compressing image...");
  try {
    const CompressorClass = await loadCompressor();
    return new Promise((resolve, reject) => {
      new CompressorClass(file, {
        quality: 0.6,
        maxWidth: 1920,
        maxHeight: 1080,
        success(result) {
          console.log("✅ DEBUG: Image compressed successfully.");
          pasteBlobIntoChat(result, `compressed-${file.name}`);
          showSuccessNotification("Image compressed and ready to send!");
          resolve(result);
        },
        error(err) {
          console.error("🔴 DEBUG: Failed to compress image:", err);
          showErrorNotification(
            "Failed to compress image: " + (err.message || err)
          );
          reject(err);
        },
      });
    });
  } catch (error) {
    console.error("🔴 DEBUG: Failed to load compressor library:", error);
    showErrorNotification(
      "Failed to load compressor: " + (error.message || error)
    );
    throw error;
  }
}

async function extractPdfText(file) {
  console.log("DEBUG: Extracting PDF text...");
  try {
    const pdfLib = await loadPdfJs();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const pdf = await pdfLib.getDocument({ data: event.target.result })
            .promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText +=
              textContent.items.map((item) => item.str).join(" ") + "\n";
          }
          const textarea = document.querySelector(PROMPT_TEXTAREA_SELECTOR);
          if (textarea) {
            textarea.textContent = `Extracted text from ${file.name}:\n\n${fullText}`;
            textarea.focus();
            console.log(
              "✅ DEBUG: PDF text extracted and inserted into textarea."
            );
            showSuccessNotification("PDF text extracted and inserted!");
            resolve(fullText);
          }
        } catch (error) {
          console.error(
            "🔴 DEBUG: Failed during PDF text extraction process:",
            error
          );
          showErrorNotification(
            "Failed to extract PDF text: " + (error.message || error)
          );
          reject(error);
        }
      };
      reader.onerror = () => {
        const error = new Error("Failed to read file");
        console.error("🔴 DEBUG: FileReader failed to read the PDF file.");
        showErrorNotification(error.message);
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    console.error("🔴 DEBUG: Failed to load PDF.js library:", error);
    showErrorNotification(
      "Failed to load PDF processor: " + (error.message || error)
    );
    throw error;
  }
}

function uploadOriginalFile(file) {
  console.log("DEBUG: Uploading original file.");
  pasteBlobIntoChat(file, file.name);
  showSuccessNotification("File ready to send!");
  return Promise.resolve();
}

function pasteBlobIntoChat(blob, filename) {
  console.log("DEBUG: Pasting blob into chat input:", filename);
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File([blob], filename, { type: blob.type }));
  const chatFileInput = document.querySelector('input[type="file"]');
  if (chatFileInput) {
    chatFileInput.files = dataTransfer.files;
    chatFileInput.dispatchEvent(new Event("change", { bubbles: true }));
    console.log("✅ DEBUG: Successfully dispatched file change event.");
  } else {
    console.error("🔴 DEBUG: Could not find ChatGPT's file input element.");
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
  console.log(`DEBUG: Showing notification (${type}): "${message}"`);
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
    console.log("🟡 DEBUG: URL changed, re-initializing extension.");
    lastUrl = url;
    isInitialized = false;
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });
