function minutesFromNow(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function calculateNextSync(statusText = "") {
  const status = String(statusText || "").toLowerCase().trim();

  if (
    status.includes("levererad") ||
    status.includes("delivered") ||
    status.includes("utlämnad")
  ) {
    return null;
  }

  if (
    status.includes("utkörning") ||
    status.includes("out for delivery")
  ) {
    return minutesFromNow(10);
  }

  if (
    status.includes("transport") ||
    status.includes("in transit")
  ) {
    return minutesFromNow(30);
  }

  if (
    status.includes("registrerad") ||
    status.includes("inväntar försändelse") ||
    status.includes("registered")
  ) {
    return minutesFromNow(60);
  }

  return minutesFromNow(30);
}

module.exports = {
  calculateNextSync
};
