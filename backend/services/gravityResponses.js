// ======================================
// GRAVITY - OWN RESPONSES
// ======================================

const GRAVITY_RESPONSES = {

  // ----------------------------------
  // IDENTITY
  // ----------------------------------

  whoAreYou:
    "I'm Gravity, an AI-powered web assistant designed to help you find information and get useful answers through a conversational experience.",

  aboutYou:
    "I'm Gravity. I provide a simple conversational interface that connects you with an intelligent AI system for answering questions and exploring information.",

  aboutUs:
    "Gravity is an AI-powered web assistant project built to give users a simple and conversational way to ask questions and receive intelligent answers.",


  // ----------------------------------
  // CAPABILITIES
  // ----------------------------------

  whatCanYouDo:
    "I can answer your questions, help you explore different topics, and connect you with my intelligent web-based AI system to provide useful responses.",


  // ----------------------------------
  // CREATOR / DEVELOPMENT
  // ----------------------------------

  whoCreatedYou:
    "I'm Gravity, an AI-powered web assistant project. My system was designed and developed as a conversational platform that connects users with intelligent web-based AI responses.",


  // ----------------------------------
  // PURPOSE
  // ----------------------------------

  purpose:
    "My purpose is to make getting information easier by giving you a simple conversational interface connected to an intelligent AI system.",


  // ----------------------------------
  // THANK YOU
  // ----------------------------------

  thanks:
    "You're welcome! I'm here whenever you need help.",


  // ----------------------------------
  // GREETINGS
  // ----------------------------------

  greeting:
    "Hello! I'm Gravity. How can I help you today?"
};


// ======================================
// PERSONAL / GRAVITY QUESTION PATTERNS
// ======================================

const PERSONAL_PATTERNS = [

  // ----------------------------------
  // WHO ARE YOU
  // ----------------------------------

  {
    type: "whoAreYou",

    patterns: [
      "who are you",
      "what are you",
      "tell me about yourself",
      "introduce yourself",
      "who is gravity",
      "who is gravity assistant",
      "what is gravity ai",
      "what is gravity assistant"
    ]
  },


  // ----------------------------------
  // ABOUT GRAVITY / ABOUT US
  // ----------------------------------

  {
    type: "aboutYou",

    patterns: [
      "about you",
      "about yourself",
      "tell me about gravity",
      "tell me more about gravity",
      "tell me about gravity assistant"
    ]
  },

  {
    type: "aboutUs",

    patterns: [
      "about us",
      "about gravity",
      "tell me about us",
      "tell me about our project",
      "what is our project",
      "tell me about the project"
    ]
  },


  // ----------------------------------
  // CAPABILITIES
  // ----------------------------------

  {
    type: "whatCanYouDo",

    patterns: [
      "what can you do",
      "what do you do",
      "what are your capabilities",
      "what are your features",
      "what can gravity do",
      "what can gravity assistant do",
      "how can you help me"
    ]
  },


  // ----------------------------------
  // CREATOR
  // ----------------------------------

  {
    type: "whoCreatedYou",

    patterns: [
      "who created you",
      "who developed you",
      "who made you",
      "who built you",
      "who is your developer",
      "who created gravity",
      "who developed gravity",
      "who made gravity",
      "who built gravity"
    ]
  },


  // ----------------------------------
  // PURPOSE
  // ----------------------------------

  {
    type: "purpose",

    patterns: [
      "what is your purpose",
      "why were you created",
      "why do you exist",
      "what is your main purpose",
      "why was gravity created",
      "what is the purpose of gravity"
    ]
  },


  // ----------------------------------
  // THANKS
  // ----------------------------------

  {
    type: "thanks",

    patterns: [
      "thank you",
      "thanks",
      "thank you bro",
      "thanks bro",
      "ok thanks",
      "okay thanks",
      "ok thank you",
      "okay thank you"
    ]
  },


  // ----------------------------------
  // GREETING
  // ----------------------------------

  {
    type: "greeting",

    patterns: [
      "hi",
      "hello",
      "hey",
      "hi gravity",
      "hello gravity",
      "hey gravity"
    ]
  }
];


// ======================================
// GET RESPONSE
// ======================================

function getGravityResponse(type) {

  return GRAVITY_RESPONSES[type] || null;

}


// ======================================
// EXPORT
// ======================================

module.exports = {
  PERSONAL_PATTERNS,
  getGravityResponse
};