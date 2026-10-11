const mongoose = require("mongoose");

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is missing in .env"
    );
  }

  try {
    await mongoose.connect(mongoUri);

    console.log("✅ MongoDB connected.");
    console.log(
      `📦 Database: ${mongoose.connection.name}`
    );
  } catch (error) {
    console.error(
      "❌ MongoDB connection failed:"
    );

    console.error(error.message);

    throw error;
  }
}

module.exports = connectDatabase;