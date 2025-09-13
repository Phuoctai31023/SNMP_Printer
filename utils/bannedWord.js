// utils/bannedWord.js
const leoProfanity = require("leo-profanity");

// Load dictionary tiếng Anh cơ bản
leoProfanity.loadDictionary();

// =============================
// 1. Danh sách từ gốc
// =============================
const baseBadWords = [
  "lon",
  "cailon",
  "dit",
  "ditme",
  "ditconme",
  "dm",
  "dmm",
  "dcm",
  "cmm",
  "cl",
  "clm",
  "clmm",
  "ngu",
  "ngoc",
  "ditcho",
  "cho",
  "chocho",
  "occho",
  "ditchocho",
  "cac",
  "concac",
  "buoi",
  "clgt",
  "cldm",
  "cc",
  "vcl",
  "vl",
  "sml",
  "vc",
  "vcc",
  "dmcs",
  "ditbo",
  "dime",
  "dilol",
  "diz",
  "chim",
  "buom",
  "chym",
  "bopvu",
  "vu",
  "ditlon",
  "xoac",
  "xoaylon",
  "londe",
  "loncho",
  "loncon",
  "dithang",
  "me",
  "bo",
  "mecho",
  "bodit",
  "ditnguoi",
  "chome",
  "choditme",
  "fuck",
  "fck",
  "shit",
  "shjt",
  "bitch",
  "btch",
  "asshole",
  "dildo",
  "porn",
  "xxx",
  "matlon",
  "matdit",
  "dmml",
  "dmvl",
  "vlon",
  "vloncho",
  "vloncon",
  "ditmat",
  "cacbuoi",
  "cu",
  "cailonbuoi",
  "ditngu",
  "ditmeoconcho",
];

// =============================
// 2. Bảng leetspeak
// =============================
const leetMap = {
  a: ["4", "@"],
  i: ["1", "!", "l"],
  o: ["0"],
  e: ["3"],
  s: ["5", "$"],
  g: ["9"],
  t: ["7", "+"],
  u: ["v", "ü"],
  c: ["k"],
};

// Sinh các biến thể leet
function generateLeetVariants(word) {
  const variants = new Set([word]);
  const chars = word.split("");

  function backtrack(idx, current) {
    if (idx === chars.length) {
      variants.add(current.join(""));
      return;
    }
    const ch = chars[idx];
    backtrack(idx + 1, [...current, ch]);
    if (leetMap[ch]) {
      leetMap[ch].forEach((sub) => backtrack(idx + 1, [...current, sub]));
    }
  }

  backtrack(0, []);
  return [...variants];
}

// =============================
// 3. Trie cho hiệu năng
// =============================
class TrieNode {
  constructor() {
    this.children = {};
    this.isEnd = false;
  }
}

class BadWordTrie {
  constructor() {
    this.root = new TrieNode();
  }

  add(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) node.children[ch] = new TrieNode();
      node = node.children[ch];
    }
    node.isEnd = true;
  }

  hasBadWord(text) {
    const lower = text.toLowerCase();
    const n = lower.length;

    for (let i = 0; i < n; i++) {
      let node = this.root;
      let j = i;
      while (j < n) {
        const ch = lower[j];
        if (!/[a-z0-9]/.test(ch)) {
          // bỏ qua ký tự đặc biệt
          j++;
          continue;
        }
        if (!node.children[ch]) break;
        node = node.children[ch];
        if (node.isEnd) return true;
        j++;
      }
    }
    return false;
  }
}

// =============================
// 4. Regex để chặn chèn ký tự đặc biệt
// =============================
function createRegexFromWord(word) {
  const escaped = word
    .split("")
    .map((c) => c.replace(/([.*+?^=!:${}()|[\]\/\\])/g, "\\$1"))
    .join("[^a-zA-Z0-9]*"); // cho phép chèn ký tự đặc biệt
  return new RegExp(escaped, "gi");
}

let regexList = [];
baseBadWords.forEach((w) => {
  const variants = generateLeetVariants(w);
  variants.forEach((v) => regexList.push(createRegexFromWord(v)));
});

// =============================
// 5. Khởi tạo Trie
// =============================
const trie = new BadWordTrie();
baseBadWords.forEach((w) => {
  const variants = generateLeetVariants(w);
  variants.forEach((v) => trie.add(v));
});

// Add vào leo-profanity để check nhanh
leoProfanity.add(baseBadWords);

// =============================
// 6. Export API
// =============================
module.exports = {
  hasBadWord(text) {
    // Check 3 tầng: leoProfanity + Trie + Regex
    return (
      leoProfanity.check(text) ||
      trie.hasBadWord(text) ||
      regexList.some((rgx) => rgx.test(text))
    );
  },

  clean(text) {
    let result = leoProfanity.clean(text);

    // Clean regex
    regexList.forEach((rgx) => {
      result = result.replace(rgx, (m) => "*".repeat(m.length));
    });

    return result;
  },

  getBadWords() {
    return baseBadWords;
  },
};
