const GEMINI_URL = "https://gemini.google.com/";

function validateQuestion(question) {
  if (!question || typeof question !== "string") {
    throw new Error("Question is required.");
  }

  const cleaned = question.trim();

  if (!cleaned) {
    throw new Error("Question cannot be empty.");
  }

  if (cleaned.length > 10000) {
    throw new Error("Question is too long.");
  }

  return cleaned;
}

/*
  IMPORTANT

  Gemini Web supports some signed-out text interactions according to Google.
  However, Google does not publish a stable HTTP API for sending a prompt
  directly to gemini.google.com and receiving its generated answer.

  Therefore this module keeps the Gemini operation isolated here.

  Later, once we verify a supported integration mechanism, ONLY this file
  needs to change. server.js and the Flutter API contract can remain stable.
*/

async function askGemini(question) {
  const cleanedQuestion = validateQuestion(question);

  console.log("\n======================================");
  console.log("🤖 GRAVITY GEMINI CONNECTOR");
  console.log("======================================");
  console.log("🌐 Gemini:", GEMINI_URL);
  console.log("❓ Question:", cleanedQuestion);

  /*
    No Google account.
    No login credentials.
    No authentication cookies.
    No session persistence.
    No guessed internal Gemini RPC.
  */

  throw new Error(
    "Gemini Web connector is not configured yet. " +
    "A supported Gemini integration method must be connected here."
  );
}

module.exports = {
  askGemini,
  GEMINI_URL,
};