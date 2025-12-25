// ============================
// North South Charters - script.js
// Includes:
// - Footer year
// - Gallery expand/collapse
// - Trips panel + pricing sync
// - Lightbox (photos only)
// - Captain sliders
// - Live Conditions: Weather (OWM), Tides (NOAA Hi/Lo only), Map (Leaflet)
// ============================

// 1) OpenWeatherMap API key
const OWM_API_KEY = "9dc589a002537bec0e0f701720b675a1";

// 2) Locations
// NOTE: lat/lon here are LAUNCH locations (map).
// NOAA station IDs are used ONLY for tides.
const LOCATIONS = {
  crystal: {
    label: "Crystal River Launch",
    lat: 28.903462209723877,
    lon: -82.63467354383404,
    address: "12073 W Fort Island Trl, Crystal River, FL 34429-9215",
    noaaStationId: "8727333"
  },
  tampa: {
    label: "Tampa Launch",
    lat: 27.89240448830268,
    lon: -82.53328635333908,
    address: "5108 W Gandy Blvd, Tampa, FL 33611",
    noaaStationId: "8726607"
  },
  tarpon: {
    label: "Tarpon Springs Launch",
    // your coords:
    lat: 28.17626333833187,
    lon: -82.78866363820713,
    address: "Tarpon Springs, FL",
    // North Anclote Key station you found:
    noaaStationId: "8726942"
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
  return new Date(s.replace(" ", "T"));
}

function fmtTime(dt){
  return dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* =========================
   WEATHER (OpenWeatherMap)
========================= */
async function loadWeather(key, targetId){
  const loc = LOCATIONS[key];
  const box = document.getElementById(targetId);
  if (!loc || !box) return;

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
   TIDES (NOAA) — HI/LO ONLY
   Fix: pull today + tomorrow so we always find "next" event
========================= */
async function loadTidesHilo(key, targetId){
  const loc = LOCATIONS[key];
  const el = document.getElementById(targetId);
  if (!loc || !el) return;

  try{
    const now = new Date();
    const begin = yyyymmddLocal(now);
    const end = yyyymmddLocal(addDays(now, 1)); // <-- key fix

    const url =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
      `?product=predictions&application=NSCharters` +
      `&begin_date=${begin}&end_date=${end}` +
      `&datum=MLLW&station=${loc.noaaStationId}` +
      `&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Tides request failed");
    const data = await res.json();

    const preds = (data.predictions || [])
      .map(p => ({ ...p, dt: parseNoaaDateTime(p.t), vNum: Number(p.v) }))
      .filter(p => p.dt instanceof Date && !isNaN(p.dt) && Number.isFinite(p.vNum))
      .sort((a,b) => a.dt - b.dt);

    if (!preds.length){
      el.textContent = "No tide predictions found.";
      return;
    }

    const upcoming = preds.filter(p => p.dt >= now);

    const nextHigh = upcoming.find(p => p.type === "H");
    const nextLow  = upcoming.find(p => p.type === "L");

    if (!nextHigh && !nextLow){
      el.textContent = "No upcoming tide events found.";
      return;
    }

    const parts = [];
    if (nextHigh){
      parts.push(`• <strong>High</strong> @ ${fmtTime(nextHigh.dt)} — ${nextHigh.vNum.toFixed(2)} ft`);
    }
    if (nextLow){
      parts.push(`• <strong>Low</strong> @ ${fmtTime(nextLow.dt)} — ${nextLow.vNum.toFixed(2)} ft`);
    }

    el.innerHTML = parts.map(x => `<div>${x}</div>`).join("");
  }catch(err){
    el.textContent = "Tides unavailable right now.";
  }
}

/* =========================
   MAP (Leaflet)
========================= */
let map, markers = {};

const launchIcon = L.icon({
  iconUrl: "images/logo-icon-no-words.png",
  iconSize: [36, 36],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42]
});

function initMap(){
  if (!window.L) return;

  // Auto-center using all locations
  const keys = Object.keys(LOCATIONS);
  const avgLat = keys.reduce((s,k) => s + LOCATIONS[k].lat, 0) / keys.length;
  const avgLon = keys.reduce((s,k) => s + LOCATIONS[k].lon, 0) / keys.length;

  map = L.map("map", { scrollWheelZoom: false }).setView([avgLat, avgLon], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const markerList = [];

  keys.forEach((key) => {
    const loc = LOCATIONS[key];
    markers[key] = L.marker([loc.lat, loc.lon], { icon: launchIcon }).addTo(map)
    .bindPopup(`<strong>${loc.label}</strong><br/>${loc.address || ""}`);
    markerList.push(markers[key]);
  });

  const group = L.featureGroup(markerList);
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
    },
    island: {
      title: "Island Hopping",
      desc: "A relaxed day exploring islands, sandbars, and clear water spots — perfect for families, couples, and groups looking to cruise, swim, and unwind.",
      bullets: [
        "Island + sandbar stops (conditions permitting)",
        "Great for families & groups",
        "Swimming/snorkeling-friendly vibes",
        "Cooler space for drinks & snacks"
      ],
      btn: "Book Island Hopping",
      bg: "images/shark1.jpeg", // swap to your best “island day” photo if you have one
      prices: { half: "$400", full: "$600" }, // change these to your real numbers
      pricingNote: "Island hopping is weather/tide dependent — we’ll confirm the best spots before launch."
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

  renderTrip("inshore", { scrollToPanel: false });
}

function initLightbox(){
  const galleryImages = Array.from(document.querySelectorAll(".gallery-preview img, .gallery-full img"));
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const btnClose = document.querySelector(".lightbox-close");
  const btnPrev = document.querySelector(".lightbox-prev");
  const btnNext = document.querySelector(".lightbox-next");

  if (!lightbox || !lightboxImg || !btnClose || !btnPrev || !btnNext) return;

  let currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    const img = galleryImages[currentIndex];

    lightboxImg.style.display = "";
    btnPrev.removeAttribute("hidden");
    btnNext.removeAttribute("hidden");

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
   BOOT (safe)
========================= */
window.addEventListener("DOMContentLoaded", () => {
  const safe = (name, fn) => {
    try { fn(); }
    catch (e) { console.error(`[BOOT] ${name} failed:`, e); }
  };

  safe("initFooterYear", () => typeof initFooterYear === "function" && initFooterYear());
  safe("initGalleryToggle", () => typeof initGalleryToggle === "function" && initGalleryToggle());
  safe("initTripsAndPricing", () => typeof initTripsAndPricing === "function" && initTripsAndPricing());
  safe("initLightbox", () => typeof initLightbox === "function" && initLightbox());
  safe("initCaptainSliders", () => typeof initCaptainSliders === "function" && initCaptainSliders());

  safe("loadWeather crystal", () => typeof loadWeather === "function" && loadWeather("crystal", "weather-crystal"));
  safe("loadWeather tampa",   () => typeof loadWeather === "function" && loadWeather("tampa", "weather-tampa"));
  safe("loadWeather tarpon",  () => typeof loadWeather === "function" && loadWeather("tarpon", "weather-tarpon"));

  safe("loadTidesHilo crystal", () => typeof loadTidesHilo === "function" && loadTidesHilo("crystal", "tides-crystal"));
  safe("loadTidesHilo tampa",   () => typeof loadTidesHilo === "function" && loadTidesHilo("tampa", "tides-tampa"));
  safe("loadTidesHilo tarpon",  () => typeof loadTidesHilo === "function" && loadTidesHilo("tarpon", "tides-tarpon"));

  // ✅ INIT MAP
  safe("initMap", () => typeof initMap === "function" && initMap());

  // ✅ FIX 1: force resize after layout settles
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 200);

  // ✅ FIX 2: force resize again when map scrolls into view
  const mapEl = document.getElementById("map");
  if (mapEl && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, 50);
        io.disconnect();
      }
    }, { threshold: 0.2 });

    io.observe(mapEl);
  }

  safe("wireFocusButtons", () => typeof wireFocusButtons === "function" && wireFocusButtons());
});