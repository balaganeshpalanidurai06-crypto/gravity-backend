const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ============================================================
// CREATE JWT
// ============================================================

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is missing in .env"
    );
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}

// ============================================================
// CREATE / FIND USER
// ============================================================

async function findOrCreateUser({
  googleId = null,
  email,
  name,
  profileImage = null
}) {
  if (!email) {
    throw new Error(
      "User email is required."
    );
  }

  const normalizedEmail =
    email.trim().toLowerCase();

  // ----------------------------------------------------------
  // Try Google ID first
  // ----------------------------------------------------------

  let user = null;

  if (googleId) {
    user = await User.findOne({
      googleId
    });
  }

  // ----------------------------------------------------------
  // If Google ID not found, try email
  // ----------------------------------------------------------

  if (!user) {
    user = await User.findOne({
      email: normalizedEmail
    });
  }

  // ----------------------------------------------------------
  // Existing user
  // ----------------------------------------------------------

  if (user) {
    let changed = false;

    if (
      googleId &&
      user.googleId !== googleId
    ) {
      user.googleId = googleId;
      changed = true;
    }

    if (
      name &&
      user.name !== name.trim()
    ) {
      user.name = name.trim();
      changed = true;
    }

    if (
      profileImage &&
      user.profileImage !== profileImage
    ) {
      user.profileImage =
        profileImage;
      changed = true;
    }

    if (changed) {
      await user.save();
    }

    return user;
  }

  // ----------------------------------------------------------
  // New user
  // ----------------------------------------------------------

  user = await User.create({
    googleId,
    email: normalizedEmail,
    name:
      name?.trim() ||
      normalizedEmail.split("@")[0],
    profileImage
  });

  return user;
}

// ============================================================
// GET USER BY ID
// ============================================================

async function getUserById(userId) {
  if (!userId) {
    return null;
  }

  return User.findById(userId);
}

// ============================================================
// CREATE AUTH RESPONSE
// ============================================================

function createAuthResponse(user) {
  const token = createToken(user);

  return {
    token,

    user: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      profileImage:
        user.profileImage || null
    }
  };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createToken,
  findOrCreateUser,
  getUserById,
  createAuthResponse
};