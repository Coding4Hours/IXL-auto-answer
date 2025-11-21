const {
  author,
  version,
  description,
} = require("../package.json");

module.exports = {
  name: "IXL Auto-Answer",
  namespace: "https://coding4hours.dev/",
  description: description,
  version: version,
  author: author,
  license: "MIT",
  match: ["https://*.ixl.com/*/*/*"],
  require: [
    "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js",
    "https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js"
  ],
  grant: ["GM.xmlHttpRequest"],
};
