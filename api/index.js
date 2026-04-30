/**
 * Vercel Serverless Function — wraps the Express app for serverless deployment.
 * Vercel routes all /api/* requests here.
 */

const app = require('../server/app.js');

module.exports = app;
