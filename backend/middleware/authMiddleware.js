const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

async function authMiddleware(req, res, next) {
  try {
    // ----------------------------------------------------------
    // GET AUTHORIZATION HEADER
    // ----------------------------------------------------------

    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Authentication required."
      });
    }

    // Expected:
    // Authorization: Bearer <token>

    const parts =
      authHeader.split(" ");

    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer" ||
      !parts[1]
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid authorization format."
      });
    }

    const token = parts[1];

    // ----------------------------------------------------------
    // CHECK JWT SECRET
    // ----------------------------------------------------------

    if (!process.env.JWT_SECRET) {
      console.error(
        "❌ JWT_SECRET is missing in .env"
      );

      return res.status(500).json({
        success: false,
        error: "Server authentication configuration error."
      });
    }

    // ----------------------------------------------------------
    // VERIFY TOKEN
    // ----------------------------------------------------------

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token."
      });
    }

    // ----------------------------------------------------------
    // CHECK USER ID
    // ----------------------------------------------------------

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        error: "Invalid authentication token."
      });
    }

    // ----------------------------------------------------------
    // FIND USER
    // ----------------------------------------------------------

    const user =
      await User.findById(
        decoded.userId
      );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User account not found."
      });
    }

    // ----------------------------------------------------------
    // ATTACH USER TO REQUEST
    // ----------------------------------------------------------

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      profileImage:
        user.profileImage || null
    };

    // ----------------------------------------------------------
    // CONTINUE
    // ----------------------------------------------------------

    next();

  } catch (error) {
    console.error(
      "❌ Authentication middleware error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      error: "Authentication failed."
    });
  }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = authMiddleware;