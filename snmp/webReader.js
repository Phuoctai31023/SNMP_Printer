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
    const condition = $("#moni_data").text().trim();

    return condition || null;
  } catch (err) {
    console.error(`Web scrape condition failed for ${ip}:`, err.message);
    return null;
  }
}

module.exports = { getTonerLevelFromWeb, getConditionFromWeb };
