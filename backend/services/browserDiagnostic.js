// ======================================
// GRAVITY - BROWSER DIAGNOSTIC
// ======================================

const {
  openPage,
  closeBrowser
} = require("./browserLayer");

const GEMINI_URL = "https://gemini.google.com/";

async function diagnoseGemini() {
  let page = null;

  try {
    console.log("\n======================================");
    console.log("🚀 GRAVITY GEMINI BROWSER DIAGNOSTIC");
    console.log("======================================");

    console.log("\n🌐 Opening Gemini...");

    page = await openPage(GEMINI_URL);

    console.log("✅ Page navigation completed.");

    // --------------------------------------------------
    // Wait for Gemini SPA to render
    // --------------------------------------------------

    console.log("\n⏳ Waiting for Gemini UI...");

    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });

    // --------------------------------------------------
    // BASIC PAGE INFORMATION
    // --------------------------------------------------

    const url = page.url();
    const title = await page.title();

    console.log("\n======================================");
    console.log("📄 PAGE INFORMATION");
    console.log("======================================");

    console.log("URL:");
    console.log(url);

    console.log("\nTITLE:");
    console.log(title);

    // --------------------------------------------------
    // HTML INFORMATION
    // --------------------------------------------------

    const htmlInfo = await page.evaluate(() => {
      return {
        htmlLength:
          document.documentElement?.outerHTML?.length || 0,

        bodyLength:
          document.body?.innerHTML?.length || 0,

        bodyText:
          document.body?.innerText
            ?.replace(/\s+/g, " ")
            .trim()
            .slice(0, 5000) || ""
      };
    });

    console.log("\n======================================");
    console.log("📦 HTML INFORMATION");
    console.log("======================================");

    console.log("HTML LENGTH:");
    console.log(htmlInfo.htmlLength);

    console.log("\nBODY HTML LENGTH:");
    console.log(htmlInfo.bodyLength);

    console.log("\nBODY TEXT:");
    console.log(htmlInfo.bodyText);

    // --------------------------------------------------
    // FRAMES
    // --------------------------------------------------

    const frames = page.frames().map((frame, index) => ({
      index,
      url: frame.url()
    }));

    console.log("\n======================================");
    console.log("🖼️ FRAMES");
    console.log("======================================");

    console.dir(frames, {
      depth: null
    });

    // --------------------------------------------------
    // PROMPT / INPUT CANDIDATES
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("⌨️ PROMPT CANDIDATES");
    console.log("======================================");

    const promptCandidates = await page.evaluate(() => {
      const selector = [
        "textarea",
        "input",
        "[contenteditable='true']",
        "[role='textbox']",
        "[aria-label]",
        "[data-placeholder]"
      ].join(",");

      return Array.from(
        document.querySelectorAll(selector)
      )
        .map((element, index) => {
          const rect = element.getBoundingClientRect();

          const style =
            window.getComputedStyle(element);

          return {
            index,

            tag:
              element.tagName || "",

            id:
              element.id || "",

            className:
              typeof element.className === "string"
                ? element.className
                : "",

            ariaLabel:
              element.getAttribute("aria-label") || "",

            placeholder:
              element.getAttribute("placeholder") || "",

            dataPlaceholder:
              element.getAttribute("data-placeholder") || "",

            role:
              element.getAttribute("role") || "",

            type:
              element.getAttribute("type") || "",

            name:
              element.getAttribute("name") || "",

            contentEditable:
              element.getAttribute(
                "contenteditable"
              ) || "",

            text:
              element.innerText
                ?.replace(/\s+/g, " ")
                .trim()
                .slice(0, 300) || "",

            value:
              typeof element.value === "string"
                ? element.value.slice(0, 300)
                : "",

            visible:
              !!(
                element.offsetWidth ||
                element.offsetHeight ||
                element.getClientRects().length
              ),

            display:
              style.display,

            visibility:
              style.visibility,

            opacity:
              style.opacity,

            width:
              Math.round(rect.width),

            height:
              Math.round(rect.height),

            top:
              Math.round(rect.top),

            left:
              Math.round(rect.left)
          };
        })
        .filter((element) => element.visible);
    });

    console.dir(promptCandidates, {
      depth: null
    });

    // --------------------------------------------------
    // BUTTON CANDIDATES
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("🔘 BUTTON CANDIDATES");
    console.log("======================================");

    const buttonCandidates = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          "button, [role='button']"
        )
      )
        .map((element, index) => {
          const rect =
            element.getBoundingClientRect();

          const style =
            window.getComputedStyle(element);

          return {
            index,

            tag:
              element.tagName || "",

            id:
              element.id || "",

            className:
              typeof element.className === "string"
                ? element.className
                : "",

            text:
              element.innerText
                ?.replace(/\s+/g, " ")
                .trim()
                .slice(0, 300) || "",

            ariaLabel:
              element.getAttribute("aria-label") || "",

            title:
              element.getAttribute("title") || "",

            role:
              element.getAttribute("role") || "",

            type:
              element.getAttribute("type") || "",

            visible:
              !!(
                element.offsetWidth ||
                element.offsetHeight ||
                element.getClientRects().length
              ),

            display:
              style.display,

            visibility:
              style.visibility,

            width:
              Math.round(rect.width),

            height:
              Math.round(rect.height),

            top:
              Math.round(rect.top),

            left:
              Math.round(rect.left)
          };
        })
        .filter((element) => element.visible);
    });

    console.dir(buttonCandidates, {
      depth: null
    });

    // --------------------------------------------------
    // TEXTAREAS ONLY
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("📝 TEXTAREA DETAILS");
    console.log("======================================");

    const textareas = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("textarea")
      ).map((element, index) => ({
        index,

        outerHTML:
          element.outerHTML.slice(0, 2000),

        ariaLabel:
          element.getAttribute("aria-label") || "",

        placeholder:
          element.getAttribute("placeholder") || "",

        className:
          typeof element.className === "string"
            ? element.className
            : "",

        value:
          element.value || "",

        visible:
          !!(
            element.offsetWidth ||
            element.offsetHeight ||
            element.getClientRects().length
          )
      }));
    });

    console.dir(textareas, {
      depth: null
    });

    // --------------------------------------------------
    // CONTENTEDITABLE DETAILS
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("✏️ CONTENTEDITABLE DETAILS");
    console.log("======================================");

    const contentEditables = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          "[contenteditable='true']"
        )
      ).map((element, index) => ({
        index,

        outerHTML:
          element.outerHTML.slice(0, 3000),

        tag:
          element.tagName,

        id:
          element.id || "",

        className:
          typeof element.className === "string"
            ? element.className
            : "",

        ariaLabel:
          element.getAttribute("aria-label") || "",

        role:
          element.getAttribute("role") || "",

        dataPlaceholder:
          element.getAttribute(
            "data-placeholder"
          ) || "",

        text:
          element.innerText
            ?.replace(/\s+/g, " ")
            .trim()
            .slice(0, 500) || "",

        visible:
          !!(
            element.offsetWidth ||
            element.offsetHeight ||
            element.getClientRects().length
          )
      }));
    });

    console.dir(contentEditables, {
      depth: null
    });

    // --------------------------------------------------
    // INPUT DETAILS
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("🔤 INPUT DETAILS");
    console.log("======================================");

    const inputs = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("input")
      ).map((element, index) => ({
        index,

        type:
          element.type || "",

        name:
          element.name || "",

        id:
          element.id || "",

        className:
          typeof element.className === "string"
            ? element.className
            : "",

        ariaLabel:
          element.getAttribute("aria-label") || "",

        placeholder:
          element.getAttribute("placeholder") || "",

        value:
          element.value || "",

        visible:
          !!(
            element.offsetWidth ||
            element.offsetHeight ||
            element.getClientRects().length
          ),

        outerHTML:
          element.outerHTML.slice(0, 2000)
      }));
    });

    console.dir(inputs, {
      depth: null
    });

    // --------------------------------------------------
    // POSSIBLE SEND BUTTONS
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("🚀 POSSIBLE SEND BUTTONS");
    console.log("======================================");

    const possibleSendButtons =
      await page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll(
            "button, [role='button']"
          )
        );

        return elements
          .map((element, index) => {
            const text =
              element.innerText
                ?.replace(/\s+/g, " ")
                .trim() || "";

            const aria =
              element.getAttribute(
                "aria-label"
              ) || "";

            const title =
              element.getAttribute("title") || "";

            const combined =
              `${text} ${aria} ${title}`
                .toLowerCase();

            const possible =
              combined.includes("send") ||
              combined.includes("submit") ||
              combined.includes("ask") ||
              combined.includes("search");

            const visible =
              !!(
                element.offsetWidth ||
                element.offsetHeight ||
                element.getClientRects().length
              );

            if (!possible || !visible) {
              return null;
            }

            return {
              index,

              tag:
                element.tagName,

              text,

              ariaLabel:
                aria,

              title,

              id:
                element.id || "",

              className:
                typeof element.className === "string"
                  ? element.className
                  : "",

              outerHTML:
                element.outerHTML.slice(0, 3000)
            };
          })
          .filter(Boolean);
      });

    console.dir(possibleSendButtons, {
      depth: null
    });

    // --------------------------------------------------
    // GEMINI RELATED ELEMENTS
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("🤖 GEMINI RELATED ELEMENTS");
    console.log("======================================");

    const geminiElements = await page.evaluate(() => {
      const all = Array.from(
        document.querySelectorAll("*")
      );

      return all
        .filter((element) => {
          const text =
            element.innerText
              ?.replace(/\s+/g, " ")
              .trim()
              .toLowerCase() || "";

          const aria =
            element.getAttribute("aria-label")
              ?.toLowerCase() || "";

          const placeholder =
            element.getAttribute("placeholder")
              ?.toLowerCase() || "";

          const dataPlaceholder =
            element.getAttribute(
              "data-placeholder"
            )
              ?.toLowerCase() || "";

          const combined =
            `${text} ${aria} ${placeholder} ${dataPlaceholder}`;

          return (
            combined.includes("ask gemini") ||
            combined.includes("message gemini") ||
            combined.includes("enter a prompt") ||
            combined.includes("type a message")
          );
        })
        .slice(0, 50)
        .map((element, index) => ({
          index,

          tag:
            element.tagName,

          id:
            element.id || "",

          className:
            typeof element.className === "string"
              ? element.className
              : "",

          text:
            element.innerText
              ?.replace(/\s+/g, " ")
              .trim()
              .slice(0, 500) || "",

          ariaLabel:
            element.getAttribute(
              "aria-label"
            ) || "",

          placeholder:
            element.getAttribute(
              "placeholder"
            ) || "",

          dataPlaceholder:
            element.getAttribute(
              "data-placeholder"
            ) || "",

          role:
            element.getAttribute("role") || "",

          outerHTML:
            element.outerHTML.slice(0, 3000)
        }));
    });

    console.dir(geminiElements, {
      depth: null
    });

    // --------------------------------------------------
    // FINAL DIAGNOSTIC RESULT
    // --------------------------------------------------

    console.log("\n======================================");
    console.log("✅ DIAGNOSTIC COMPLETE");
    console.log("======================================");

    return {
      success: true,

      page: {
        url,
        title,
        htmlLength:
          htmlInfo.htmlLength,
        bodyLength:
          htmlInfo.bodyLength
      },

      frames,

      promptCandidates,

      buttons: buttonCandidates,

      textareas,

      contentEditables,

      inputs,

      possibleSendButtons,

      geminiElements
    };

  } catch (error) {
    console.error("\n======================================");
    console.error("❌ DIAGNOSTIC FAILED");
    console.error("======================================");

    console.error(error.message);

    return {
      success: false,
      error: error.message
    };

  } finally {
    await closeBrowser();
  }
}

module.exports = {
  diagnoseGemini
};