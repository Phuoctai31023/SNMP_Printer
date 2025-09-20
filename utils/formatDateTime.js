function formatDateTime(date) {
  if (!date) return "N/A";
  const d = new Date(date);
  if (isNaN(d)) return "N/A";

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${hh}:${mm} ${day}/${month}/${year}`;
}

module.exports = formatDateTime;
