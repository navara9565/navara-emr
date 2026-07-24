const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function fmtDate(d) {
  return d.getDate() + " " + THAI_MONTHS[d.getMonth()] + " " + (d.getFullYear() + 543);
}

// Wall-clock date/time in Asia/Bangkok (UTC+7), independent of the server's
// own timezone — Render runs in UTC, so stamping with local time would put
// early-morning Thai records on the previous day. Use this on the server.
export function bangkokStamp(d = new Date()) {
  const b = new Date(d.getTime() + 7 * 3600 * 1000); // shift to UTC+7
  const pad = (n) => String(n).padStart(2, "0");
  return {
    iso: d.toISOString(), // keep the true instant for ordering
    date: b.getUTCDate() + " " + THAI_MONTHS[b.getUTCMonth()] + " " + (b.getUTCFullYear() + 543),
    time: pad(b.getUTCHours()) + ":" + pad(b.getUTCMinutes()),
  };
}

// True ISO date (YYYY-MM-DD) in Bangkok time — for grouping historical rows.
export function bangkokISODate(d = new Date()) {
  const b = new Date(d.getTime() + 7 * 3600 * 1000);
  return b.toISOString().slice(0, 10);
}

export function isAbnormal(temp, sys, hr, spo2) {
  return parseFloat(temp) >= 37.6 || sys >= 150 || sys < 95 || hr >= 105 || hr < 55 || spo2 < 94;
}

export function sparkline(values, w, h, pad) {
  w = w || 280; h = h || 100; pad = pad || 14;
  const min = Math.min.apply(null, values);
  const max = Math.max.apply(null, values);
  const range = (max - min) || 1;
  const stepX = values.length > 1 ? (w - 2 * pad) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / range) * (h - 2 * pad);
    return { x, y };
  });
  const points = pts.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return { points, lastX: last.x.toFixed(1), lastY: last.y.toFixed(1) };
}

// Real current date — records are stamped with actual time in production.
export const TODAY = new Date();

// "2026-07" → "ก.ค. 2569" (for monthly summary labels)
export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return THAI_MONTHS[m - 1] + " " + (y + 543);
}

// ISO "2026-07-15" → "15 ก.ค. 2569"
export function thaiDate(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return d + " " + THAI_MONTHS[m - 1] + " " + (y + 543);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
