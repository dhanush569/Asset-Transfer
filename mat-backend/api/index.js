// Vercel entry point. Express apps are (req, res) handlers, which is
// exactly the shape Vercel's Node runtime expects — so we export it
// directly with no adapter needed. vercel.json routes every request here.
const app = require('../src/app');

module.exports = app;
