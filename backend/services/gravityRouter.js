const {
  PERSONAL_PATTERNS,
  getGravityResponse
} = require("./gravityResponses");

/* =========================================================
   NORMALIZE QUESTION
========================================================= */

function normalizeQuestion(question) {
  if (
    typeof question !== "string"
  ) {
    return "";
  }

  let text =
    question
      .trim()
      .toLowerCase();

  /* -------------------------------------------------------
     Remove common conversational prefixes
  ------------------------------------------------------- */

  const prefixes = [
    "ok ",
    "okay ",
    "hey ",
    "hi ",
    "hello ",
    "bro ",
    "macha "
  ];

  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) {
      text =
        text
          .slice(prefix.length)
          .trim();

      break;
    }
  }

  /* -------------------------------------------------------
     Remove common conversational suffixes
  ------------------------------------------------------- */

  const suffixes = [
    " macha da",
    " bro da",
    " macha",
    " bro",
    " da"
  ];

  for (const suffix of suffixes) {
    if (text.endsWith(suffix)) {
      text =
        text
          .slice(
            0,
            -suffix.length
          )
          .trim();

      break;
    }
  }

  return text;
}

/* =========================================================
   CHECK PERSONAL GRAVITY QUESTION
========================================================= */

function routeQuestion(question) {
  const normalizedQuestion =
    normalizeQuestion(
      question
    );

  if (!normalizedQuestion) {
    return null;
  }

  /*
   * Match only exact Gravity-specific questions.
   *
   * Everything else goes to Gemini Web.
   */

  for (
    const patternGroup
    of PERSONAL_PATTERNS
  ) {

    if (
      !patternGroup ||
      !Array.isArray(
        patternGroup.patterns
      )
    ) {
      continue;
    }

    for (
      const pattern
      of patternGroup.patterns
    ) {

      if (
        normalizedQuestion ===
        pattern
          .toLowerCase()
          .trim()
      ) {
        return patternGroup.type;
      }
    }
  }

  return null;
}

/* =========================================================
   GET GRAVITY RESPONSE
========================================================= */

function getRoutedResponse(
  question
) {
  const route =
    routeQuestion(
      question
    );

  if (!route) {
    return null;
  }

  return getGravityResponse(
    route
  );
}

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  normalizeQuestion,
  routeQuestion,
  getRoutedResponse
};