const snmp = require("net-snmp");
const { getTonerLevelFromWeb } = require("./webReader");

const oids = {
  device_status: "1.3.6.1.2.1.25.3.5.1.2.1",
  page_counter: "1.3.6.1.2.1.43.10.2.1.4.1.1",
  printer_type: "1.3.6.1.2.1.25.3.2.1.3.1",
  drum_unit_life: "1.3.6.1.2.1.43.11.1.1.9.1.2",
  toner_level: "1.3.6.1.2.1.43.11.1.1.9.1.1",
  serial_number: "1.3.6.1.2.1.43.5.1.1.17.1",
};

function getValueSafe(varbind) {
  return varbind && varbind.value !== undefined
    ? varbind.value.toString()
    : "-";
}

function getNumberSafe(varbind) {
  if (!varbind || varbind.value === undefined) return "-";
  const num = parseInt(varbind.value);
  return isNaN(num) ? "-" : num;
}

const getPrinterData = (ip) => {
  return new Promise((resolve) => {
    const session = snmp.createSession(ip, "public", { timeout: 2000 });

    session.get(Object.values(oids), async (error, varbinds) => {
      if (error) {
        return resolve({
          online: false,
          device_status: "Offline",
          page_counter: "-",
          printer_type: "-",
          drum_unit: "-",
          toner_level: "-",
          serial_number: "-",
        });
      }

      let tonerLevel = getNumberSafe(varbinds[4]);

      // Nếu SNMP báo -3 hoặc không hợp lệ => fallback sang web scraping
      if (tonerLevel === "-" || tonerLevel < 0) {
        const webPercent = await getTonerLevelFromWeb(ip);
        tonerLevel = webPercent !== null ? `${webPercent}%` : "-";
      }

      const data = {
        online: true,
        device_status: getValueSafe(varbinds[0]),
        page_counter: getNumberSafe(varbinds[1]),
        printer_type: getValueSafe(varbinds[2]),
        drum_unit: getNumberSafe(varbinds[3]),
        toner_level: tonerLevel,
        serial_number: getValueSafe(varbinds[5]) || "-",
      };

      session.close();
      resolve(data);
    });
  });
};

module.exports = { getPrinterData };
