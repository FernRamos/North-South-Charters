// ============================
// North South Charters - script.js
// Includes:
// - Footer year
// - Gallery expand/collapse
// - Trips panel + pricing sync
// - Lightbox
// - Captain sliders
// - Live Conditions: Weather (OWM), Tides (NOAA Hi/Lo + Chart), Map (Leaflet)
// ============================

// 1) OpenWeatherMap API key
const OWM_API_KEY = "9dc589a002537bec0e0f701720b675a1";

// 2) Locations
// NOTE: lat/lon here are LAUNCH locations (map).
// NOAA station IDs are used ONLY for tides.
const LOCATIONS = {
  crystal: {
    label: "Crystal River Launch",
    lat: 28.8559,
    lon: -82.6413,
    address: "12073 W Fort Island Trl, Crystal River, FL 34429-9215",
    noaaStationId: "8727343"
  },
  tampa: {
    label: "Tampa Launch",
    lat: 27.8937,
    lon: -82.5266,
    address: "5108 W Gandy Blvd, Tampa, FL 33611",
    noaaStationId: "8726607"
  }
};

function fmtTempF(x){ return `${Math.round(x)}°F`; }
function fmtWindMph(x){ return `${Math.round(x)} mph`; }

function yyyymmddLocal(date = new Date()){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function addDays(date, days){
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseNoaaDateTime(s){
  // NOAA returns "YYYY-MM-DD HH:MM"
  // We'll parse as local time (good enough for display + relative filtering).
  return new Date(s.replace(" ", "T"));
}

/* =========================
   WEATHER (OpenWeatherMap)
========================= */
async function loadWeather(key, targetId){
  const loc = LOCATIONS[key];
  const box = document.getElementById(targetId);
  if (!loc || !box) return;

  // If user hasn't set key
  if (!OWM_API_KEY || OWM_API_KEY === "PASTE_YOUR_OPENWEATHER_KEY_HERE"){
    const descEl = box.querySelector(".weather-desc");
    if (descEl) descEl.textContent = "Add your OpenWeatherMap API key to show live weather.";
    return;
  }

  try{
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&units=imperial&appid=${OWM_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed");
    const data = await res.json();

    const temp = data.main?.temp;
    const feels = data.main?.feels_like;
    const wind = data.wind?.speed;
    const desc = (data.weather?.[0]?.description || "").replace(/^\w/, c => c.toUpperCase());
    const icon = data.weather?.[0]?.icon;

    box.querySelector(".weather-temp").textContent = (typeof temp === "number") ? fmtTempF(temp) : "—";
    box.querySelector(".weather-desc").textContent = desc || "—";
    box.querySelector(".w-feels").textContent = (typeof feels === "number") ? fmtTempF(feels) : "—";
    box.querySelector(".w-wind").textContent = (typeof wind === "number") ? fmtWindMph(wind) : "—";

    const iconEl = box.querySelector(".weather-icon");
    if (iconEl && icon){
      iconEl.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
      iconEl.alt = desc || "Weather icon";
    }
  }catch(err){
    const descEl = box.querySelector(".weather-desc");
    if (descEl) descEl.textContent = "Weather unavailable right now.";
  }
}

/* =========================
   TIDES (NOAA)
   - Hi/Lo list (next events)
   - Tide chart (next 24h)
========================= */
async function loadTidesHilo(key, targetId){
  const loc = LOCATIONS[key];
  const el = document.getElementById(targetId);
  if (!loc || !el) return;

  try{
    const begin = yyyymmddLocal(new Date());
    const end = begin;

    const url =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
      `?product=predictions&application=NSCharters` +
      `&begin_date=${begin}&end_date=${end}` +
      `&datum=MLLW&station=${loc.noaaStationId}` +
      `&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Tides request failed");
    const data = await res.json();

    const preds = data.predictions || [];
    if (!preds.length){
      el.textContent = "No tide predictions found for today.";
      return;
    }

    const now = new Date();
    const upcoming = preds
      .map(p => ({ ...p, dt: parseNoaaDateTime(p.t) }))
      .filter(p => p.dt >= now)
      .slice(0, 4);

    if (!upcoming.length){
      el.textContent = "No more tide events today.";
      return;
    }

    el.innerHTML = upcoming.map(p => {
      const type = (p.type === "H") ? "High" : "Low";
      const time = p.t.split(" ")[1];
      return `<div>• <strong>${type}</strong> @ ${time} — ${p.v} ft</div>`;
    }).join("");
  }catch(err){
    el.textContent = "Tides unavailable right now.";
  }
}

function buildTideChartSVG(points, label){
  // points: [{dt: Date, v: number}]
  const W = 700;
  const H = 180;
  const PAD_X = 26;
  const PAD_Y = 18;

  const vs = points.map(p => p.v);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);

  const span = (maxV - minV) || 1;

  const x0 = points[0].dt.getTime();
  const x1 = points[points.length - 1].dt.getTime();
  const xSpan = (x1 - x0) || 1;

  const mapX = (t) => PAD_X + ((t - x0) / xSpan) * (W - PAD_X * 2);
  const mapY = (v) => PAD_Y + (1 - ((v - minV) / span)) * (H - PAD_Y * 2);

  const poly = points.map(p => `${mapX(p.dt.getTime()).toFixed(1)},${mapY(p.v).toFixed(1)}`).join(" ");

  // Area fill down to baseline
  const baseY = PAD_Y + (H - PAD_Y * 2);
  const area = `${poly} ${mapX(x1).toFixed(1)},${baseY.toFixed(1)} ${mapX(x0).toFixed(1)},${baseY.toFixed(1)}`;

  // ticks (simple)
  const leftLabel = points[0].dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const rightLabel = points[points.length - 1].dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return `
    <div class="tc-title">${label}</div>
    <div class="tc-sub">Next 24 hours (NOAA prediction)</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label} tide chart">
      <defs>
        <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(216,168,96,0.35)"></stop>
          <stop offset="100%" stop-color="rgba(88,152,232,0.10)"></stop>
        </linearGradient>
      </defs>

      <!-- baseline -->
      <line x1="${PAD_X}" y1="${baseY}" x2="${W - PAD_X}" y2="${baseY}" stroke="rgba(32,80,144,0.18)" stroke-width="2"/>

      <!-- area -->
      <polygon points="${area}" fill="url(#tideFill)"></polygon>

      <!-- line -->
      <polyline points="${poly}" fill="none" stroke="rgba(32,80,144,0.9)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>

      <!-- min/max labels -->
      <text x="${PAD_X}" y="${PAD_Y + 10}" font-size="12" fill="rgba(11,23,32,0.65)">Max: ${maxV.toFixed(1)} ft</text>
      <text x="${PAD_X}" y="${H - 10}" font-size="12" fill="rgba(11,23,32,0.65)">Min: ${minV.toFixed(1)} ft</text>

      <!-- time labels -->
      <text x="${PAD_X}" y="${H - 10}" text-anchor="start" font-size="12" fill="rgba(11,23,32,0.55)">${leftLabel}</text>
      <text x="${W - PAD_X}" y="${H - 10}" text-anchor="end" font-size="12" fill="rgba(11,23,32,0.55)">${rightLabel}</text>
    </svg>
  `;
}

async function loadTideChart(key, chartId){
  const loc = LOCATIONS[key];
  const el = document.getElementById(chartId);
  if (!loc || !el) return;

  try{
    const now = new Date();
    const begin = yyyymmddLocal(now);
    const end = yyyymmddLocal(addDays(now, 1)); // next day to cover next 24h

    // Hourly predictions for chart
    const url =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
      `?product=predictions&application=NSCharters` +
      `&begin_date=${begin}&end_date=${end}` +
      `&datum=MLLW&station=${loc.noaaStationId}` +
      `&time_zone=lst_ldt&units=english&interval=60&format=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Tide chart request failed");
    const data = await res.json();

    const preds = (data.predictions || [])
      .map(p => ({ dt: parseNoaaDateTime(p.t), v: Number(p.v) }))
      .filter(p => Number.isFinite(p.v));

    if (!preds.length){
      el.innerHTML = `<div class="tc-fallback">No chart data available.</div>`;
      return;
    }

    // next 24 hours window
    const endWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowPts = preds.filter(p => p.dt >= now && p.dt <= endWindow);

    // If filtering leaves too little, fallback to first N points
    const pts = windowPts.length >= 6 ? windowPts : preds.slice(0, 24);

    el.innerHTML = buildTideChartSVG(pts, `${LOCATIONS[key].label} — Tide Chart`);
  }catch(err){
    el.innerHTML = `<div class="tc-fallback">Tide chart unavailable right now.</div>`;
  }
}

/* =========================
   MAP (Leaflet)
========================= */
let map, markers = {};

function initMap(){
  if (!window.L) return;

  const centerLat = (LOCATIONS.crystal.lat + LOCATIONS.tampa.lat) / 2;
  const centerLon = (LOCATIONS.crystal.lon + LOCATIONS.tampa.lon) / 2;

  map = L.map("map", { scrollWheelZoom: false }).setView([centerLat, centerLon], 9);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  markers.crystal = L.marker([LOCATIONS.crystal.lat, LOCATIONS.crystal.lon]).addTo(map)
    .bindPopup(`<strong>${LOCATIONS.crystal.label}</strong><br/>${LOCATIONS.crystal.address}`);

  markers.tampa = L.marker([LOCATIONS.tampa.lat, LOCATIONS.tampa.lon]).addTo(map)
    .bindPopup(`<strong>${LOCATIONS.tampa.label}</strong><br/>${LOCATIONS.tampa.address}`);

  const group = L.featureGroup([markers.crystal, markers.tampa]);
  map.fitBounds(group.getBounds().pad(0.25));
}

function focusOn(key){
  if (!map || !markers[key]) return;
  const loc = LOCATIONS[key];
  map.setView([loc.lat, loc.lon], 13, { animate: true });
  markers[key].openPopup();
}

function wireFocusButtons(){
  document.querySelectorAll("[data-focus]").forEach(btn => {
    btn.addEventListener("click", () => focusOn(btn.dataset.focus));
  });
}

/* =========================
   SITE FEATURES
========================= */
function initFooterYear(){
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function initGalleryToggle(){
  const toggleBtn = document.getElementById("toggleGallery");
  const fullGallery = document.getElementById("fullGallery");
  const galleryActions = document.getElementById("galleryActions");
  const previewGallery = document.querySelector(".gallery-preview");

  if (!toggleBtn || !fullGallery || !galleryActions || !previewGallery) return;

  toggleBtn.addEventListener("click", () => {
    const isHidden = fullGallery.hasAttribute("hidden");

    if (isHidden) {
      fullGallery.removeAttribute("hidden");
      toggleBtn.textContent = "Hide Photos";
      toggleBtn.setAttribute("aria-expanded", "true");
      fullGallery.after(galleryActions);
      fullGallery.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      fullGallery.setAttribute("hidden", "");
      toggleBtn.textContent = "View All Photos";
      toggleBtn.setAttribute("aria-expanded", "false");
      previewGallery.after(galleryActions);
      previewGallery.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function initTripsAndPricing(){
  const tripData = {
    inshore: {
      title: "Inshore Fishing",
      desc: "Our inshore trips target redfish, snook, trout, and other species in Crystal River’s flats and mangrove shorelines.",
      bullets: [
        "Calm waters — great for kids and beginners",
        "Year-round availability",
        "Light tackle, lots of action"
      ],
      btn: "Book Inshore Trip",
      bg: "images/redfish14.jpeg",
      prices: { half: "$475", full: "$600" },
      pricingNote: "Licenses, gear, bait included (edit this to match your offer)."
    },
    scalloping: {
      title: "Scalloping",
      desc: "Experience one of Crystal River’s most unique adventures during scallop season. Perfect for families, groups, and first-timers.",
      bullets: [
        "Seasonal (summer months)",
        "Snorkeling in clear Gulf waters",
        "Great for all ages"
      ],
      btn: "Book Scalloping Trip",
      bg: "images/scallop1.jpeg",
      prices: { half: "$400", full: "$600" },
      pricingNote: "Scalloping is seasonal — ask about dates, tides, and group rates."
    },
    nearshore: {
      title: "Nearshore Fishing",
      desc: "When conditions allow, we head just a few miles offshore to target grouper, mackerel, cobia, and other hard-fighting species.",
      bullets: [
        "Bigger fish, heavier tackle",
        "Weather dependent",
        "Great for experienced anglers"
      ],
      btn: "Book Nearshore Trip",
      bg: "images/grouper1.jpeg",
      prices: { half: "From $500", full: "From $700" },
      pricingNote: "Nearshore trips are weather dependent — we’ll confirm conditions before launch."
    }
  };

  const tripPanel = document.getElementById("tripPanel");
  const tripTitle = document.getElementById("tripTitle");
  const tripDesc = document.getElementById("tripDesc");
  const tripList = document.getElementById("tripList");
  const tripBtn = document.getElementById("tripBtn");
  const closeTrip = document.getElementById("closeTrip");
  const tripButtons = document.querySelectorAll("[data-trip]");

  const priceHalf = document.getElementById("priceHalf");
  const priceFull = document.getElementById("priceFull");
  const pricingNote = document.getElementById("pricingNote");

  function renderTrip(key, { scrollToPanel = false } = {}) {
    const data = tripData[key];
    if (!data) return;

    if (tripTitle) tripTitle.textContent = data.title;
    if (tripDesc) tripDesc.textContent = data.desc;

    if (tripList) {
      tripList.innerHTML = "";
      data.bullets.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        tripList.appendChild(li);
      });
    }

    if (tripBtn) tripBtn.textContent = data.btn;

    if (tripPanel) {
      tripPanel.style.setProperty("--trip-bg", `url('${data.bg}')`);
      tripPanel.classList.add("has-bg");
      tripPanel.removeAttribute("hidden");
    }

    if (priceHalf) priceHalf.textContent = data.prices?.half ?? "$___";
    if (priceFull) priceFull.textContent = data.prices?.full ?? "$___";
    if (pricingNote) pricingNote.textContent = data.pricingNote ?? "";

    if (scrollToPanel && tripPanel) {
      tripPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  tripButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      renderTrip(btn.getAttribute("data-trip"), { scrollToPanel: true });
    });
  });

  if (closeTrip && tripPanel) {
    closeTrip.addEventListener("click", () => {
      tripPanel.setAttribute("hidden", "");
      tripPanel.style.removeProperty("--trip-bg");
      tripPanel.classList.remove("has-bg");
      document.getElementById("trips")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Default on load
  renderTrip("inshore", { scrollToPanel: false });
}

function initLightbox(){
  const galleryImages = Array.from(document.querySelectorAll(".gallery-preview img, .gallery-full img"));
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const btnClose = document.querySelector(".lightbox-close");
  const btnPrev = document.querySelector(".lightbox-prev");
  const btnNext = document.querySelector(".lightbox-next");

  if (!galleryImages.length || !lightbox || !lightboxImg || !btnClose || !btnPrev || !btnNext) return;

  let currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    const img = galleryImages[currentIndex];
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || "Gallery image";
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImg.src = "";
    document.body.style.overflow = "";
  }

  function showNext() { openLightbox((currentIndex + 1) % galleryImages.length); }
  function showPrev() { openLightbox((currentIndex - 1 + galleryImages.length) % galleryImages.length); }

  galleryImages.forEach((img, idx) => img.addEventListener("click", () => openLightbox(idx)));

  btnClose.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
  btnNext.addEventListener("click", (e) => { e.stopPropagation(); showNext(); });
  btnPrev.addEventListener("click", (e) => { e.stopPropagation(); showPrev(); });

  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") showNext();
    if (e.key === "ArrowLeft") showPrev();
  });
}

function initCaptainSliders(){
  document.querySelectorAll(".captain-slider").forEach(slider => {
    const images = slider.querySelectorAll("img");
    const prev = slider.querySelector(".prev");
    const next = slider.querySelector(".next");
    if (!images.length || !prev || !next) return;

    let index = 0;
    function showImage(i){
      images.forEach(img => img.classList.remove("active"));
      images[i].classList.add("active");
    }

    prev.addEventListener("click", (e) => {
      e.preventDefault();
      index = (index - 1 + images.length) % images.length;
      showImage(index);
    });

    next.addEventListener("click", (e) => {
      e.preventDefault();
      index = (index + 1) % images.length;
      showImage(index);
    });
  });
}

/* =========================
   BOOT
========================= */
window.addEventListener("DOMContentLoaded", () => {
  initFooterYear();
  initGalleryToggle();
  initTripsAndPricing();
  initLightbox();
  initCaptainSliders();

  // Live Conditions
  loadWeather("crystal", "weather-crystal");
  loadWeather("tampa", "weather-tampa");

  loadTidesHilo("crystal", "tides-crystal");
  loadTidesHilo("tampa", "tides-tampa");

  loadTideChart("crystal", "tidechart-crystal");
  loadTideChart("tampa", "tidechart-tampa");

  initMap();
  wireFocusButtons();
});