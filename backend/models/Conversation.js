const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true
    },

    type: {
      type: String,
      enum: ["text", "gemini", "gravity", "file", "file-analysis"],
      default: "text"
    },

    source: {
      type: String,
      default: null
    },

    content: {
      type: String,
      default: ""
    },

    file: {
      originalName: String,
      mimeType: String,
      size: Number,
      analysisType: String
    }
  },
  {
    timestamps: true
  }
);

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    title: {
      type: String,
      default: "New Chat",
      trim: true
    },

    messages: {
      type: [messageSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

conversationSchema.index({
  userId: 1,
  updatedAt: -1
});

module.exports = mongoose.model(
  "Conversation",
  conversationSchema
);