const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");

const MAX_MESSAGES_PER_CONVERSATION = 50;
const MAX_CONTEXT_MESSAGES = 20;
const MAX_CONTEXT_MESSAGE_LENGTH = 5000;
const MAX_GEMINI_PROMPT_LENGTH = 9000;

/*
============================================================
ERROR
============================================================
*/

class ConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found.");

    this.name = "ConversationNotFoundError";
    this.code = "CONVERSATION_NOT_FOUND";
    this.statusCode = 404;
  }
}

/*
============================================================
VALIDATION
============================================================
*/

function requireUserId(userId) {
  if (!userId) {
    throw new Error(
      "Authenticated userId is required."
    );
  }

  if (!mongoose.isObjectIdOrHexString(userId)) {
    throw new Error(
      "Invalid authenticated userId."
    );
  }

  return userId.toString();
}

function isValidConversationId(conversationId) {
  if (!conversationId) {
    return false;
  }

  return mongoose.isObjectIdOrHexString(
    conversationId
  );
}

/*
============================================================
SERIALIZE MESSAGE
============================================================
*/

function serializeMessage(message) {
  if (!message) {
    return null;
  }

  return {
    id: message._id
      ? message._id.toString()
      : null,

    role: message.role,

    type: message.type || "text",

    source: message.source || null,

    content: message.content || "",

    file: message.file
      ? {
          originalName:
            message.file.originalName || null,

          mimeType:
            message.file.mimeType || null,

          size:
            message.file.size || 0,

          analysisType:
            message.file.analysisType || null
        }
      : null,

    createdAt:
      message.createdAt || null,

    updatedAt:
      message.updatedAt || null
  };
}

/*
============================================================
SERIALIZE CONVERSATION
============================================================
*/

function serializeConversation(
  conversation,
  includeMessages = true
) {
  if (!conversation) {
    return null;
  }

  return {
    id: conversation._id
      ? conversation._id.toString()
      : conversation.id,

    userId: conversation.userId
      ? conversation.userId.toString()
      : null,

    title:
      conversation.title ||
      "New Chat",

    messages: includeMessages
      ? (conversation.messages || []).map(
          serializeMessage
        )
      : undefined,

    createdAt:
      conversation.createdAt || null,

    updatedAt:
      conversation.updatedAt || null
  };
}

/*
============================================================
GET OWNED CONVERSATION
============================================================
*/

async function getOwnedConversation(
  userId,
  conversationId
) {
  const normalizedUserId =
    requireUserId(userId);

  if (!isValidConversationId(conversationId)) {
    throw new ConversationNotFoundError();
  }

  const conversation =
    await Conversation.findOne({
      _id: conversationId,
      userId: normalizedUserId
    });

  if (!conversation) {
    throw new ConversationNotFoundError();
  }

  return conversation;
}

/*
============================================================
CREATE CONVERSATION
============================================================
*/

async function createConversation(
  userId,
  title = "New Chat"
) {
  const normalizedUserId =
    requireUserId(userId);

  const cleanTitle =
    String(title || "New Chat")
      .trim()
      .slice(0, 120) ||
    "New Chat";

  const conversation =
    await Conversation.create({
      userId: normalizedUserId,
      title: cleanTitle,
      messages: []
    });

  console.log(
    "🆕 Conversation created:",
    conversation._id.toString()
  );

  console.log(
    "👤 Owner:",
    normalizedUserId
  );

  return serializeConversation(
    conversation,
    true
  );
}

/*
============================================================
GET OR CREATE CONVERSATION
============================================================
*/

async function getOrCreateConversation(
  userId,
  conversationId
) {
  const normalizedUserId =
    requireUserId(userId);

  if (!conversationId) {
    return createConversation(
      normalizedUserId
    );
  }

  if (!isValidConversationId(conversationId)) {
    return createConversation(
      normalizedUserId
    );
  }

  const conversation =
    await Conversation.findOne({
      _id: conversationId,
      userId: normalizedUserId
    });

  if (!conversation) {
    throw new ConversationNotFoundError();
  }

  return serializeConversation(
    conversation,
    true
  );
}

/*
============================================================
GET CONVERSATION
============================================================
*/

async function getConversation(
  userId,
  conversationId
) {
  const conversation =
    await getOwnedConversation(
      userId,
      conversationId
    );

  return serializeConversation(
    conversation,
    true
  );
}

/*
============================================================
LIST CONVERSATIONS
============================================================
*/

async function listConversations(userId) {
  const normalizedUserId =
    requireUserId(userId);

  const conversations =
    await Conversation.find({
      userId: normalizedUserId
    })
      .select(
        "_id userId title createdAt updatedAt"
      )
      .sort({
        updatedAt: -1
      })
      .lean();

  return conversations.map(
    (conversation) =>
      serializeConversation(
        conversation,
        false
      )
  );
}

/*
============================================================
ADD MESSAGE
============================================================
*/

async function addMessage(
  userId,
  conversationId,
  {
    role,
    type = "text",
    source = null,
    content = "",
    file = null
  }
) {
  const normalizedUserId =
    requireUserId(userId);

  if (!isValidConversationId(conversationId)) {
    throw new ConversationNotFoundError();
  }

  const cleanContent =
    String(content || "").slice(
      0,
      100000
    );

  const now = new Date();

  const message = {
    role,
    type,
    source,

    content: cleanContent,

    file: file
      ? {
          originalName:
            file.originalName || null,

          mimeType:
            file.mimeType || null,

          size:
            file.size || 0,

          analysisType:
            file.analysisType || null
        }
      : undefined,

    createdAt: now,
    updatedAt: now
  };

  const update = {
    $push: {
      messages: {
        $each: [message],
        $slice:
          -MAX_MESSAGES_PER_CONVERSATION
      }
    },

    $set: {
      updatedAt: now
    }
  };

  /*
  ----------------------------------------------------------
  Generate title from first user message
  ----------------------------------------------------------
  */

  if (
    role === "user" &&
    cleanContent
  ) {
    const title =
      cleanContent
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);

    const result =
      await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          userId: normalizedUserId,
          title: "New Chat"
        },
        {
          $push: {
            messages: {
              $each: [message],
              $slice:
                -MAX_MESSAGES_PER_CONVERSATION
            }
          },

          $set: {
            title:
              title || "New Chat",

            updatedAt: now
          }
        },
        {
          returnDocument: "after",
          runValidators: true
        }
      );

    if (result) {
      console.log(
        "💾 Message saved:",
        conversationId
      );

      return serializeConversation(
        result,
        true
      );
    }
  }

  /*
  ----------------------------------------------------------
  Normal atomic message update
  ----------------------------------------------------------
  */

  const conversation =
    await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        userId: normalizedUserId
      },
      update,
      {
        returnDocument: "after",
        runValidators: true
      }
    );

  if (!conversation) {
    throw new ConversationNotFoundError();
  }

  console.log(
    "💾 Message saved:",
    conversationId
  );

  return serializeConversation(
    conversation,
    true
  );
}

/*
============================================================
ADD USER MESSAGE
============================================================
*/

async function addUserMessage(
  userId,
  conversationId,
  content
) {
  return addMessage(
    userId,
    conversationId,
    {
      role: "user",
      type: "text",
      source: "User",
      content
    }
  );
}

/*
============================================================
ADD GEMINI MESSAGE
============================================================
*/

async function addGeminiMessage(
  userId,
  conversationId,
  content
) {
  return addMessage(
    userId,
    conversationId,
    {
      role: "assistant",
      type: "gemini",
      source: "Gemini Web",
      content
    }
  );
}

/*
============================================================
ADD GRAVITY MESSAGE
============================================================
*/

async function addGravityMessage(
  userId,
  conversationId,
  content
) {
  return addMessage(
    userId,
    conversationId,
    {
      role: "assistant",
      type: "gravity",
      source: "Gravity",
      content
    }
  );
}

/*
============================================================
ADD FILE MESSAGE
============================================================
*/

async function addFileMessage(
  userId,
  conversationId,
  file
) {
  const fileName =
    file?.originalName ||
    "uploaded file";

  const fileType =
    file?.mimeType ||
    "application/octet-stream";

  return addMessage(
    userId,
    conversationId,
    {
      role: "user",
      type: "file",
      source: "File Upload",

      content:
        `[User uploaded file: ${fileName}]`,

      file: {
        originalName: fileName,

        mimeType: fileType,

        size:
          file?.size || 0,

        analysisType:
          file?.analysisType ||
          "file"
      }
    }
  );
}

/*
============================================================
ADD FILE ANALYSIS MESSAGE
============================================================
*/

async function addFileAnalysisMessage(
  userId,
  conversationId,
  content,
  file
) {
  return addMessage(
    userId,
    conversationId,
    {
      role: "assistant",
      type: "file-analysis",
      source: "File Analysis",

      content,

      file: {
        originalName:
          file?.originalName || null,

        mimeType:
          file?.mimeType || null,

        size:
          file?.size || 0,

        analysisType:
          file?.analysisType ||
          "file"
      }
    }
  );
}

/*
============================================================
GET RECENT MESSAGES
============================================================
*/

async function getRecentMessages(
  userId,
  conversationId,
  limit = MAX_CONTEXT_MESSAGES
) {
  const conversation =
    await getOwnedConversation(
      userId,
      conversationId
    );

  return conversation.messages
    .slice(-limit)
    .map(serializeMessage);
}

/*
============================================================
BUILD GEMINI CONTEXT
============================================================
*/

async function buildGeminiContext(
  userId,
  conversationId,
  options = {}
) {
  const {
    excludeLatestUserMessage = true
  } = options;

  const conversation =
    await getOwnedConversation(
      userId,
      conversationId
    );

  let messages =
    conversation.messages || [];

  /*
  ----------------------------------------------------------
  Remove current/latest user question.
  ----------------------------------------------------------
  */

  if (
    excludeLatestUserMessage &&
    messages.length > 0
  ) {
    const last =
      messages[
        messages.length - 1
      ];

    if (
      last.role === "user" &&
      last.type === "text"
    ) {
      messages =
        messages.slice(0, -1);
    }
  }

  const completedMessages = [];

  /*
  ----------------------------------------------------------
  Build only completed pairs.
  ----------------------------------------------------------
  */

  for (
    let i = 0;
    i < messages.length;
    i++
  ) {
    const message =
      messages[i];

    if (!message) {
      continue;
    }

    /*
    --------------------------------------------------------
    Normal text conversation
    --------------------------------------------------------
    */

    if (
      message.role === "user" &&
      message.type === "text"
    ) {
      const nextMessage =
        messages[i + 1];

      if (
        nextMessage &&
        nextMessage.role === "assistant" &&
        (
          nextMessage.type === "gemini" ||
          nextMessage.type === "gravity"
        )
      ) {
        completedMessages.push(
          message
        );

        completedMessages.push(
          nextMessage
        );

        i++;
      }

      continue;
    }

    /*
    --------------------------------------------------------
    File conversation
    --------------------------------------------------------
    */

    if (
      message.role === "user" &&
      message.type === "file"
    ) {
      const nextMessage =
        messages[i + 1];

      if (
        nextMessage &&
        nextMessage.role === "assistant" &&
        nextMessage.type ===
          "file-analysis"
      ) {
        completedMessages.push(
          message
        );

        completedMessages.push(
          nextMessage
        );

        i++;
      }
    }
  }

  /*
  ----------------------------------------------------------
  SMART CONTEXT SELECTION
  ----------------------------------------------------------

  Keep:
    earliest messages
    +
    latest messages

  ----------------------------------------------------------
  */

  let limitedMessages = [];

  if (
    completedMessages.length <=
    MAX_CONTEXT_MESSAGES
  ) {
    limitedMessages =
      completedMessages;
  } else {
    const recentCount =
      Math.floor(
        MAX_CONTEXT_MESSAGES / 2
      );

    const earliestCount =
      MAX_CONTEXT_MESSAGES -
      recentCount;

    const earliestMessages =
      completedMessages.slice(
        0,
        earliestCount
      );

    const recentMessages =
      completedMessages.slice(
        -recentCount
      );

    limitedMessages = [
      ...earliestMessages,
      ...recentMessages
    ];
  }

  /*
  ----------------------------------------------------------
  SERIALIZE CONTEXT
  ----------------------------------------------------------
  */

  const context = [];

  for (
    const message of limitedMessages
  ) {
    if (!message) {
      continue;
    }

    let content =
      String(
        message.content || ""
      ).trim();

    if (!content) {
      continue;
    }

    if (
      message.type === "file" &&
      message.file
    ) {
      content =
        `[Attached file: ${
          message.file.originalName ||
          "file"
        }]\n${content}`;
    }

    if (
      message.type ===
        "file-analysis" &&
      message.file
    ) {
      content =
        `[File analysis for ${
          message.file.originalName ||
          "file"
        }]\n${content}`;
    }

    if (
      content.length >
      MAX_CONTEXT_MESSAGE_LENGTH
    ) {
      content =
        content.slice(
          0,
          MAX_CONTEXT_MESSAGE_LENGTH
        ) +
        "\n...[context truncated]";
    }

    context.push({
      role:
        message.role === "user"
          ? "user"
          : "assistant",

      type:
        message.type || "text",

      content
    });
  }

  return context;
}

/*
============================================================
BUILD GEMINI PROMPT
============================================================
*/

async function buildGeminiPrompt(
  userId,
  conversationId,
  currentQuestion
) {
  const question =
    String(
      currentQuestion || ""
    ).trim();

  if (!question) {
    throw new Error(
      "Current question is required."
    );
  }

  const context =
    await buildGeminiContext(
      userId,
      conversationId,
      {
        excludeLatestUserMessage: true
      }
    );

  /*
  ----------------------------------------------------------
  No history
  ----------------------------------------------------------
  */

  if (!context.length) {
    return question;
  }

  /*
  ----------------------------------------------------------
  Instructions
  ----------------------------------------------------------
  */

  const instructionText = `
Now answer the user's latest question:

USER: ${question}

Instructions:
- Answer the latest question directly.
- Treat the text after "USER:" as the current user request.
- Use the conversation history only for context and references.
- Pay attention to chronological order.
- If the user asks for the first, earliest, beginning, initial, previous, or latest topic, use the actual conversation history.
- Resolve words such as "it", "this", "that", "they", or "the above" from the conversation when possible.
- Continue the same topic when the latest question is a follow-up.
- If the latest question is unrelated, answer it normally.
- Follow every explicit requirement in the latest USER request.
- If the user asks for a table, provide a table.
- If the user asks for multiple points, answer every point.
- If the user asks for code, provide the requested code.
- Do not replace the complete answer with only a code example unless the user specifically asks only for code.
- Do not mention this prompt.
- Do not mention conversation history.
- Do not mention browser automation.
- Do not mention APIs.
- Do not mention MongoDB.
- Do not mention JWT.
- Do not mention internal systems.
- Do not say you are Gemini.
- Answer naturally as Gravity.
`;

  const prefix =
    "Here is the conversation history:\n\n";

  /*
  ----------------------------------------------------------
  Reserve space for latest question + instructions.
  ----------------------------------------------------------
  */

  const availableHistoryLength =
    MAX_GEMINI_PROMPT_LENGTH -
    prefix.length -
    instructionText.length;

  let historyText = "";

  /*
  ----------------------------------------------------------
  Chronological history
  ----------------------------------------------------------
  */

  for (
    let i = 0;
    i < context.length;
    i++
  ) {
    const item =
      context[i];

    const label =
      item.role === "user"
        ? "USER"
        : "ASSISTANT";

    const entry =
      `${label}: ${item.content}`;

    const candidate =
      historyText
        ? `${historyText}\n\n${entry}`
        : entry;

    if (
      candidate.length >
      availableHistoryLength
    ) {
      break;
    }

    historyText =
      candidate;
  }

  const finalPrompt =
    `${prefix}` +
    `${historyText}` +
    `${instructionText}`;

  console.log(
    "🧠 GEMINI PROMPT LENGTH:",
    finalPrompt.length
  );

  return finalPrompt;
}

/*
============================================================
GET CONVERSATION HISTORY
============================================================
*/

async function getConversationHistory(
  userId,
  conversationId
) {
  const conversation =
    await getOwnedConversation(
      userId,
      conversationId
    );

  return conversation.messages.map(
    serializeMessage
  );
}

/*
============================================================
DELETE CONVERSATION
============================================================
*/

async function deleteConversation(
  userId,
  conversationId
) {
  const normalizedUserId =
    requireUserId(userId);

  if (
    !isValidConversationId(
      conversationId
    )
  ) {
    throw new ConversationNotFoundError();
  }

  const result =
    await Conversation.deleteOne({
      _id: conversationId,
      userId: normalizedUserId
    });

  return (
    result.deletedCount === 1
  );
}

/*
============================================================
CLEAR ALL CONVERSATIONS
============================================================
*/

async function clearAllConversations(
  userId
) {
  const normalizedUserId =
    requireUserId(userId);

  const result =
    await Conversation.deleteMany({
      userId: normalizedUserId
    });

  return {
    deletedCount:
      result.deletedCount || 0
  };
}

/*
============================================================
CONVERSATION COUNT
============================================================
*/

async function getConversationCount(
  userId
) {
  const normalizedUserId =
    requireUserId(userId);

  return Conversation.countDocuments({
    userId: normalizedUserId
  });
}

/*
============================================================
EXPORTS
============================================================
*/

module.exports = {
  ConversationNotFoundError,

  createConversation,
  getConversation,
  getOrCreateConversation,
  listConversations,

  addMessage,
  addUserMessage,
  addGeminiMessage,
  addGravityMessage,

  addFileMessage,
  addFileAnalysisMessage,

  getRecentMessages,

  buildGeminiContext,
  buildGeminiPrompt,

  getConversationHistory,

  deleteConversation,
  clearAllConversations,
  getConversationCount
};