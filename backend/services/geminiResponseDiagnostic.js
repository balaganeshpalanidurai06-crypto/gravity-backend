const puppeteer = require("puppeteer");

const GEMINI_URL = "https://gemini.google.com/";

const PROMPT_SELECTOR =
  'div[contenteditable="true"][aria-label="Enter a prompt for Gemini"]';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  let browser = null;

  try {
    console.log("======================================");
    console.log("🔬 GRAVITY GEMINI RESPONSE DIAGNOSTIC");
    console.log("======================================");

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: {
        width: 1366,
        height: 768
      },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]
    });

    const page = await browser.newPage();

    await page.goto(GEMINI_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    console.log("🌐 Gemini loaded:", page.url());

    await page.waitForSelector(
      PROMPT_SELECTOR,
      {
        visible: true,
        timeout: 30000
      }
    );

    console.log("✅ Prompt found.");

    const prompt =
      await page.$(PROMPT_SELECTOR);

    await prompt.click();

    await page.keyboard.down("Control");
    await page.keyboard.press("A");
    await page.keyboard.up("Control");

    await page.keyboard.press("Backspace");

    await page.keyboard.type(
      "How are you?",
      {
        delay: 20
      }
    );

    await sleep(700);

    console.log("✅ Question typed.");

    const buttons =
      await page.$$("button");

    let sendButton = null;

    for (const button of buttons) {
      const info =
        await button.evaluate(el => ({
          aria: el.getAttribute("aria-label") || "",
          title: el.getAttribute("title") || "",
          text: el.innerText || "",
          visible:
            !!(
              el.offsetWidth ||
              el.offsetHeight ||
              el.getClientRects().length
            )
        }));

      const combined =
        `${info.aria} ${info.title} ${info.text}`
          .toLowerCase();

      if (
        info.visible &&
        combined.includes("send")
      ) {
        sendButton = button;
        break;
      }
    }

    if (sendButton) {
      console.log("🟢 Send button found.");
      await sendButton.click();
    } else {
      console.log(
        "⚠️ Send button not found. Using Enter."
      );

      await page.keyboard.press("Enter");
    }

    console.log(
      "⏳ Waiting for Gemini response..."
    );

    await sleep(6000);

    // ======================================
    // SAVE COMPLETE HTML
    // ======================================

    const html =
      await page.content();

    require("fs").writeFileSync(
      "gemini-response-dom.html",
      html,
      "utf8"
    );

    console.log(
      "💾 Saved: gemini-response-dom.html"
    );


    // ======================================
    // BODY TEXT
    // ======================================

    const bodyText =
      await page.evaluate(
        () => document.body.innerText
      );

    console.log("");
    console.log(
      "======================================"
    );

    console.log(
      "📄 BODY TEXT"
    );

    console.log(
      "======================================"
    );

    console.log(
      bodyText
    );


    // ======================================
    // IMPORTANT ELEMENTS
    // ======================================

    const result =
      await page.evaluate(() => {

        const selectors = [

          "model-response",

          "message-content",

          ".markdown",

          ".markdown-main-panel",

          "[data-message-author-role]",

          "[data-author]",

          "[role='article']",

          "main [class*='response']",

          "main [class*='message']",

          "main [class*='content']"

        ];


        const output = [];

        const seen =
          new Set();


        for (
          const selector of selectors
        ) {

          let elements = [];

          try {
            elements =
              Array.from(
                document.querySelectorAll(
                  selector
                )
              );
          } catch {
            continue;
          }


          for (
            const element of elements
          ) {

            if (
              seen.has(element)
            ) {
              continue;
            }

            seen.add(element);


            const rect =
              element.getBoundingClientRect();

            const style =
              window.getComputedStyle(
                element
              );


            const text =
              (
                element.innerText ||
                element.textContent ||
                ""
              ).trim();


            output.push({

              selector,

              tag:
                element.tagName,

              class:
                element.className?.toString() ||
                "",

              id:
                element.id ||
                "",

              aria:
                element.getAttribute(
                  "aria-label"
                ) || "",

              role:
                element.getAttribute(
                  "role"
                ) || "",

              visible:
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0,

              textLength:
                text.length,

              text:
                text.slice(
                  0,
                  3000
                ),

              outerHTML:
                element.outerHTML.slice(
                  0,
                  5000
                )

            });
          }
        }


        return output;

      });


    console.log("");
    console.log(
      "======================================"
    );

    console.log(
      "🔎 RESPONSE CANDIDATES"
    );

    console.log(
      "======================================"
    );


    for (
      const item of result
    ) {

      console.log("");
      console.log(
        "--------------------------------------"
      );

      console.log(
        "SELECTOR:",
        item.selector
      );

      console.log(
        "TAG:",
        item.tag
      );

      console.log(
        "CLASS:",
        item.class
      );

      console.log(
        "ARIA:",
        item.aria
      );

      console.log(
        "ROLE:",
        item.role
      );

      console.log(
        "VISIBLE:",
        item.visible
      );

      console.log(
        "TEXT LENGTH:",
        item.textLength
      );

      console.log(
        "TEXT:",
        item.text
      );

      console.log(
        "HTML:",
        item.outerHTML
      );
    }


    console.log("");
    console.log(
      "======================================"
    );

    console.log(
      "✅ DIAGNOSTIC COMPLETE"
    );

    console.log(
      "======================================"
    );

    console.log(
      "Browser will stay open for inspection."
    );

    console.log(
      "Press Ctrl+C when finished."
    );


    await new Promise(
      () => {}
    );

  } catch (error) {

    console.error("");
    console.error(
      "❌ DIAGNOSTIC ERROR:",
      error.message
    );

    if (browser) {
      await browser.close();
    }

    process.exit(1);
  }
})();