(() => {
  // -----------------------
  // CONFIG (edit these)
  // -----------------------
  const CONFIG = {
    // Weather: coordinates (Berlin defaults). Change to your city.
    lat: 52.5200,
    lon: 13.4050,

    // Calendar: public ICS URL (optional).
    // Leave empty "" to disable calendar events.
    icsUrl: "",

    // Ambient text file (optional). One line per sentence.
    // Put "sentences.txt" next to these files, or leave as-is to use built-in.
    sentencesUrl: "./sentences.txt",

    // Refresh cadence (ms)
    refreshEveryMs: 15 * 60 * 1000, // 15 min
  };

  // -----------------------
  // Elements
  // -----------------------
  const $ = (id) => document.getElementById(id);

  const elTime = $("time");
  const elDate = $("date");

  const elWeekSub = $("week-sub");
  const elWeekStrip = $("week-strip");

  const elAmbient = $("ambient-line");
  const elStatus = $("status");
  const elHint = $("hint");

  // -----------------------
  // Utilities
  // -----------------------
  const pad2 = (n) => String(n).padStart(2, "0");

  function setStatus(msg, ok = true) {
    elStatus.textContent = msg;
    elStatus.style.opacity = ok ? "0.85" : "0.98";
  }

  function fmtDateLine(d) {
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function fmtTimeLine(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c]));
  }

  function dayKeyLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  function fmtTimeShort(d) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  // -----------------------
  // Clock
  // -----------------------
  function tickClock() {
    const now = new Date();
    elTime.textContent = fmtTimeLine(now);
    elDate.textContent = fmtDateLine(now);
  }
  tickClock();
  setInterval(tickClock, 1000);

  // -----------------------
  // Ambient sentences
  // -----------------------
  const builtIn = [
    "signal holds. noise blooms.",
    "time is a thin film.",
    "low power / high clarity.",
    "what you measure moves.",
    "keep it simple. keep it sharp.",
    "the wall is a screen.",
    "red means alive.",
  ];

  let sentences = [...builtIn];
  let sIdx = 0;

  async function loadSentences() {
    if (!CONFIG.sentencesUrl) return;
    try {
      const resp = await fetch(CONFIG.sentencesUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error("sentences fetch failed");
      const text = await resp.text();
      const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
      if (lines.length) sentences = lines;
      setStatus("sentences ok");
    } catch {
      setStatus("sentences default");
    }
  }

  function nextSentence() {
    if (!sentences.length) return;
    sIdx = (sIdx + 1) % sentences.length;
    elAmbient.textContent = sentences[sIdx];
  }

  loadSentences().then(() => {
    elAmbient.textContent = sentences[0] ?? "…";
    setInterval(() => { nextSentence(); }, 6500);
  });

  // -----------------------
  // Weather (Open-Meteo, no key)
  // -----------------------
  function wmoToLabel(code) {
    // Slightly short, readable labels
    const map = new Map([
      [0, "Clear"],
      [1, "Mostly clear"],
      [2, "Partly cloudy"],
      [3, "Overcast"],
      [45, "Fog"], [48, "Fog"],
      [51, "Drizzle"], [53, "Drizzle"], [55, "Drizzle"],
      [61, "Rain"], [63, "Rain"], [65, "Heavy rain"],
      [71, "Snow"], [73, "Snow"], [75, "Heavy snow"],
      [80, "Showers"], [81, "Showers"], [82, "Hard showers"],
      [95, "Thunder"], [96, "Thunder"], [99, "Thunder"],
    ]);
    return map.get(code) || `Code ${code}`;
  }

  function wmoToPip(code) {
    if (code === 0) return 0.30;
    if (code <= 3) return 0.40;
    if (code === 45 || code === 48) return 0.34;
    if (code >= 51 && code <= 55) return 0.52;
    if (code >= 61 && code <= 65) return 0.68;
    if (code >= 71 && code <= 75) return 0.62;
    if (code >= 80 && code <= 82) return 0.72;
    if (code >= 95) return 0.82;
    return 0.45;
  }

  async function loadWeatherDaily7() {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(CONFIG.lat)}` +
      `&longitude=${encodeURIComponent(CONFIG.lon)}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=7` +
      `&timezone=auto`;

    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error("weather fetch failed");
    const data = await resp.json();

    const days = data?.daily?.time ?? [];
    const tmax = data?.daily?.temperature_2m_max ?? [];
    const tmin = data?.daily?.temperature_2m_min ?? [];
    const wcode = data?.daily?.weathercode ?? [];

    return { days, tmax, tmin, wcode };
  }

  // -----------------------
  // Calendar (public ICS URL)
  // -----------------------
  function parseICS(icsText) {
    // Minimal VEVENT parser: DTSTART, DTEND, SUMMARY, LOCATION
    // Handles folded lines (RFC 5545)
    const lines = icsText
      .replace(/\r\n/g, "\n")
      .replace(/\n[ \t]/g, "") // unfold
      .split("\n");

    const events = [];
    let cur = null;

    for (const line of lines) {
      if (line === "BEGIN:VEVENT") { cur = {}; continue; }
      if (line === "END:VEVENT") {
        if (cur && (cur.DTSTART || cur.SUMMARY)) events.push(cur);
        cur = null;
        continue;
      }
      if (!cur) continue;

      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const left = line.slice(0, idx);
      const value = line.slice(idx + 1);

      const key = left.split(";")[0].trim();

      if (key === "DTSTART" || key === "DTEND" || key === "SUMMARY" || key === "LOCATION") {
        cur[key] = value.trim();
      }
    }

    const out = events.map(ev => ({
      start: icsDateToJS(ev.DTSTART),
      end: ev.DTEND ? icsDateToJS(ev.DTEND) : null,
      summary: ev.SUMMARY || "Untitled",
      location: ev.LOCATION || "",
    })).filter(e => e.start && !isNaN(e.start.getTime()));

    out.sort((a, b) => a.start - b.start);
    return out;
  }

  function icsDateToJS(s) {
    // Supports:
    // - YYYYMMDD
    // - YYYYMMDDTHHMMSSZ
    // - YYYYMMDDTHHMMSS
    if (!s) return null;
    const isDateOnly = /^\d{8}$/.test(s);
    if (isDateOnly) {
      const y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
      return new Date(y, m, d, 9, 0, 0);
    }
    const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2] - 1, d = +m[3], hh = +m[4], mm = +m[5], ss = +m[6];
    if (m[7] === "Z") return new Date(Date.UTC(y, mo, d, hh, mm, ss));
    return new Date(y, mo, d, hh, mm, ss);
  }

  function groupEventsByDay(events) {
    const map = new Map();
    for (const ev of events) {
      const k = dayKeyLocal(ev.start);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.start - b.start);
    }
    return map;
  }

  async function loadCalendarGrouped() {
    if (!CONFIG.icsUrl) return new Map();

    try {
      const resp = await fetch(CONFIG.icsUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error("ics fetch failed");
      const text = await resp.text();
      const all = parseICS(text);
      return groupEventsByDay(all);
    } catch {
      return new Map();
    }
  }

  // -----------------------
  // Render: 7-day strip
  // -----------------------
  function renderWeekStrip(weather, eventsByDay) {
    const { days, tmax, tmin, wcode } = weather;

    elWeekStrip.innerHTML = "";

    if (!days.length) {
      elWeekSub.textContent = "no weather data";
      return;
    }

    elWeekSub.textContent =
      `updated ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` +
      (CONFIG.icsUrl ? "" : " • (no calendar)");


    for (let i = 0; i < 7; i++) {
      const d = new Date(days[i] + "T12:00:00");
      const k = dayKeyLocal(d);

      const label = wmoToLabel(wcode[i]);
      const p = wmoToPip(wcode[i]);

      const evs = eventsByDay.get(k) || [];

      const evHtml = evs.length
        ? `<div class="evlist">` + evs.slice(0, 7).map(ev => `
            <div class="ev">
              <span class="evtime">${fmtTimeShort(ev.start)}</span>${escapeHtml(ev.summary)}
            </div>
          `).join("") + `</div>`
        : `<div class="noev">no events</div>`;

      const col = document.createElement("div");
      col.className = "daycol";
      col.innerHTML = `
        <div class="daytop">
          <div class="dayname">${d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</div>
          <div class="daydate">${d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })}</div>

          <div class="wx">
            <span class="pip" style="opacity:${Math.max(0.30, Math.min(0.92, p))}"></span>
            <span>${escapeHtml(label)}</span>
          </div>

          <div class="temps">${Math.round(tmax[i])}° / ${Math.round(tmin[i])}°</div>
        </div>

        ${evHtml}
      `;
      elWeekStrip.appendChild(col);
    }
  }

  // -----------------------
  // Background dust (cheap)
  // -----------------------
  const canvas = document.getElementById("dust");
  const ctx = canvas.getContext("2d", { alpha: true });

  let W = 0, H = 0;
  const dots = [];
  const N = 110; // keep light for Pi

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    dots.length = 0;
    for (let i = 0; i < N; i++) {
      dots.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 2.2,
        vx: (-0.22 + Math.random() * 0.44),
        vy: (-0.16 + Math.random() * 0.32),
        a: 0.10 + Math.random() * 0.26
      });
    }
  }
  window.addEventListener("resize", resize);
  resize();

  function drawDust() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    for (const p of dots) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,59,59,${p.a})`;
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(drawDust);
  }
  requestAnimationFrame(drawDust);

  // -----------------------
  // Full refresh (weather + calendar)
  // -----------------------
  async function refreshAll() {
    try {
      elWeekSub.textContent = "updating…";
      const [weather, eventsByDay] = await Promise.all([
        loadWeatherDaily7(),
        loadCalendarGrouped(),
      ]);
      renderWeekStrip(weather, eventsByDay);
      setStatus("ok");
    } catch {
      elWeekSub.textContent = "update failed";
      setStatus("failed", false);
    }
  }

  // -----------------------
  // Keyboard controls
  // -----------------------
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  window.addEventListener("keydown", (e) => {
    const k = (e.key || "").toUpperCase();
    if (k === "R") { refreshAll(); setStatus("refresh"); }
    if (k === "F") { toggleFullscreen(); elHint.textContent = "fullscreen toggled"; }
  });

  // -----------------------
  // Start loops
  // -----------------------
  refreshAll();
  setInterval(refreshAll, CONFIG.refreshEveryMs);
})();
