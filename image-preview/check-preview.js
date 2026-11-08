/* Isolated smoke checks for the test-only heart card. Node built-ins only. */
"use strict";
var fs = require("fs"), assert = require("assert");
var html = fs.readFileSync(__dirname + "/index.html", "utf8");
var script = html.match(/<script>([\s\S]*?)<\/script>/);
assert(script, "Inline preview code missing");
new Function(script[1]); // syntax check; no browser API execution
[
  'id="before"', 'id="after" hidden', 'id="reveal"',
  'id="picture"', 'id="modal"', 'id="plus"', 'id="minus"',
  'id="scale"', 'id="heart"', 'id="zoom-image"',
  'T00574', 'sydän', 'сердце', 'cor',
  'Rintaontelossa hieman vasemmalla',
  'Мышечный орган в грудной клетке',
  'touchstart', 'touchmove', 'touchend',
  'Latina:', 'FI:', 'RU:'
].forEach(function(s){assert(html.indexOf(s) !== -1, "Missing " + s);});
assert(/reveal"\)\.addEventListener\("click"[\s\S]*?heart\.src=imageUrl/.test(script[1]), "Image should load only after answer");
assert(!/firebase|localStorage|sessionStorage|signInWith|google\.accounts/i.test(script[1]), "Preview must not touch users/auth/progress");
assert(/scale\(\+/.test(html) === false, "Unexpected code marker");
console.log("PASS: heart preview syntax, lazy load, medical notes, touch zoom and isolated storage");
