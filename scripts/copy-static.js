const fs = require("fs");
const path = require("path");

const pairs = [
  ["src/renderer/index.html", "dist/renderer/index.html"],
  ["src/renderer/style.css", "dist/renderer/style.css"],
  ["src/renderer/picker.html", "dist/renderer/picker.html"],
  ["src/renderer/picker.js", "dist/renderer/picker.js"],
  ["src/renderer/ui.js", "dist/renderer/ui.js"],
];

for (const [from, to] of pairs) {
  const src = path.join(__dirname, "..", from);
  const dest = path.join(__dirname, "..", to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
fs.cpSync(path.join(__dirname, "../assets/pets"), path.join(__dirname, "../dist/assets/pets"), { recursive: true });
