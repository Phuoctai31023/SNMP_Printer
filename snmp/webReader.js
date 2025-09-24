const axios = require("axios");
const cheerio = require("cheerio");

async function getTonerLevelFromWeb(ip) {
  try {
    const url = `http://${ip}/general/status.html`;
    const res = await axios.get(url, { timeout: 3000 });
    const $ = cheerio.load(res.data);

    const img = $("img.tonerremain");
    const height = parseInt(img.attr("height") || "0");

    const maxHeight = 60;
    const percent = Math.round((height / maxHeight) * 100);

    return percent;
  } catch (err) {
    console.error(`Web scrape failed for ${ip}:`, err.message);
    return null;
  }
}

async function getConditionFromWeb(ip) {
  try {
    const url = `http://${ip}/general/status.html`;
    const res = await axios.get(url, { timeout: 3000 });
    const $ = cheerio.load(res.data);

    const container = $("#moni_data");
    if (!container || container.length === 0) return null;

    const span = container.find("span").first();
    const rawText =
      (span && span.text() ? span.text().trim() : container.text().trim()) ||
      null;

    const cls =
      span && span.attr("class")
        ? span.attr("class")
        : container.attr("class") || "";
    const style = (span && span.attr("style")) || container.attr("style") || "";

    let severity = "unknown";
    if (/moniOk/i.test(cls) || /ok/i.test(cls)) severity = "ok";
    else if (/warn|warning|moniWarn|moniWarning/i.test(cls))
      severity = "warning";
    else if (/err|error|ng|moniNg|moniErr/i.test(cls)) severity = "error";
    const bgMatch = (style.match(/background(?:-color)?:\s*([^;]+)/i) || [])[1];
    const bgColor = bgMatch ? bgMatch.trim() : null;

    if (severity === "unknown" && bgColor) {
      const lc = bgColor.toLowerCase();
      if (
        lc.includes("#ffc") ||
        lc.includes("yellow") ||
        lc.includes("ffbf") ||
        lc.includes("ffc107")
      )
        severity = "warning";
      if (
        lc.includes("#f00") ||
        lc.includes("red") ||
        lc.includes("#dc3545") ||
        lc.includes("#ff0000")
      )
        severity = "error";
      if (
        lc.includes("#dff") ||
        lc.includes("green") ||
        lc.includes("#ddffcc") ||
        lc.includes("#28a745")
      )
        severity = "ok";
    }

    return {
      text: rawText,
      severity,
      bgColor: bgColor || null,
    };
  } catch (err) {
    console.error(`Web scrape condition failed for ${ip}:`, err.message);
    return null;
  }
}

module.exports = { getTonerLevelFromWeb, getConditionFromWeb };
