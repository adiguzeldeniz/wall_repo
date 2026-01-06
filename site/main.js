(() => {
  // -----------------------
  // CONFIG (edit these)
  // -----------------------
  const CONFIG = {
    // 1) Weather: coordinates (Berlin defaults). Change to your city.
    lat: 52.5200,
    lon: 13.4050,

    // 2) Calendar: public ICS URL (optional)
    // - Google Calendar: Settings -> "Secret address in iCal format" (or public calendar ICS)
    // - Apple Calendar: share public calendar -> ICS link
    // Leave empty "" to disable.
    icsUrl: "",

    // 3) Ambient text file (optional). One line per sentence.
    // Put "sentences.txt" next to index.html, or leave empty to use built-in.
    sentencesUrl: "./sentences.txt",

    // Refresh cadence (ms)
    weatherEveryMs: 30 * 60 * 1000,   // 30 min
    calendarEveryMs: 10 * 60 * 1000,  // 10 min
  };

  // -----------------------
  // Elements
  // -----------------------
  const $ = (id) => document.getElementById(id);
  const elTime = $("time");
  const elDate = $("date");
  const elWeatherSub = $("weather-sub");
  const elWeatherStrip = $("weather-strip");
  const elCalSub = $("cal-sub");
  const elEvents = $("events");
  const elAmbient = $("ambient-line");
  const elStatus = $("status");
  const elHint = $("hint");

  // -----------------------
  // Utilities
  // -----------------------
  const pad2 = (n) => String(n).padStart(2, "0");

  function setStatus(msg, ok=true) {
    elStatus.textContent = msg;
    elStatus.style.opacity = ok ? "0.85" : "0.95";
  }

  function fmtDayShort(d) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  function fmtDateLine(d) {
    // "Tuesday, 6 January 2026"
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function fmtTimeLine(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

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
      const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      if (lines.length) sentences = lines;
      setStatus("sentences ok");
    } catch {
      // silently keep built-in
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
    // super lightweight labels
    const map = new Map([
      [0, "Clear"],
      [1, "Mostly clear"],
      [2, "Partly cloudy"],
      [3, "Overcast"],
      [45, "Fog"], [48, "Fog"],
      [51, "Drizzle"], [53, "Drizzle"], [55, "Drizzle"],
      [61, "Rain"], [63, "Rain"], [65, "Heavy rain"],
      [71, "Snow"], [73, "Snow"], [75, "Heavy snow"],
      [80, "Showers"], [81, "Showers"], [82, "Violent showers"],
      [95, "Thunder"], [96, "Thunder"], [99, "Thunder"],
    ]);
    return map.get(code) || `Code ${code}`;
  }

  function wmoToPip(code) {
    // pick a “pip intensity” by condition
    if (code === 0) return 0.25;
    if (code <= 3) return 0.35;
    if (code === 45 || code === 48) return 0.30;
    if (code >= 51 && code <= 55) return 0.45;
    if (code >= 61 && code <= 65) return 0.60;
    if (code >= 71 && code <= 75) return 0.55;
    if (code >= 80 && code <= 82) return 0.65;
    if (code >= 95) return 0.75;
    return 0.40;
  }

  async function loadWeather() {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${encodeURIComponent(CONFIG.lat)}` +
      `&longitude=${encodeURIComponent(CONFIG.lon)}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=10` +
      `&timezone=auto`;

    try {
      elWeatherSub.textContent = "updating…";
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error("weather fetch failed");
      const data = await resp.json();

      const days = data?.daily?.time ?? [];
      const tmax = data?.daily?.temperature_2m_max ?? [];
      const tmin = data?.daily?.temperature_2m_min ?? [];
      const wcode = data?.daily?.weathercode ?? [];

      elWeatherStrip.innerHTML = "";

      if (!days.length) {
        elWeatherSub.textContent = "no data";
        return;
      }

      // Sub line: show today condition
      const todayLabel = wmoToLabel(wcode[0]);
      elWeatherSub.textContent = `${todayLabel} • ${Math.round(tmax[0])}° / ${Math.round(tmin[0])}°`;

      for (let i = 0; i < Math.min(10, days.length); i++) {
        const d = new Date(days[i] + "T12:00:00");
        const label = wmoToLabel(wcode[i]);
        const p = wmoToPip(wcode[i]);

        const card = document.createElement("div");
        card.className = "day";
        card.innerHTML = `
          <div class="d">${fmtDayShort(d)}</div>
          <div class="badge"><span class="pip" style="opacity:${clamp(p,0.18,0.9)}"></span>${label}</div>
          <div class="t">${Math.round(tmax[i])}° / ${Math.round(tmin[i])}°</div>
        `;
        elWeatherStrip.appendChild(card);
      }

      setStatus("weather ok");
    } catch (e) {
      elWeatherSub.textContent = "weather error";
      setStatus("weather failed", false);
    }
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

      // strip params: DTSTART;TZID=Europe/Berlin -> DTSTART
      const key = left.split(";")[0].trim();

      // Only keep what we use
      if (key === "DTSTART" || key === "DTEND" || key === "SUMMARY" || key === "LOCATION") {
        cur[key] = value.trim();
      }
    }

    // Convert DTSTART to Date
    const out = events.map(ev => ({
      start: icsDateToJS(ev.DTSTART),
      end: ev.DTEND ? icsDateToJS(ev.DTEND) : null,
      summary: ev.SUMMARY || "Untitled",
      location: ev.LOCATION || "",
    })).filter(e => e.start && !isNaN(e.start.getTime()));

    out.sort((a,b) => a.start - b.start);
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
      const y = +s.slice(0,4), m = +s.slice(4,6)-1, d = +s.slice(6,8);
      return new Date(y, m, d, 9, 0, 0);
    }
    const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2]-1, d = +m[3], hh = +m[4], mm = +m[5], ss = +m[6];
    if (m[7] === "Z") return new Date(Date.UTC(y, mo, d, hh, mm, ss));
    return new Date(y, mo, d, hh, mm, ss);
  }

  function fmtWhen(d) {
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const day = sameDay ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "2-digit" });
    const t = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${day} ${t}`;
  }

  async function loadCalendar() {
    if (!CONFIG.icsUrl) {
      elCalSub.textContent = "no calendar url (set icsUrl)";
      elEvents.innerHTML = `<div class="empty">Add a public ICS link in <b>main.js</b> (icsUrl) to show events here.</div>`;
      setStatus("calendar off");
      return;
    }

    try {
      elCalSub.textContent = "updating…";
      const resp = await fetch(CONFIG.icsUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error("ics fetch failed");
      const text = await resp.text();

      const all = parseICS(text);
      const now = new Date();
      const upcoming = all.filter(e => e.start >= new Date(now.getTime() - 30*60*1000)).slice(0, 10);

      elEvents.innerHTML = "";

      if (!upcoming.length) {
        elCalSub.textContent = "no upcoming events";
        elEvents.innerHTML = `<div class="empty">No upcoming events found.</div>`;
        setStatus("calendar ok");
        return;
      }

      elCalSub.textContent = `${upcoming.length} upcoming`;

      for (const ev of upcoming) {
        const row = document.createElement("div");
        row.className = "event";
        row.innerHTML = `
          <div class="when">${fmtWhen(ev.start)}</div>
          <div>
            <div class="what">${escapeHtml(ev.summary)}</div>
            ${ev.location ? `<div class="where">${escapeHtml(ev.location)}</div>` : ``}
          </div>
        `;
        elEvents.appendChild(row);
      }

      setStatus("calendar ok");
    } catch {
      elCalSub.textContent = "calendar error";
      elEvents.innerHTML = `<div class="empty">Failed to load calendar. Check ICS link.</div>`;
      setStatus("calendar failed", false);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[c]));
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
        vx: (-0.25 + Math.random() * 0.5),
        vy: (-0.18 + Math.random() * 0.36),
        a: 0.08 + Math.random() * 0.25
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
      ctx.fillStyle = `rgba(255,42,42,${p.a})`;
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(drawDust);
  }
  requestAnimationFrame(drawDust);

  // -----------------------
  // Keyboard controls
  // -----------------------
  const cards = {
    W: document.querySelector(".card.weather"),
    C: document.querySelector(".card.calendar"),
    A: document.querySelector(".card.ambient"),
  };

  function focusCard(key) {
    for (const k of Object.keys(cards)) {
      const el = cards[k];
      el.style.transform = (k === key) ? "translateY(-2px)" : "translateY(0px)";
      el.style.boxShadow = (k === key)
        ? "0 18px 70px rgba(255,42,42,0.14)"
        : "";
      el.style.borderColor = (k === key) ? "rgba(255,42,42,0.36)" : "";
    }
    setTimeout(() => {
      for (const k of Object.keys(cards)) {
        cards[k].style.transform = "translateY(0px)";
      }
    }, 700);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  window.addEventListener("keydown", (e) => {
    const k = (e.key || "").toUpperCase();
    if (k === "R") { loadWeather(); loadCalendar(); setStatus("refresh"); }
    if (k === "W" || k === "C" || k === "A") focusCard(k);
    if (k === "F") { toggleFullscreen(); elHint.textContent = "fullscreen toggled"; }
  });

  // -----------------------
  // Start / refresh loops
  // -----------------------
  loadWeather();
  loadCalendar();

  setInterval(loadWeather, CONFIG.weatherEveryMs);
  setInterval(loadCalendar, CONFIG.calendarEveryMs);
})();
