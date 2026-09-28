const serverless = require("serverless-http");
const app = require("../../server.js");

// Export serverless handler for Netlify Functions
module.exports.handler = serverless(app);
