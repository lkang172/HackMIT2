import { pipeline, cos_sim } from "@xenova/transformers";

// Singleton to manage the embedding model instance efficiently
class EmbeddingPipeline {
  static task = "feature-extraction";
  static model = "Xenova/all-MiniLM-L6-v2";
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model);
    }
    return this.instance;
  }
}
// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === "searchCache") {
        const result = await searchCache(request.text);
        sendResponse(result);
      } else if (request.action === "cachePrompt") {
        await cachePrompt(request.prompt, request.answer);
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error("Background script error:", error);
      sendResponse({ error: error.message });
    }
  })();
  return true; // Required for asynchronous sendResponse
});

async function searchCache(promptText) {
  try {
    const extractor = await EmbeddingPipeline.getInstance();
    const { cache } = await chrome.storage.local.get({ cache: [] });

    if (cache.length === 0) return null;

    const promptEmbedding = await extractor(promptText, {
      pooling: "mean",
      normalize: true,
    });

    let bestMatch = null;
    let highestSimilarity = -1;

    for (const item of cache) {
      const similarity = cos_sim(promptEmbedding.data, item.embedding);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = item;
      }
    }

    // Similarity threshold for a confident match
    if (highestSimilarity > 0.92) {
      return { match: bestMatch, similarity: highestSimilarity };
    }
    return null;
  } catch (error) {
    console.error("Error searching cache:", error);
    return null;
  }
}

async function cachePrompt(prompt, answer) {
  try {
    const extractor = await EmbeddingPipeline.getInstance();
    const embeddingOutput = await extractor(prompt, {
      pooling: "mean",
      normalize: true,
    });
    const embedding = Array.from(embeddingOutput.data);

    const { cache = [] } = await chrome.storage.local.get("cache");

    // Limit cache size to prevent storage bloat
    const maxCacheSize = 100;
    if (cache.length >= maxCacheSize) {
      cache.splice(0, cache.length - maxCacheSize + 1);
    }

    cache.push({
      prompt,
      answer,
      embedding,
      timestamp: Date.now(),
    });

    await chrome.storage.local.set({ cache });
    console.log("AI Optimizer Suite: Prompt cached successfully");
  } catch (error) {
    console.error("Error caching prompt:", error);
  }
}
