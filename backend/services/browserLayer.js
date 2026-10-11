// ======================================
// GRAVITY - BROWSER LAYER
// ======================================

const puppeteer = require("puppeteer");

let browserInstance = null;
let browserStarting = false;

// --------------------------------------
// START BROWSER
// --------------------------------------

async function startBrowser() {
  if (browserInstance) {
    return browserInstance;
  }

  if (browserStarting) {
    throw new Error("Browser is already starting.");
  }

  browserStarting = true;

  try {
    console.log("🌐 Starting Gravity Browser...");

    browserInstance = await puppeteer.launch({
      headless: true,

      defaultViewport: {
        width: 1366,
        height: 768
      },

      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    // --------------------------------------
    // BROWSER DISCONNECT / CRASH RECOVERY
    // --------------------------------------

    browserInstance.on("disconnected", () => {
      console.warn(
        "⚠️ Gravity Browser disconnected."
      );

      // Clear stale browser reference.
      browserInstance = null;

      // Allow a fresh browser to start.
      browserStarting = false;
    });

    console.log("✅ Gravity Browser started.");

    return browserInstance;

  } catch (error) {
    browserInstance = null;

    console.error(
      "❌ Browser startup failed:",
      error.message
    );

    throw error;

  } finally {
    browserStarting = false;
  }
}

// --------------------------------------
// GET BROWSER
// --------------------------------------

async function getBrowser() {
  if (browserInstance) {
    return browserInstance;
  }

  return startBrowser();
}

// --------------------------------------
// OPEN PAGE
// --------------------------------------

async function openPage(url) {
  const browser = await getBrowser();

  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    return page;

  } catch (error) {
    // Close page if navigation fails.
    try {
      await page.close();
    } catch (_) {
      // Ignore page cleanup errors.
    }

    throw error;
  }
}

// --------------------------------------
// CLOSE BROWSER
// --------------------------------------

async function closeBrowser() {
  if (!browserInstance) {
    return;
  }

  const browser = browserInstance;

  // Clear reference first so another request
  // cannot reuse a browser being closed.
  browserInstance = null;

  try {
    console.log("🛑 Closing Gravity Browser...");

    await browser.close();

    console.log("✅ Browser closed.");

  } catch (error) {
    console.error(
      "❌ Browser close error:",
      error.message
    );
  } finally {
    browserStarting = false;
  }
}

// --------------------------------------
// STATUS
// --------------------------------------

function getBrowserStatus() {
  return {
    running: Boolean(browserInstance),
    starting: browserStarting
  };
}

// --------------------------------------
// GRACEFUL SHUTDOWN
// --------------------------------------

async function shutdownBrowser() {
  await closeBrowser();
}

process.once(
  "SIGINT",
  shutdownBrowser
);

process.once(
  "SIGTERM",
  shutdownBrowser
);

// --------------------------------------
// EXPORTS
// --------------------------------------

module.exports = {
  startBrowser,
  getBrowser,
  openPage,
  closeBrowser,
  getBrowserStatus,
  shutdownBrowser
};