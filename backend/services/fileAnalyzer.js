const fs = require("fs");
const path = require("path");
const os = require("os");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const AdmZip = require("adm-zip");
const { GoogleGenAI } = require("@google/genai");

const API_KEY = process.env.FILE_ANALYSIS_API_KEY;
const MODEL =
  process.env.FILE_ANALYSIS_MODEL || "gemini-2.5-flash-lite";

if (!API_KEY) {
  console.warn(
    "⚠️ FILE_ANALYSIS_API_KEY is not configured. File analysis will not work."
  );
}

const ai = API_KEY
  ? new GoogleGenAI({ apiKey: API_KEY })
  : null;

/*
|--------------------------------------------------------------------------
| Supported file types
|--------------------------------------------------------------------------
*/

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const PDF_TYPES = new Set([
  "application/pdf"
]);

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml"
]);

const OFFICE_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint"
]);

const CODE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".xml",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".java",
  ".py",
  ".php",
  ".sql",
  ".sh",
  ".bat",
  ".ps1",
  ".go",
  ".rs",
  ".kt",
  ".swift",
  ".dart"
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getExtension(fileName) {
  return path.extname(fileName || "").toLowerCase();
}

function isImage(mimeType) {
  return IMAGE_TYPES.has(mimeType);
}

function isPdf(mimeType) {
  return PDF_TYPES.has(mimeType);
}

function isText(mimeType, fileName) {
  const extension = getExtension(fileName);

  return (
    TEXT_TYPES.has(mimeType) ||
    CODE_EXTENSIONS.has(extension)
  );
}

function isOffice(mimeType) {
  return OFFICE_TYPES.has(mimeType);
}

function ensureFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("Uploaded file was not found.");
  }
}

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      "⚠️ Temporary file cleanup failed:",
      error.message
    );
  }
}

/*
|--------------------------------------------------------------------------
| TXT / CODE / CSV / JSON
|--------------------------------------------------------------------------
*/

async function extractTextFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/*
|--------------------------------------------------------------------------
| DOCX
|--------------------------------------------------------------------------
*/

async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({
    path: filePath
  });

  return result.value || "";
}

/*
|--------------------------------------------------------------------------
| XLS / XLSX / CSV
|--------------------------------------------------------------------------
*/

async function extractExcel(filePath) {
  const workbook = XLSX.readFile(filePath);

  const output = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: ""
    });

    output.push(`\n=== SHEET: ${sheetName} ===\n`);

    for (const row of rows) {
      output.push(row.join(" | "));
    }
  }

  return output.join("\n");
}

/*
|--------------------------------------------------------------------------
| PPT / PPTX
|--------------------------------------------------------------------------
*/

function extractPowerPoint(filePath) {
  const zip = new AdmZip(filePath);

  const entries = zip
    .getEntries()
    .filter((entry) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName)
    )
    .sort((a, b) => {
      const aNumber = Number(
        a.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0
      );

      const bNumber = Number(
        b.entryName.match(/slide(\d+)\.xml/i)?.[1] || 0
      );

      return aNumber - bNumber;
    });

  const slides = [];

  for (const entry of entries) {
    const xml = entry.getData().toString("utf8");

    const texts = [];

    const matches = xml.matchAll(/<a:t>(.*?)<\/a:t>/g);

    for (const match of matches) {
      const text = match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"');

      if (text.trim()) {
        texts.push(text.trim());
      }
    }

    slides.push(
      `\n=== SLIDE ${slides.length + 1} ===\n${texts.join(
        "\n"
      )}`
    );
  }

  return slides.join("\n");
}

/*
|--------------------------------------------------------------------------
| Office extraction
|--------------------------------------------------------------------------
*/

async function extractOfficeContent(filePath, mimeType) {
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocx(filePath);
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return extractExcel(filePath);
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  ) {
    return extractPowerPoint(filePath);
  }

  throw new Error("Unsupported Office document.");
}

/*
|--------------------------------------------------------------------------
| Prompt
|--------------------------------------------------------------------------
*/

function buildPrompt(question, fileName) {
  const userQuestion =
    question && question.trim()
      ? question.trim()
      : "Analyze this file and explain the important information clearly.";

  return `
You are Gravity's file analysis engine.

Analyze the uploaded file carefully.

File name:
${fileName}

User request:
${userQuestion}

Rules:
- Answer based on the uploaded file.
- Do not invent information that is not supported by the file.
- If something cannot be determined from the file, say so.
- Preserve important numbers, names, dates and technical details.
- For images, describe important visible elements.
- For documents, explain the relevant content clearly.
- For tables or spreadsheets, use the available data accurately.
- For source code, explain or analyze the actual code.
- Keep the response useful and conversational.
- If the user asks a specific question, answer that question first.
`;
}

/*
|--------------------------------------------------------------------------
| Gemini analysis
|--------------------------------------------------------------------------
*/

async function analyzeWithGeminiFile(filePath, mimeType, prompt) {
  if (!ai) {
    throw new Error(
      "FILE_ANALYSIS_API_KEY is missing in the .env file."
    );
  }

  const uploadedFile = await ai.files.upload({
    file: filePath,
    config: {
      mimeType: mimeType
    }
  });

  console.log(
    `☁️ File uploaded to Gemini Files API: ${uploadedFile.name}`
  );

  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: uploadedFile.uri,
                mimeType: uploadedFile.mimeType || mimeType
              }
            },
            {
              text: prompt
            }
          ]
        }
      ]
    });

    return result.text || "";
  } finally {
    /*
     * Gemini Files API normally keeps uploaded files temporarily.
     * Try deleting immediately as an additional cleanup step.
     */
    try {
      if (uploadedFile.name) {
        await ai.files.delete({
          name: uploadedFile.name
        });

        console.log("🗑️ Gemini temporary file deleted.");
      }
    } catch (cleanupError) {
      console.warn(
        "⚠️ Gemini file cleanup warning:",
        cleanupError.message
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| Main analyzer
|--------------------------------------------------------------------------
*/

async function analyzeFile({
  filePath,
  originalName,
  mimeType,
  question
}) {
  ensureFileExists(filePath);

  const fileSize = fs.statSync(filePath).size;

  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      "File is too large. Maximum supported upload size is 50 MB."
    );
  }

  const prompt = buildPrompt(
    question,
    originalName
  );

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📂 FILE ANALYSIS STARTED");
  console.log(`📄 Name   : ${originalName}`);
  console.log(`📦 Type   : ${mimeType}`);
  console.log(`📏 Size   : ${fileSize} bytes`);
  console.log(`🤖 Model  : ${MODEL}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  /*
   * IMAGE
   */
  if (isImage(mimeType)) {
    const answer = await analyzeWithGeminiFile(
      filePath,
      mimeType,
      prompt
    );

    return {
      answer,
      analysisType: "image",
      model: MODEL
    };
  }

  /*
   * PDF
   */
  if (isPdf(mimeType)) {
    const answer = await analyzeWithGeminiFile(
      filePath,
      mimeType,
      prompt
    );

    return {
      answer,
      analysisType: "pdf",
      model: MODEL
    };
  }

  /*
   * TEXT / CODE
   */
  if (isText(mimeType, originalName)) {
    const content = await extractTextFile(filePath);

    if (!content.trim()) {
      throw new Error("The uploaded text file is empty.");
    }

    const limitedContent = content.slice(
      0,
      500000
    );

    const textPrompt = `
${prompt}

The uploaded file was converted to text.

FILE CONTENT:
----------------
${limitedContent}
----------------

Analyze the content above.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: textPrompt
    });

    return {
      answer: result.text || "",
      analysisType: "text",
      model: MODEL
    };
  }

  /*
   * OFFICE
   */
  if (isOffice(mimeType)) {
    const extractedContent =
      await extractOfficeContent(
        filePath,
        mimeType
      );

    if (!extractedContent.trim()) {
      throw new Error(
        "Could not extract readable content from this Office file."
      );
    }

    const limitedContent =
      extractedContent.slice(0, 500000);

    const officePrompt = `
${prompt}

The Office document was converted into structured text.

EXTRACTED CONTENT:
====================
${limitedContent}
====================

Analyze this extracted content carefully.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: officePrompt
    });

    return {
      answer: result.text || "",
      analysisType: "office-document",
      model: MODEL
    };
  }

  throw new Error(
    `Unsupported file type: ${mimeType || "unknown"}`
  );
}

function getSupportedTypes() {
  return {
    images: [
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif"
    ],
    documents: [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "ppt",
      "pptx",
      "txt",
      "md",
      "csv",
      "json",
      "xml"
    ],
    code: Array.from(CODE_EXTENSIONS)
      .map((ext) => ext.substring(1))
      .sort()
  };
}

module.exports = {
  analyzeFile,
  getSupportedTypes,
  MAX_FILE_SIZE
};