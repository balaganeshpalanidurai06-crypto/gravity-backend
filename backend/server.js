// ============================================================
// GRAVITY BACKEND SERVER
// ============================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const multer = require("multer");
const rateLimit = require("express-rate-limit");

// ============================================================
// DATABASE
// ============================================================

const connectDatabase = require("./config/database");

// ============================================================
// AUTH
// ============================================================

const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");

// ============================================================
// GRAVITY ROUTER
// ============================================================

const gravityRouter = require("./services/gravityRouter");

// ============================================================
// GEMINI WEB
// IMPORTANT:
// Normal text questions MUST use geminiWeb.js
// NOT geminiConnector.js
// ============================================================

const geminiWeb = require("./services/geminiWeb");

// ============================================================
// FILE ANALYZER
// ============================================================

const fileAnalyzer = require("./services/fileAnalyzer");

// ============================================================
// CONVERSATION MANAGER
// ============================================================

const conversationManager = require("./services/conversationManager");

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

const PORT =
  Number(process.env.PORT) || 5000;

// ============================================================
// RATE LIMITING
// ============================================================
//
// Security hardening:
// 1. Authentication endpoints are heavily limited.
// 2. Expensive Gemini/file-analysis endpoints have a
//    separate stricter limit.
// 3. Normal authenticated API endpoints have a higher limit.
// 4. Health and file-support endpoints are intentionally
//    not rate limited.
//

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    error:
      "Too many authentication requests. Please try again later."
  }
});

const expensiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    error:
      "Too many AI requests. Please try again later."
  }
});

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    error:
      "Too many requests. Please try again later."
  }
});

// ============================================================
// PATHS
// ============================================================

const frontendPath =
  path.join(
    __dirname,
    "..",
    "frontend"
  );

const uploadDirectory =
  path.join(
    os.tmpdir(),
    "gravity-uploads"
  );

// ============================================================
// CREATE UPLOAD DIRECTORY
// ============================================================

if (
  !fs.existsSync(
    uploadDirectory
  )
) {
  fs.mkdirSync(
    uploadDirectory,
    {
      recursive: true
    }
  );
}

// ============================================================
// STARTUP LOG
// ============================================================

console.log("");

console.log(
  "📁 Upload directory:"
);

console.log(
  uploadDirectory
);

// ============================================================
// CORS
// ============================================================
//
// Security hardening:
// - Only configured frontend origins are allowed.
// - FRONTEND_URL can contain multiple origins separated
//   by commas.
// - Requests without an Origin header are allowed.
//   This keeps curl/server-to-server requests working.
//

const allowedFrontendOrigins = (
  process.env.FRONTEND_URL ||
  `http://localhost:${PORT}`
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log("");

console.log(
  "🌐 Allowed CORS origins:"
);

console.log(
  allowedFrontendOrigins
);

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  cors({
    origin: (requestOrigin, callback) => {

      // Requests without an Origin header
      // such as curl/server-to-server requests.
      if (!requestOrigin) {
        return callback(null, true);
      }

      if (
        allowedFrontendOrigins.includes(
          requestOrigin
        )
      ) {
        return callback(null, true);
      }

      console.warn(
        "🚫 CORS origin blocked:",
        requestOrigin
      );

      // Do not throw an error here.
      // This lets CORS reject the browser request
      // without turning it into a server crash.
      return callback(null, false);
    },

    credentials: true
  })
);

app.use(
  express.json({
    limit: "20mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb"
  })
);

// ============================================================
// STATIC FRONTEND
// ============================================================

app.use(
  express.static(
    frontendPath
  )
);

console.log("");

console.log(
  "🎨 Frontend loaded:"
);

console.log(
  frontendPath
);

// ============================================================
// MULTER
// ============================================================

const upload = multer({
  dest: uploadDirectory,

  limits: {
    fileSize:
      50 * 1024 * 1024
  }
});

// ============================================================
// AUTH ROUTES
// ============================================================

app.use(
  "/api/auth",
  authRateLimiter,
  authRoutes
);

// ============================================================
// HEALTH
// ============================================================

app.get(
  "/api/health",
  (req, res) => {

    return res.json({
      success: true,
      status: "ok",
      service: "Gravity Backend",
      time: new Date().toISOString()
    });

  }
);

// ============================================================
// FILE SUPPORT INFO
// ============================================================

app.get(
  "/api/file-support",
  (req, res) => {

    try {

      const model =
        process.env
          .FILE_ANALYSIS_MODEL ||
        "gemini-2.5-flash-lite";

      return res.json({
        success: true,

        model,

        maxFileSizeMB: 50,

        supported: {

          images: [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif"
          ],

          documents: [
            "pdf",
            "docx",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
            "txt",
            "md",
            "csv"
          ],

          code: [
            "js",
            "jsx",
            "ts",
            "tsx",
            "html",
            "css",
            "scss",
            "json",
            "xml",
            "c",
            "h",
            "cpp",
            "hpp",
            "cs",
            "java",
            "py",
            "php",
            "sql",
            "sh",
            "bat",
            "ps1",
            "go",
            "rs",
            "kt",
            "swift",
            "dart"
          ]

        }

      });

    } catch (error) {

      console.error(
        "❌ FILE SUPPORT ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to load file support information."

      });

    }

  }
);

// ============================================================
// AUTHENTICATED USER
// ============================================================

app.get(
  "/api/auth/me",
  apiRateLimiter,
  authMiddleware,
  async (req, res) => {

    try {

      return res.json({

        success: true,

        user: {

          id: req.user.id,

          email:
            req.user.email,

          name:
            req.user.name,

          profileImage:
            req.user.profileImage ||
            null

        }

      });

    } catch (error) {

      console.error(
        "❌ AUTH ME ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to load user."

      });

    }

  }
);

// ============================================================
// CREATE CONVERSATION
// ============================================================

app.post(
  "/api/conversation",
  apiRateLimiter,
  authMiddleware,
  async (req, res) => {

    try {

      const title =
        typeof req.body?.title ===
        "string"
          ? req.body.title.trim()
          : "New Chat";

      const conversation =
        await conversationManager.createConversation(
          req.user.id,
          title || "New Chat"
        );

      console.log("");

      console.log(
        "🆕 Conversation created:",
        conversation.id
      );

      console.log(
        "👤 Owner:",
        req.user.id
      );

      return res.status(201).json({
        success: true,
        conversation
      });

    } catch (error) {

      console.error(
        "❌ CREATE CONVERSATION ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to create conversation."

      });

    }

  }
);

// ============================================================
// LIST CONVERSATIONS
// ============================================================

app.get(
  "/api/conversations",
  apiRateLimiter,
  authMiddleware,
  async (req, res) => {

    try {

      const conversations =
        await conversationManager.listConversations(
          req.user.id
        );

      return res.json({
        success: true,
        conversations
      });

    } catch (error) {

      console.error(
        "❌ LIST CONVERSATIONS ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to load conversations."

      });

    }

  }
);

// ============================================================
// GET SINGLE CONVERSATION
// ============================================================

app.get(
  "/api/conversation/:conversationId",
  apiRateLimiter,
  authMiddleware,
  async (req, res) => {

    try {

      const conversation =
        await conversationManager.getConversation(
          req.user.id,
          req.params.conversationId
        );

      return res.json({
        success: true,
        conversation
      });

    } catch (error) {

      console.error(
        "❌ GET CONVERSATION ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to load conversation."

      });

    }

  }
);

// ============================================================
// GET CONVERSATION HISTORY
// ============================================================

app.get(
  "/api/conversation/:conversationId/history",
  apiRateLimiter,
  authMiddleware,
  async (req, res) => {

    try {

      const conversation =
        await conversationManager.getConversation(
          req.user.id,
          req.params.conversationId
        );

      return res.json({

        success: true,

        conversationId:
          conversation.id,

        title:
          conversation.title,

        messages:
          conversation.messages || []

      });

    } catch (error) {

      console.error(
        "❌ HISTORY ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to load chat history."

      });

    }

  }
);

// ============================================================
// NORMAL GEMINI CHAT
// POST /api/gemini
// ============================================================

app.post(
  "/api/gemini",
  expensiveRateLimiter,
  authMiddleware,
  async (req, res) => {

    const requestStarted =
      Date.now();

    try {

      // --------------------------------------------------------
      // QUESTION
      // --------------------------------------------------------

      const rawQuestion =
        req.body?.question;

      if (
        typeof rawQuestion !==
        "string"
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Question is required."
        });

      }

      const cleanQuestion =
        rawQuestion.trim();

      if (!cleanQuestion) {

        return res.status(400).json({
          success: false,
          error:
            "Question cannot be empty."
        });

      }

      if (
        cleanQuestion.length >
        10000
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Question is too long."
        });

      }

      // --------------------------------------------------------
      // CONVERSATION
      // --------------------------------------------------------

      const requestedConversationId =
        req.body?.conversationId ||
        null;

      const conversation =
        await conversationManager
          .getOrCreateConversation(
            req.user.id,
            requestedConversationId
          );

      const conversationId =
        conversation.id;

      console.log("");

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      console.log(
        "💬 GRAVITY CHAT REQUEST"
      );

      console.log(
        `👤 User: ${req.user.email}`
      );

      console.log(
        `🆔 Conversation: ${conversationId}`
      );

      console.log(
        `❓ Question: ${cleanQuestion}`
      );

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      // --------------------------------------------------------
      // SAVE USER MESSAGE
      // --------------------------------------------------------

      await conversationManager
        .addUserMessage(
          req.user.id,
          conversationId,
          cleanQuestion
        );

      // --------------------------------------------------------
      // GRAVITY OWN RESPONSE
      // --------------------------------------------------------

      let gravityAnswer = null;
      let gravityRoute = null;

      try {

        if (
          typeof gravityRouter
            .getRoutedResponse ===
          "function"
        ) {

          gravityAnswer =
            gravityRouter.getRoutedResponse(
              cleanQuestion
            );

          if (
            gravityAnswer
          ) {

            if (
              typeof gravityRouter
                .routeQuestion ===
              "function"
            ) {

              gravityRoute =
                gravityRouter.routeQuestion(
                  cleanQuestion
                );

            } else {

              gravityRoute =
                "gravity";

            }

          }

        } else if (
          typeof gravityRouter
            .routeQuestion ===
          "function"
        ) {

          gravityRoute =
            gravityRouter.routeQuestion(
              cleanQuestion
            );

          if (
            gravityRoute &&
            typeof gravityRouter
              .getGravityResponse ===
            "function"
          ) {

            gravityAnswer =
              gravityRouter.getGravityResponse(
                gravityRoute
              );

          }

        }

      } catch (routeError) {

        console.error(
          "⚠️ Gravity router error:",
          routeError.message
        );

        gravityAnswer = null;
        gravityRoute = null;

      }

      // --------------------------------------------------------
      // RETURN GRAVITY OWN RESPONSE
      // --------------------------------------------------------

      if (gravityAnswer) {

        await conversationManager
          .addGravityMessage(
            req.user.id,
            conversationId,
            gravityAnswer
          );

        console.log(
          "🟣 Gravity own response used."
        );

        console.log(
          `📌 Route: ${
            gravityRoute ||
            "gravity"
          }`
        );

        console.log(
          `⏱️ ${
            Date.now() -
            requestStarted
          }ms`
        );

        console.log(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        return res.json({

          success: true,

          source: "gravity",

          answer:
            gravityAnswer,

          blocks: [
            {
              type: "paragraph",
              text:
                gravityAnswer
            }
          ],

          conversationId

        });

      }

      // --------------------------------------------------------
      // BUILD CONTEXT
      // --------------------------------------------------------

      let geminiPrompt;

      try {

        geminiPrompt =
          await conversationManager
            .buildGeminiPrompt(
              req.user.id,
              conversationId,
              cleanQuestion
            );

      } catch (contextError) {

        console.error(
          "⚠️ Conversation context error:",
          contextError.message
        );

        geminiPrompt =
          cleanQuestion;

      }

      // --------------------------------------------------------
      // GEMINI WEB
      // --------------------------------------------------------

      console.log("");

      console.log(
        "🤖 Sending request to Gemini Web..."
      );

      console.log(
        "🌐 Engine: Gemini Web"
      );

      let geminiResult;

      try {

        if (
          !geminiWeb ||
          typeof geminiWeb.askGemini !==
          "function"
        ) {

          throw new Error(
            "geminiWeb.askGemini is not available."
          );

        }

        console.log(
          "RUNTIME GEMINI PROMPT LENGTH:",
          geminiPrompt.length
        );

        geminiResult =
          await geminiWeb.askGemini(
            geminiPrompt
          );

      } catch (geminiError) {

        console.error("");
        console.error(
          "❌ GEMINI WEB ERROR"
        );

        console.error(
          geminiError.message
        );

        console.error(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

        return res.status(
          geminiError.statusCode ||
          geminiError.status ||
          500
        ).json({

          success: false,

          source: "gemini-web",

          error:
            geminiError.message ||
            "Gemini Web request failed.",

          conversationId

        });

      }

      // --------------------------------------------------------
      // NORMALIZE GEMINI RESULT
      // --------------------------------------------------------

      let answer = "";
      let blocks = [];

      if (
        typeof geminiResult ===
        "string"
      ) {

        answer =
          geminiResult.trim();

      } else if (
        geminiResult &&
        typeof geminiResult ===
        "object"
      ) {

        answer =
          typeof geminiResult.answer ===
          "string"
            ? geminiResult.answer.trim()
            : typeof geminiResult.text ===
              "string"
              ? geminiResult.text.trim()
              : "";

        if (
          Array.isArray(
            geminiResult.blocks
          )
        ) {

          blocks =
            geminiResult.blocks;

        }

      }

      // --------------------------------------------------------
      // EMPTY RESPONSE CHECK
      // --------------------------------------------------------

      if (!answer) {

        console.error(
          "❌ Gemini returned an empty answer."
        );

        return res.status(502).json({

          success: false,

          source: "gemini-web",

          error:
            "Gemini returned an empty response.",

          conversationId

        });

      }

      // --------------------------------------------------------
      // SAVE GEMINI RESPONSE
      // --------------------------------------------------------

      await conversationManager
        .addGeminiMessage(
          req.user.id,
          conversationId,
          answer
        );

      // --------------------------------------------------------
      // FALLBACK BLOCK
      // --------------------------------------------------------

      if (
        !Array.isArray(blocks) ||
        blocks.length === 0
      ) {

        blocks = [
          {
            type: "paragraph",
            text: answer
          }
        ];

      }

      // --------------------------------------------------------
      // FINAL RESPONSE
      // --------------------------------------------------------

      console.log("");

      console.log(
        "🎉 Gemini answer received."
      );

      console.log(
        `📏 Answer length: ${
          answer.length
        }`
      );

      console.log(
        `📦 Blocks: ${
          blocks.length
        }`
      );

      console.log(
        `⏱️ ${
          Date.now() -
          requestStarted
        }ms`
      );

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      return res.json({

        success: true,

        source: "gemini-web",

        answer,

        blocks,

        conversationId

      });

    } catch (error) {

      console.error("");
      console.error(
        "❌ GEMINI ROUTE ERROR"
      );

      console.error(
        error.message
      );

      console.error(
        error.stack
      );

      console.error(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to process your question.",

        conversationId:
          req.body?.conversationId ||
          null

      });

    }

  }
);

// ============================================================
// FILE / IMAGE ANALYSIS
// POST /api/analyze-file
// ============================================================

app.post(
  "/api/analyze-file",
  expensiveRateLimiter,
  authMiddleware,
  upload.single("file"),
  async (req, res) => {

    let uploadedFilePath = null;

    try {

      // --------------------------------------------------------
      // FILE CHECK
      // --------------------------------------------------------

      if (!req.file) {

        return res.status(400).json({
          success: false,
          error:
            "Please upload a file."
        });

      }

      uploadedFilePath =
        req.file.path;

      // --------------------------------------------------------
      // QUESTION
      // --------------------------------------------------------

      const question =
        typeof req.body?.question ===
        "string"
          ? req.body.question.trim()
          : "";

      // --------------------------------------------------------
      // CONVERSATION
      // --------------------------------------------------------

      const requestedConversationId =
        req.body?.conversationId ||
        null;

      const conversation =
        await conversationManager
          .getOrCreateConversation(
            req.user.id,
            requestedConversationId
          );

      const conversationId =
        conversation.id;

      // --------------------------------------------------------
      // FILE INFO
      // --------------------------------------------------------

      console.log("");

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      console.log(
        "📎 FILE ANALYSIS REQUEST"
      );

      console.log(
        `👤 User: ${req.user.email}`
      );

      console.log(
        `📄 File: ${
          req.file.originalname
        }`
      );

      console.log(
        `📦 Size: ${
          req.file.size
        } bytes`
      );

      console.log(
        `🧾 MIME: ${
          req.file.mimetype
        }`
      );

      console.log(
        `🆔 Conversation: ${
          conversationId
        }`
      );

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      // --------------------------------------------------------
      // SAVE FILE MESSAGE
      // --------------------------------------------------------

      await conversationManager
        .addFileMessage(
          req.user.id,
          conversationId,
          {
            originalName:
              req.file.originalname,

            mimeType:
              req.file.mimetype,

            size:
              req.file.size
          }
        );

      // --------------------------------------------------------
      // ANALYZE FILE
      // --------------------------------------------------------

      if (
        !fileAnalyzer ||
        typeof fileAnalyzer.analyzeFile !==
        "function"
      ) {

        throw new Error(
          "fileAnalyzer.analyzeFile is not available."
        );

      }

      const analysis =
        await fileAnalyzer.analyzeFile({
          filePath:
            uploadedFilePath,

          mimeType:
            req.file.mimetype,

          originalName:
            req.file.originalname,

          question
        });

      // --------------------------------------------------------
      // NORMALIZE ANALYSIS RESULT
      // --------------------------------------------------------

      let answer = "";

      let blocks = [];

      let analysisType =
        null;

      let model =
        process.env
          .FILE_ANALYSIS_MODEL ||
        "gemini-2.5-flash-lite";

      if (
        typeof analysis ===
        "string"
      ) {

        answer =
          analysis.trim();

      } else if (
        analysis &&
        typeof analysis ===
        "object"
      ) {

        answer =
          typeof analysis.answer ===
          "string"
            ? analysis.answer.trim()
            : typeof analysis.text ===
              "string"
              ? analysis.text.trim()
              : "";

        if (
          Array.isArray(
            analysis.blocks
          )
        ) {

          blocks =
            analysis.blocks;

        }

        if (
          analysis.analysisType
        ) {

          analysisType =
            analysis.analysisType;

        }

        if (
          analysis.model
        ) {

          model =
            analysis.model;

        }

      }

      // --------------------------------------------------------
      // EMPTY ANALYSIS
      // --------------------------------------------------------

      if (!answer) {

        throw new Error(
          "File analyzer returned an empty response."
        );

      }

      // --------------------------------------------------------
      // FALLBACK BLOCK
      // --------------------------------------------------------

      if (
        !Array.isArray(blocks) ||
        blocks.length === 0
      ) {

        blocks = [
          {
            type: "paragraph",
            text: answer
          }
        ];

      }

      // --------------------------------------------------------
      // SAVE FILE ANALYSIS
      // --------------------------------------------------------

      await conversationManager
        .addFileAnalysisMessage(
          req.user.id,
          conversationId,
          answer,
          {
            originalName:
              req.file.originalname,

            mimeType:
              req.file.mimetype,

            size:
              req.file.size,

            analysisType:
              analysisType ||
              "file"
          }
        );

      // --------------------------------------------------------
      // RESPONSE
      // --------------------------------------------------------

      console.log("");

      console.log(
        "✅ FILE ANALYSIS COMPLETE"
      );

      console.log(
        `📏 Answer length: ${
          answer.length
        }`
      );

      console.log(
        `📦 Blocks: ${
          blocks.length
        }`
      );

      console.log(
        `🤖 Model: ${
          model
        }`
      );

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      return res.json({

        success: true,

        source: "file-analysis",

        answer,

        blocks,

        analysisType:
          analysisType ||
          "file",

        model,

        file: {

          originalName:
            req.file.originalname,

          mimeType:
            req.file.mimetype,

          size:
            req.file.size

        },

        conversationId

      });

    } catch (error) {

      console.error("");
      console.error(
        "❌ FILE ANALYSIS ERROR"
      );

      console.error(
        error.message
      );

      console.error(
        error.stack
      );

      console.error(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      // --------------------------------------------------------
      // UNSUPPORTED FILE TYPE
      // --------------------------------------------------------

      const isUnsupportedFileType =
        typeof error.message ===
          "string" &&
        error.message.startsWith(
          "Unsupported file type:"
        );

      const statusCode =
        error.statusCode ||
        error.status ||
        (
          isUnsupportedFileType
            ? 400
            : 500
        );

      return res.status(
        statusCode
      ).json({

        success: false,

        error:
          error.message ||
          "File analysis failed.",

        conversationId:
          req.body?.conversationId ||
          null

      });

    } finally {

      // --------------------------------------------------------
      // DELETE TEMP FILE
      // --------------------------------------------------------

      if (
        uploadedFilePath &&
        fs.existsSync(
          uploadedFilePath
        )
      ) {

        try {

          fs.unlinkSync(
            uploadedFilePath
          );

          console.log(
            "🗑️ Temporary upload deleted."
          );

        } catch (deleteError) {

          console.error(
            "⚠️ Temp file cleanup failed:",
            deleteError.message
          );

        }

      }

    }

  }
);

// ============================================================
// DELETE ONE CONVERSATION
// ============================================================

app.delete(
  "/api/conversation/:conversationId",
  apiRateLimiter,
  authMiddleware,
  async (req, res) => {

    try {

      await conversationManager
        .deleteConversation(
          req.user.id,
          req.params.conversationId
        );

      return res.json({
        success: true
      });

    } catch (error) {

      console.error(
        "❌ DELETE CONVERSATION ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to delete conversation."

      });

    }

  }
);

// ============================================================
// DELETE ALL CONVERSATIONS
// ============================================================

app.delete(
  "/api/conversations",
  apiRateLimiter,
  authMiddleware,
  async (req, res) => {

    try {

      const result =
        await conversationManager
          .deleteAllConversations(
            req.user.id
          );

      return res.json({

        success: true,

        deletedCount:
          result.deletedCount || 0

      });

    } catch (error) {

      console.error(
        "❌ DELETE ALL CONVERSATIONS ERROR:",
        error.message
      );

      return res.status(
        error.statusCode ||
        error.status ||
        500
      ).json({

        success: false,

        error:
          error.message ||
          "Unable to delete conversations."

      });

    }

  }
);

// ============================================================
// API 404
// ============================================================

app.use(
  "/api",
  (req, res) => {

    return res.status(404).json({

      success: false,

      error:
        `API route not found: ${req.method} ${req.originalUrl}`

    });

  }
);

// ============================================================
// FRONTEND FALLBACK
// ============================================================

app.use(
  (req, res, next) => {

    // Don't interfere with API routes
    if (
      req.originalUrl.startsWith(
        "/api/"
      )
    ) {

      return next();

    }

    const indexPath =
      path.join(
        frontendPath,
        "index.html"
      );

    if (
      fs.existsSync(indexPath)
    ) {

      return res.sendFile(
        indexPath
      );

    }

    return res.status(404).send(
      "Gravity frontend not found."
    );

  }
);

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

app.use(
  (error, req, res, next) => {

    if (
      error instanceof multer.MulterError
    ) {

      console.error(
        "❌ MULTER ERROR:",
        error.message
      );

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(413).json({

          success: false,

          error:
            "File is too large. Maximum size is 50 MB."

        });

      }

      return res.status(400).json({

        success: false,

        error:
          error.message

      });

    }

    return next(error);

  }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
  (error, req, res, next) => {

    console.error("");

    console.error(
      "❌ GLOBAL SERVER ERROR"
    );

    console.error(
      error.message
    );

    console.error(
      error.stack
    );

    if (res.headersSent) {

      return next(error);

    }

    return res.status(
      error.statusCode ||
      error.status ||
      500
    ).json({

      success: false,

      error:
        error.message ||
        "Internal server error."

    });

  }
);

// ============================================================
// START SERVER
// ============================================================

async function startServer() {

  try {

    console.log("");

    console.log(
      "🚀 STARTING GRAVITY BACKEND"
    );

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    // --------------------------------------------------------
    // DATABASE
    // --------------------------------------------------------

    await connectDatabase();

    // --------------------------------------------------------
    // SERVER
    // --------------------------------------------------------

    app.listen(
      PORT,
      () => {

        console.log("");

        console.log(
          `🚀 Gravity server running on port ${PORT}`
        );

        console.log(
          `🌐 http://localhost:${PORT}`
        );

        console.log(
          `❤️  Health: http://localhost:${PORT}/api/health`
        );

        console.log(
          `🔐 Auth: http://localhost:${PORT}/api/auth`
        );

        console.log(
          `💬 Conversations: http://localhost:${PORT}/api/conversations`
        );

        console.log(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        );

      }
    );

  } catch (error) {

    console.error("");

    console.error(
      "❌ GRAVITY SERVER STARTUP FAILED"
    );

    console.error(
      error.message
    );

    console.error(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    process.exit(1);

  }

}

// ============================================================
// START
// ============================================================

startServer();

// ============================================================
// EXPORT
// ============================================================

module.exports = app;