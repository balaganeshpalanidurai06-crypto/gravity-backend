const express = require("express");
const { OAuth2Client } = require("google-auth-library");

const {
  findOrCreateUser,
  createAuthResponse
} = require("../services/authService");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

/* =========================================================
   GOOGLE CLIENT
========================================================= */

function getGoogleClient() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID is missing in .env"
    );
  }

  return new OAuth2Client(clientId);
}

/* =========================================================
   GOOGLE CONFIG
   GET /api/auth/config
========================================================= */

router.get(
  "/config",
  (req, res) => {
    try {
      const googleClientId =
        process.env.GOOGLE_CLIENT_ID || null;

      const googleConfigured =
        Boolean(googleClientId);

      console.log(
        "🔐 Google Auth Config Requested"
      );

      console.log(
        `🔑 Google Client ID: ${
          googleClientId || "MISSING"
        }`
      );

      console.log(
        `✅ Google Configured: ${
          googleConfigured
        }`
      );

      return res.json({
        success: true,
        googleConfigured,
        googleClientId
      });

    } catch (error) {
      console.error(
        "❌ Auth config error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to load authentication configuration."
      });
    }
  }
);

/* =========================================================
   GOOGLE LOGIN
   POST /api/auth/google
========================================================= */

router.post(
  "/google",
  async (req, res) => {
    try {

      const {
        credential
      } = req.body || {};

      /* -----------------------------------------------------
         CHECK CREDENTIAL
      ----------------------------------------------------- */

      if (!credential) {
        return res.status(400).json({
          success: false,
          error:
            "Google credential is required."
        });
      }

      /* -----------------------------------------------------
         CHECK GOOGLE CLIENT ID
      ----------------------------------------------------- */

      const googleClientId =
        process.env.GOOGLE_CLIENT_ID;

      if (!googleClientId) {

        console.error(
          "❌ GOOGLE_CLIENT_ID is missing in .env"
        );

        return res.status(500).json({
          success: false,
          error:
            "Google authentication is not configured."
        });
      }

      /* -----------------------------------------------------
         VERIFY GOOGLE ID TOKEN
      ----------------------------------------------------- */

      const googleClient =
        getGoogleClient();

      const ticket =
        await googleClient.verifyIdToken({
          idToken: credential,
          audience: googleClientId
        });

      /* -----------------------------------------------------
         GOOGLE PAYLOAD
      ----------------------------------------------------- */

      const payload =
        ticket.getPayload();

      if (!payload) {
        return res.status(401).json({
          success: false,
          error:
            "Invalid Google authentication response."
        });
      }

      const {
        sub: googleId,
        email,
        email_verified: emailVerified,
        name,
        picture
      } = payload;

      /* -----------------------------------------------------
         CHECK EMAIL
      ----------------------------------------------------- */

      if (!email) {
        return res.status(401).json({
          success: false,
          error:
            "Google account email is missing."
        });
      }

      /* -----------------------------------------------------
         CHECK VERIFIED EMAIL
      ----------------------------------------------------- */

      if (!emailVerified) {
        return res.status(403).json({
          success: false,
          error:
            "Your Google email address is not verified."
        });
      }

      /* -----------------------------------------------------
         FIND OR CREATE USER
      ----------------------------------------------------- */

      const user =
        await findOrCreateUser({
          googleId,
          email,
          name,
          profileImage:
            picture || null
        });

      /* -----------------------------------------------------
         CREATE GRAVITY JWT
      ----------------------------------------------------- */

      const authResponse =
        createAuthResponse(user);

      /* -----------------------------------------------------
         SERVER LOG
      ----------------------------------------------------- */

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      console.log(
        "✅ GOOGLE USER AUTHENTICATED"
      );

      console.log(
        `👤 User: ${user.email}`
      );

      console.log(
        `🆔 User ID: ${user._id}`
      );

      console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );

      /* -----------------------------------------------------
         RESPONSE
      ----------------------------------------------------- */

      return res.json({
        success: true,

        token:
          authResponse.token,

        user:
          authResponse.user
      });

    } catch (error) {

      console.error(
        "❌ Google authentication error:",
        error.message
      );

      return res.status(401).json({
        success: false,
        error:
          "Google authentication failed."
      });
    }
  }
);

/* =========================================================
   CURRENT USER
   GET /api/auth/me
========================================================= */

router.get(
  "/me",
  authMiddleware,
  async (req, res) => {
    try {

      return res.json({
        success: true,

        user: {
          id:
            req.user.id,

          email:
            req.user.email,

          name:
            req.user.name,

          profileImage:
            req.user.profileImage || null
        }
      });

    } catch (error) {

      console.error(
        "❌ /api/auth/me error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to get current user."
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

module.exports = router;