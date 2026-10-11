// =====================================================
// GRAVITY - GEMINI WEB CONNECTOR
// Puppeteer + Persistent Gemini Session
// =====================================================

const {
  openPage,
  closeBrowser
} = require("./browserLayer");

// =====================================================
// CONFIG
// =====================================================

const GEMINI_URL =
  "https://gemini.google.com/";

const PROMPT_SELECTOR =
  'div[contenteditable="true"][aria-label="Enter a prompt for Gemini"]';

const UI_WAIT_TIMEOUT = 30000;
const RESPONSE_TIMEOUT = 45000;

const POLL_INTERVAL = 250;
const RESPONSE_STABLE_TIME = 1000;

// =====================================================
// PERSISTENT PAGE
// =====================================================

let geminiPage = null;
let geminiStarting = false;

// =====================================================
// REQUEST QUEUE
// =====================================================

let requestQueue = Promise.resolve();

// =====================================================
// FORMATTER
// =====================================================

let formatterPromise = null;

async function getFormatter() {
  if (!formatterPromise) {
    formatterPromise =
      import("./responseFormatter.mjs");
  }

  return formatterPromise;
}

// =====================================================
// SLEEP
// =====================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// =====================================================
// FORMAT TIME
// =====================================================

function formatMs(ms) {
  return `${ms}ms (${(ms / 1000).toFixed(2)}s)`;
}

// =====================================================
// VALIDATE QUESTION
// =====================================================

function validateQuestion(question) {
  if (typeof question !== "string") {
    throw new Error(
      "Question must be a string."
    );
  }

  const cleaned =
    question.trim();

  if (!cleaned) {
    throw new Error(
      "Question cannot be empty."
    );
  }

  if (cleaned.length > 10000) {
    throw new Error(
      "Question is too long."
    );
  }

  return cleaned;
}

// =====================================================
// NORMALIZE TEXT
// =====================================================

function normalizeText(text) {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// =====================================================
// TRANSIENT GEMINI RESPONSE
// =====================================================

function isTransientGeminiResponse(text) {
  const value =
    normalizeText(text);

  if (!value) {
    return true;
  }

  const normalized =
    value
      .toLowerCase()
      .replace(/[.…]+/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const transientPatterns = [
    /^searching the web$/,
    /^searching the web for.*$/,
    /^searching$/,
    /^thinking$/,
    /^loading$/,
    /^generating$/,
    /^working$/,
    /^processing$/,
    /^connecting$/,
    /^checking$/,
    /^looking up$/,
    /^looking for information$/
  ];

  return transientPatterns.some(
    (pattern) =>
      pattern.test(normalized)
  );
}

// =====================================================
// CLEAN ANSWER
// =====================================================

function cleanAnswer(
  text,
  question = ""
) {
  if (typeof text !== "string") {
    return "";
  }

  let answer =
    normalizeText(text);

  if (!answer) {
    return "";
  }

  // Remove accidental Gemini prefix
  answer =
    answer.replace(
      /^\s*\*?Gemini said\s*:?\s*/i,
      ""
    );

  answer =
    answer.replace(
      /^\s*\*?Answer\s*:?\s*/i,
      ""
    );

  // Remove accidental identity statements
  answer =
    answer.replace(
      /\bI am Gemini\b/gi,
      "I am Gravity"
    );

  answer =
    answer.replace(
      /\bI'm Gemini\b/gi,
      "I'm Gravity"
    );

  answer =
    answer.replace(
      /\bGemini here\b/gi,
      "Gravity here"
    );

  // Remove question prefix only when
  // the response actually starts with it.
  if (question) {
    const escaped =
      question.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    try {
      answer =
        answer.replace(
          new RegExp(
            `^${escaped}\\s*`,
            "i"
          ),
          ""
        );
    } catch {
      // Ignore.
    }
  }

  // Remove common Gemini UI-only lines.
  const blockedPatterns = [
    /^sign in$/i,
    /^sign in to save activity$/i,
    /^conversation with gemini$/i,
    /^new chat$/i,
    /^images$/i,
    /^about gemini$/i,
    /^get gemini app$/i,
    /^pricing$/i,
    /^for business$/i,
    /^dictate$/i,
    /^upload & tools$/i,
    /^flash-lite$/i,
    /^gemini is ai and can make mistakes\.?$/i,
    /^google terms/i,
    /^google privacy policy/i
  ];

  const lines =
    answer.split("\n");

  const cleanedLines = [];

  for (const line of lines) {
    const value =
      line.trim();

    if (!value) {
      if (
        cleanedLines.length &&
        cleanedLines[
          cleanedLines.length - 1
        ] !== ""
      ) {
        cleanedLines.push("");
      }

      continue;
    }

    const blocked =
      blockedPatterns.some(
        (pattern) =>
          pattern.test(value)
      );

    if (blocked) {
      continue;
    }

    cleanedLines.push(
      value
    );
  }

  return cleanedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// =====================================================
// GET GEMINI PAGE
// =====================================================

async function getGeminiPage() {
  // Reuse existing page
  if (
    geminiPage &&
    !geminiPage.isClosed()
  ) {
    try {
      await geminiPage.title();

      return geminiPage;
    } catch {
      console.log(
        "⚠️ Existing Gemini page is unusable."
      );

      geminiPage = null;
    }
  }

  // Prevent duplicate browser startup
  if (geminiStarting) {
    while (geminiStarting) {
      await sleep(100);
    }

    if (
      geminiPage &&
      !geminiPage.isClosed()
    ) {
      try {
        await geminiPage.title();

        return geminiPage;
      } catch {
        geminiPage = null;
      }
    }
  }

  geminiStarting =
    true;

  const startedAt =
    Date.now();

  try {
    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "🚀 STARTING PERSISTENT GEMINI SESSION"
    );
    console.log(
      "======================================"
    );

    geminiPage =
      await openPage(
        GEMINI_URL
      );

    geminiPage
      .setDefaultNavigationTimeout(
        UI_WAIT_TIMEOUT
      );

    console.log(
      "🌐 Gemini page loaded:",
      geminiPage.url()
    );

    await waitForGeminiUI(
      geminiPage
    );

    console.log(
      "✅ Persistent Gemini session ready."
    );

    console.log(
      `⏱️ Browser/page ready: ${formatMs(
        Date.now() -
          startedAt
      )}`
    );

    return geminiPage;
  } catch (error) {
    console.error(
      "❌ Gemini session startup failed:",
      error.message
    );

    geminiPage = null;

    throw error;
  } finally {
    geminiStarting =
      false;
  }
}

// =====================================================
// WAIT FOR GEMINI UI
// =====================================================

async function waitForGeminiUI(
  page
) {
  console.log(
    "⏳ Waiting for Gemini UI..."
  );

  await page.waitForSelector(
    PROMPT_SELECTOR,
    {
      visible: true,
      timeout: UI_WAIT_TIMEOUT
    }
  );

  console.log(
    "✅ Gemini prompt UI ready."
  );
}

// =====================================================
// FIND PROMPT
// =====================================================

async function findPrompt(page) {
  const prompt =
    await page.$(
      PROMPT_SELECTOR
    );

  if (prompt) {
    return prompt;
  }

  await page.waitForSelector(
    PROMPT_SELECTOR,
    {
      visible: true,
      timeout: UI_WAIT_TIMEOUT
    }
  );

  const retryPrompt =
    await page.$(
      PROMPT_SELECTOR
    );

  if (!retryPrompt) {
    throw new Error(
      "Gemini prompt element is unavailable."
    );
  }

  return retryPrompt;
}

// =====================================================
// FOCUS PROMPT
// =====================================================

async function focusPrompt(page) {
  const startedAt =
    Date.now();

  const prompt =
    await findPrompt(page);

  await prompt.click();

  console.log(
    `⏱️ Prompt focus: ${formatMs(
      Date.now() -
        startedAt
    )}`
  );

  return prompt;
}

// =====================================================
// CLEAR PROMPT
// =====================================================

async function clearPrompt(page) {
  const startedAt =
    Date.now();

  const prompt =
    await findPrompt(page);

  await prompt.click();

  await page.keyboard.down(
    "Control"
  );

  await page.keyboard.press(
    "A"
  );

  await page.keyboard.up(
    "Control"
  );

  await page.keyboard.press(
    "Backspace"
  );

  await sleep(100);

  console.log(
    `⏱️ Prompt clear: ${formatMs(
      Date.now() -
        startedAt
    )}`
  );
}

// =====================================================
// READ ACTUAL GEMINI TEXTBOX
// =====================================================

async function getActualPromptText(
  page
) {
  try {
    return await page.evaluate(
      (selector) => {
        const element =
          document.querySelector(
            selector
          );

        if (!element) {
          return "";
        }

        return (
          element.innerText ||
          element.textContent ||
          ""
        )
          .replace(
            /\u00a0/g,
            " "
          )
          .replace(
            /\r/g,
            ""
          )
          .trim();
      },
      PROMPT_SELECTOR
    );
  } catch {
    return "";
  }
}

// =====================================================
// VERIFY PROMPT
//
// IMPORTANT:
//
// The textbox contains the COMPLETE
// Gemini prompt, not only the user's
// raw question.
//
// So only verify that the prompt
// actually exists.
// =====================================================

async function verifyPrompt(
  page
) {
  const actual =
    await getActualPromptText(
      page
    );

  console.log(
    "🔎 ACTUAL GEMINI TEXTBOX LENGTH:",
    actual.length
  );

  console.log(
    "🔎 ACTUAL GEMINI TEXTBOX:"
  );

  console.log(
    actual
  );

  if (!actual) {
    console.log(
      "❌ Gemini textbox is empty."
    );

    return false;
  }

  console.log(
    "✅ Gemini textbox contains the complete prompt."
  );

  return true;
}

// =====================================================
// TYPE QUESTION / COMPLETE GEMINI PROMPT
// =====================================================

async function typeQuestion(
  page,
  question
) {
  const startedAt =
    Date.now();

  const prompt =
    await findPrompt(page);

  await prompt.click();

  // ---------------------------------------------------
  // FAST INSERT
  // ---------------------------------------------------

  let inserted =
    await page.evaluate(
      (
        selector,
        text
      ) => {
        const element =
          document.querySelector(
            selector
          );

        if (!element) {
          return false;
        }

        element.focus();

        try {
          const success =
            document.execCommand(
              "insertText",
              false,
              text
            );

          const currentText =
            (
              element.innerText ||
              element.textContent ||
              ""
            ).trim();

          return Boolean(
            success &&
            currentText
          );
        } catch {
          return false;
        }
      },
      PROMPT_SELECTOR,
      question
    );

  if (inserted) {
    inserted =
      await verifyPrompt(
        page
      );
  }

  // ---------------------------------------------------
  // KEYBOARD FALLBACK
  // ---------------------------------------------------

  if (!inserted) {
    console.log(
      "⚠️ Fast text insertion was not retained correctly."
    );

    console.log(
      "⌨️ Using Puppeteer keyboard fallback..."
    );

    await clearPrompt(
      page
    );

    const fallbackPrompt =
      await findPrompt(
        page
      );

    await fallbackPrompt.click();

    await page.keyboard.type(
      question,
      {
        delay: 0
      }
    );

    await sleep(150);

    const verified =
      await verifyPrompt(
        page
      );

    if (!verified) {
      throw new Error(
        "Gemini question could not be inserted into the prompt."
      );
    }
  }

  console.log(
    `⏱️ Question typing: ${formatMs(
      Date.now() -
        startedAt
    )}`
  );
}

// =====================================================
// FIND SEND BUTTON
// =====================================================

async function findSendButton(
  page
) {
  const selectors = [
    'button[aria-label*="Send" i]',
    'button[title*="Send" i]',
    'button[data-tooltip*="Send" i]',
    '[role="button"][aria-label*="Send" i]',
    '[role="button"][title*="Send" i]'
  ];

  for (
    const selector of
      selectors
  ) {
    try {
      const elements =
        await page.$$(
          selector
        );

      for (
        const element of
          elements
      ) {
        const visible =
          await element.evaluate(
            (el) => {
              const style =
                window.getComputedStyle(
                  el
                );

              const rect =
                el.getBoundingClientRect();

              return (
                style.display !==
                  "none" &&
                style.visibility !==
                  "hidden" &&
                style.opacity !==
                  "0" &&
                rect.width > 0 &&
                rect.height > 0
              );
            }
          );

        if (visible) {
          return element;
        }
      }
    } catch {
      // Continue.
    }
  }

  return null;
}

// =====================================================
// SUBMIT QUESTION
//
// IMPORTANT FIX:
//
// Do NOT compare the complete
// Gemini prompt against the raw
// user question.
// =====================================================

async function submitQuestion(
  page
) {
  const startedAt =
    Date.now();

  console.log(
    "🚀 Submitting question..."
  );

  const actualPrompt =
    await getActualPromptText(
      page
    );

  console.log(
    "🔎 FINAL GEMINI TEXTBOX LENGTH:",
    actualPrompt.length
  );

  if (!actualPrompt) {
    throw new Error(
      "Gemini textbox is empty before submission."
    );
  }

  console.log(
    "✅ Final Gemini textbox verification passed."
  );

  const sendButton =
    await findSendButton(
      page
    );

  if (sendButton) {
    console.log(
      "🟢 Send button found."
    );

    await sendButton.click();

    console.log(
      `⏱️ Submit stage: ${formatMs(
        Date.now() -
          startedAt
      )}`
    );

    return;
  }

  console.log(
    "⚠️ Send button not found."
  );

  console.log(
    "⌨️ Using Enter fallback..."
  );

  await page.keyboard.press(
    "Enter"
  );

  console.log(
    `⏱️ Submit fallback stage: ${formatMs(
      Date.now() -
        startedAt
    )}`
  );
}

// =====================================================
// RESPONSE COUNT
// =====================================================

async function getResponseCount(
  page
) {
  try {
    return await page.evaluate(
      () => {
        const elements =
          Array.from(
            document.querySelectorAll(
              "model-response"
            )
          );

        return elements.filter(
          (element) => {
            const style =
              window.getComputedStyle(
                element
              );

            const rect =
              element.getBoundingClientRect();

            const visible =
              style.display !==
                "none" &&
              style.visibility !==
                "hidden" &&
              style.opacity !==
                "0" &&
              rect.width > 0 &&
              rect.height > 0;

            const text =
              (
                element.innerText ||
                element.textContent ||
                ""
              ).trim();

            return (
              visible &&
              text.length >= 1
            );
          }
        ).length;
      }
    );
  } catch {
    return 0;
  }
}

// =====================================================
// LATEST MODEL RESPONSE
// =====================================================

async function getLatestModelResponse(
  page,
  question = ""
) {
  try {
    return await page.evaluate(
      ({
        question
      }) => {
        const elements =
          Array.from(
            document.querySelectorAll(
              "model-response"
            )
          );

        const visibleResponses =
          elements.filter(
            (element) => {
              const style =
                window.getComputedStyle(
                  element
                );

              const rect =
                element.getBoundingClientRect();

              const visible =
                style.display !==
                  "none" &&
                style.visibility !==
                  "hidden" &&
                style.opacity !==
                  "0" &&
                rect.width > 0 &&
                rect.height > 0;

              const text =
                (
                  element.innerText ||
                  element.textContent ||
                  ""
                ).trim();

              return (
                visible &&
                text.length >= 1
              );
            }
          );

        if (
          !visibleResponses.length
        ) {
          return "";
        }

        const latest =
          visibleResponses[
            visibleResponses.length - 1
          ];

        let text =
          (
            latest.innerText ||
            latest.textContent ||
            ""
          ).trim();

        if (!text) {
          return "";
        }

        text =
          text
            .replace(
              /\u00a0/g,
              " "
            )
            .replace(
              /\r/g,
              ""
            )
            .replace(
              /[ \t]+/g,
              " "
            )
            .replace(
              /\n{3,}/g,
              "\n\n"
            )
            .trim();

        if (question) {
          const escaped =
            question.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

          try {
            text =
              text.replace(
                new RegExp(
                  `^${escaped}\\s*`,
                  "i"
                ),
                ""
              );
          } catch {
            // Ignore.
          }
        }

        return text.trim();
      },
      {
        question
      }
    );
  } catch {
    return "";
  }
}

// =====================================================
// WAIT FOR NEW GEMINI RESPONSE
// =====================================================

async function waitForGeminiResponse(
  page,
  question,
  previousResponseCount,
  previousLatestAnswer
) {
  const startedAt =
    Date.now();

  console.log(
    "⏳ Waiting for NEW Gemini response..."
  );

  let lastAnswer = "";
  let stableSince = 0;
  let responseDetected =
    false;

  let transientLogged =
    false;

  while (
    Date.now() -
      startedAt <
    RESPONSE_TIMEOUT
  ) {
    try {
      const currentCount =
        await getResponseCount(
          page
        );

      const currentAnswer =
        await getLatestModelResponse(
          page,
          question
        );

      const countChanged =
        currentCount >
        previousResponseCount;

      const textChanged =
        Boolean(
          currentAnswer
        ) &&
        currentAnswer !==
          previousLatestAnswer;

      // ------------------------------------------------
      // NEW RESPONSE DETECTION
      // ------------------------------------------------

      if (
        !responseDetected &&
        (
          countChanged ||
          textChanged
        )
      ) {
        responseDetected =
          true;

        console.log(
          "🟢 NEW Gemini response detected."
        );

        console.log(
          countChanged
            ? "📌 Detection reason: response count increased."
            : "📌 Detection reason: latest response text changed."
        );
      }

      // ------------------------------------------------
      // RESPONSE STREAM
      // ------------------------------------------------

      if (
        responseDetected &&
        currentAnswer
      ) {
        // ------------------------------------------------
        // IGNORE SEARCH / THINKING STATE
        // ------------------------------------------------

        if (
          isTransientGeminiResponse(
            currentAnswer
          )
        ) {
          if (
            !transientLogged
          ) {
            console.log(
              `⏳ Gemini intermediate state detected: "${currentAnswer}"`
            );

            console.log(
              "⏳ Waiting for actual Gemini answer..."
            );

            transientLogged =
              true;
          }

          lastAnswer = "";
          stableSince = 0;
        }

        // ------------------------------------------------
        // REAL ANSWER
        // ------------------------------------------------

        else {
          if (
            currentAnswer !==
            lastAnswer
          ) {
            lastAnswer =
              currentAnswer;

            stableSince =
              Date.now();

            console.log(
              `📥 Gemini answer updated: ${currentAnswer.length} chars`
            );
          } else if (
            stableSince &&
            Date.now() -
              stableSince >=
              RESPONSE_STABLE_TIME
          ) {
            const finalAnswer =
              cleanAnswer(
                lastAnswer,
                question
              );

            if (
              finalAnswer.length >=
                2 &&
              !isTransientGeminiResponse(
                finalAnswer
              )
            ) {
              console.log(
                "✅ NEW Gemini response stabilized."
              );

              console.log(
                `⏱️ Response wait: ${formatMs(
                  Date.now() -
                    startedAt
                )}`
              );

              console.log(
                `📏 FINAL CAPTURED ANSWER LENGTH: ${finalAnswer.length}`
              );

              return finalAnswer;
            }

            lastAnswer = "";
            stableSince = 0;
          }
        }
      }
    } catch (error) {
      console.log(
        "⚠️ Response scan:",
        error.message
      );
    }

    await sleep(
      POLL_INTERVAL
    );
  }

  // ----------------------------------------------------
  // FINAL FALLBACK
  // ----------------------------------------------------

  if (
    lastAnswer &&
    !isTransientGeminiResponse(
      lastAnswer
    )
  ) {
    const finalAnswer =
      cleanAnswer(
        lastAnswer,
        question
      );

    if (
      finalAnswer.length >= 2 &&
      !isTransientGeminiResponse(
        finalAnswer
      )
    ) {
      console.log(
        "⚠️ Returning final detected Gemini answer."
      );

      return finalAnswer;
    }
  }

  throw new Error(
    "New Gemini response timed out."
  );
}

// =====================================================
// OLD DOM EXTRACTION
//
// Kept only as a fallback/debug helper.
//
// IMPORTANT:
// askGeminiInternal() does NOT use this
// for the normal final answer anymore.
//
// This prevents an older Gemini response
// from replacing the newly captured answer.
// =====================================================

async function getLatestResponseContainer(
  page
) {
  const selectors = [
    "model-response",
    "message-content",
    ".model-response-text",
    ".response-content",
    ".markdown-main-panel",
    ".response-container",
    '[data-message-author-role="model"]',
    '[data-message-author="model"]'
  ];

  for (
    const selector of
      selectors
  ) {
    try {
      const elements =
        await page.$$(
          selector
        );

      for (
        let i =
          elements.length - 1;
        i >= 0;
        i--
      ) {
        const element =
          elements[i];

        const visible =
          await element.evaluate(
            (el) => {
              const style =
                window.getComputedStyle(
                  el
                );

              const rect =
                el.getBoundingClientRect();

              return (
                style.display !==
                  "none" &&
                style.visibility !==
                  "hidden" &&
                style.opacity !==
                  "0" &&
                rect.width > 0 &&
                rect.height > 0
              );
            }
          );

        if (visible) {
          return element;
        }
      }
    } catch {
      // Continue.
    }
  }

  return null;
}

// =====================================================
// OLD DOM TEXT EXTRACTION
// =====================================================

async function getLatestResponseText(
  page
) {
  const container =
    await getLatestResponseContainer(
      page
    );

  if (!container) {
    return "";
  }

  try {
    const text =
      await container.evaluate(
        (element) =>
          (
            element.innerText ||
            element.textContent ||
            ""
          ).trim()
      );

    return cleanAnswer(
      text
    );
  } catch {
    return "";
  }
}

// =====================================================
// OLD DOM BLOCK EXTRACTION
//
// Kept for compatibility.
//
// NOT used for normal final response.
// =====================================================

async function extractBlocks(
  page
) {
  const container =
    await getLatestResponseContainer(
      page
    );

  if (!container) {
    console.log(
      "⚠️ No Gemini response container found."
    );

    return [];
  }

  try {
    const formatter =
      await getFormatter();

    if (
      typeof formatter.extractStructuredContent ===
      "function"
    ) {
      const blocks =
        await container.evaluate(
          formatter.extractStructuredContent
        );

      if (
        Array.isArray(blocks) &&
        blocks.length
      ) {
        console.log(
          `⚠️ DOM fallback extracted ${blocks.length} blocks.`
        );

        return blocks;
      }
    }
  } catch (error) {
    console.log(
      "⚠️ DOM structured extraction failed:",
      error.message
    );
  }

  return [];
}

// =====================================================
// FORMAT BLOCKS
// =====================================================

async function formatBlocks(
  blocks,
  fallbackAnswer
) {
  try {
    const formatter =
      await getFormatter();

    if (
      typeof formatter.blocksToMarkdown ===
      "function"
    ) {
      const answer =
        formatter.blocksToMarkdown(
          blocks
        );

      if (
        answer &&
        answer.trim()
      ) {
        return answer.trim();
      }
    }
  } catch (error) {
    console.log(
      "⚠️ blocksToMarkdown failed:",
      error.message
    );
  }

  return cleanAnswer(
    fallbackAnswer
  );
}

// =====================================================
// DIRECT ANSWER -> BLOCKS
//
// THIS IS THE IMPORTANT FIX.
//
// We already have the correct streamed
// Gemini answer from waitForGeminiResponse().
//
// Therefore parse THAT answer directly.
//
// Do NOT search the DOM again.
// =====================================================

async function answerToBlocks(
  answer
) {
  const formatter =
    await getFormatter();

  if (
    typeof formatter.markdownToBlocks ===
    "function"
  ) {
    const blocks =
      formatter.markdownToBlocks(
        answer
      );

    if (
      Array.isArray(blocks) &&
      blocks.length
    ) {
      return blocks;
    }
  }

  return [
    {
      type: "paragraph",
      text: answer
    }
  ];
}

// =====================================================
// INTERNAL GEMINI REQUEST
// =====================================================

async function askGeminiInternal(
  question
) {
  const totalStartedAt =
    Date.now();

  const page =
    await getGeminiPage();

  console.log(
    "📄 Using persistent Gemini page."
  );

  // ===================================================
  // PREVIOUS STATE
  // ===================================================

  const previousStateStartedAt =
    Date.now();

  const previousResponseCount =
    await getResponseCount(
      page
    );

  const previousLatestAnswer =
    await getLatestModelResponse(
      page
    );

  console.log(
    "📊 Previous Gemini response count:",
    previousResponseCount
  );

  console.log(
    "📄 Previous latest Gemini answer:",
    previousLatestAnswer
      ? `${previousLatestAnswer.length} chars`
      : "none"
  );

  console.log(
    `⏱️ Previous-state scan: ${formatMs(
      Date.now() -
        previousStateStartedAt
    )}`
  );

  // ===================================================
  // INPUT
  // ===================================================

  const inputStartedAt =
    Date.now();

  await focusPrompt(
    page
  );

  console.log(
    "🧹 Previous prompt clearing..."
  );

  await clearPrompt(
    page
  );

  console.log(
    "🧹 Previous prompt cleared."
  );

  console.log(
    "⌨️ Typing question..."
  );

  /*
  IMPORTANT:

  `question` here is actually the
  complete prompt generated by
  conversationManager.js.

  It can contain:

  - conversation history
  - current USER question
  - instructions
  */

  await typeQuestion(
    page,
    question
  );

  console.log(
    "✅ Question entered."
  );

  console.log(
    `⏱️ Question input stage: ${formatMs(
      Date.now() -
        inputStartedAt
    )}`
  );

  // ===================================================
  // SUBMIT
  // ===================================================

  await submitQuestion(
    page
  );

  // ===================================================
  // WAIT FOR FINAL ANSWER
  // ===================================================

  const responseStartedAt =
    Date.now();

  /*
  IMPORTANT:

  This returns the SAME answer that
  was streamed from the NEW Gemini
  response.

  Example:

  4205 chars
  */

  const answer =
    await waitForGeminiResponse(
      page,
      question,
      previousResponseCount,
      previousLatestAnswer
    );

  console.log(
    `⏱️ Response detection stage: ${formatMs(
      Date.now() -
        responseStartedAt
    )}`
  );

  console.log(
    `🎯 Captured Gemini answer length: ${answer.length}`
  );

  // ===================================================
  // DIRECT MARKDOWN -> BLOCKS
  //
  // IMPORTANT FIX:
  //
  // DO NOT call extractBlocks(page)
  // here.
  //
  // The DOM can contain old responses.
  // `answer` is already the correct
  // newly generated response.
  // ===================================================

  const extractionStartedAt =
    Date.now();

  console.log(
    "🧠 Formatting captured Gemini answer directly..."
  );

  let blocks =
    await answerToBlocks(
      answer
    );

  if (
    !Array.isArray(blocks) ||
    !blocks.length
  ) {
    blocks = [
      {
        type: "paragraph",
        text: answer
      }
    ];
  }

  console.log(
    `✅ Parsed ${blocks.length} blocks from the captured Gemini answer.`
  );

  console.log(
    `⏱️ Block extraction stage: ${formatMs(
      Date.now() -
        extractionStartedAt
    )}`
  );

  // ===================================================
  // FORMAT BLOCKS
  // ===================================================

  const formattingStartedAt =
    Date.now();

  let formattedAnswer =
    await formatBlocks(
      blocks,
      answer
    );

  /*
  IMPORTANT:

  The formatter should never make
  the response shorter because of
  an old DOM block.

  If formatting somehow produces
  an empty answer, use the captured
  answer directly.
  */

  if (
    !formattedAnswer ||
    formattedAnswer.trim()
      .length < 2
  ) {
    formattedAnswer =
      answer;
  }

  formattedAnswer =
    cleanAnswer(
      formattedAnswer
    );

  console.log(
    `⏱️ Formatting stage: ${formatMs(
      Date.now() -
        formattingStartedAt
    )}`
  );

  // ===================================================
  // SAFETY CHECK
  // ===================================================

  if (!formattedAnswer) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  // ===================================================
  // IMPORTANT LENGTH PROTECTION
  //
  // If Gemini gave a large valid answer
  // but formatter unexpectedly produces
  // a tiny answer, preserve the captured
  // answer instead.
  // ===================================================

  if (
    answer.length >= 500 &&
    formattedAnswer.length <
      answer.length * 0.20
  ) {
    console.log(
      "⚠️ Formatter output is suspiciously short."
    );

    console.log(
      `⚠️ Captured answer: ${answer.length} chars`
    );

    console.log(
      `⚠️ Formatted answer: ${formattedAnswer.length} chars`
    );

    console.log(
      "🔄 Preserving the original captured Gemini answer."
    );

    formattedAnswer =
      answer;
  }

  // ===================================================
  // FINAL
  // ===================================================

  console.log(
    "🎉 Gemini answer received."
  );

  console.log(
    "📏 Captured answer length:",
    answer.length
  );

  console.log(
    "📏 Final answer length:",
    formattedAnswer.length
  );

  console.log(
    "📦 Blocks:",
    blocks.length
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log(
    `⏱️ GEMINI TOTAL TIME: ${formatMs(
      Date.now() -
        totalStartedAt
    )}`
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  return {
    success: true,

    answer:
      formattedAnswer,

    blocks,

    source:
      "Gemini Web",

    url:
      page.url(),

    timestamp:
      new Date().toISOString()
  };
}

// =====================================================
// PUBLIC ASK GEMINI
// =====================================================

async function askGemini(
  question
) {
  const cleanedQuestion =
    validateQuestion(
      question
    );

  /*
  Serialize requests because
  one persistent Gemini page
  is being reused.
  */

  const currentRequest =
    requestQueue.then(() =>
      askGeminiInternal(
        cleanedQuestion
      )
    );

  /*
  Keep queue alive even if
  current request fails.
  */

  requestQueue =
    currentRequest.catch(
      () => {}
    );

  return currentRequest;
}

// =====================================================
// CLOSE GEMINI SESSION
// =====================================================

async function closeGeminiSession() {
  console.log(
    "🛑 Closing Gemini session..."
  );

  geminiPage = null;

  try {
    await closeBrowser();
  } catch (error) {
    console.error(
      "⚠️ Browser close error:",
      error.message
    );
  }

  console.log(
    "✅ Gemini session closed."
  );
}

// =====================================================
// SERVER SHUTDOWN
// =====================================================

process.once(
  "SIGINT",
  async () => {
    try {
      await closeGeminiSession();
    } finally {
      process.exit(0);
    }
  }
);

process.once(
  "SIGTERM",
  async () => {
    try {
      await closeGeminiSession();
    } finally {
      process.exit(0);
    }
  }
);

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  askGemini,
  validateQuestion,
  closeGeminiSession
};