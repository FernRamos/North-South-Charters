/* =========================================================
   North South Charters — script.js
   Includes:
   - Footer year
   - Gallery toggle (preview vs full) + moves button
   - Trips: single trip panel + prices per trip (default Inshore)
   - Gallery lightbox (preview + full)
   - Captain image sliders
   - Live Conditions: Weather (OpenWeather), Tides (NOAA), Map (Leaflet)
========================================================= */

/* =========================
   0) Footer year
========================= */
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* =========================
   1) Trips + Pricing data
========================= */
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
    bg: "images/scallop2.jpeg", // you asked for scallop2.jpeg
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

/* =========================
   2) Live Conditions config
   - Weather: OpenWeatherMap
   - Tides: NOAA CO-OPS
   - Map: Leaflet
========================= */

// ✅ Put your REAL OpenWeather API key here:
const OWM_API_KEY = "9dc589a002537bec0e0f701720b675a1";

// Two locations
const LOCATIONS = {
  crystal: {
    label: "Crystal River Launch",
    lat: 28.8559,
    lon: -82.6413,
    noaaStationId: "8727343",
    address: "12073 W Fort Island Trl, Crystal River, FL 34429-9215"
  },
  tampa: {
    label: "Tampa Launch",
    lat: 27.8937,
    lon: -82.5266,
    noaaStationId: "8726607",
    address: "5108 W Gandy Blvd, Tampa, FL 33611"
  }
};

function fmtTempF(x){ return `${Math.round(x)}°F`; }
function fmtWindMph(x){ return `${Math.round(x)} mph`; }

async function loadWeather(locKey, targetId){
  const loc = LOCATIONS[locKey];
  const box = document.getElementById(targetId);
  if (!box || !loc) return;

  // Key missing (friendly message)
  if (!OWM_API_KEY || OWM_API_KEY.length < 10){
    const descEl = box.querySelector(".weather-desc");
    if (descEl) descEl.textContent = "Add your OpenWeatherMap API key to show live weather.";
    return;
  }

  try{
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${loc.lat}&lon=${loc.lon}&units=imperial&appid=${OWM_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok){
      const txt = await res.text();
      throw new Error(`OWM error ${res.status}: ${txt}`);
    }

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
    console.error(err);
    const descEl = box.querySelector(".weather-desc");
    if (descEl) descEl.textContent = "Weather unavailable right now.";
  }
}

function yyyymmddLocal(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function loadTidesHilo(locKey, targetId){
  const loc = LOCATIONS[locKey];
  const el = document.getElementById(targetId);
  if (!el || !loc) return;

  try{
    const begin = yyyymmddLocal();
    const end = begin;

    const url =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
      `?product=predictions&application=NSCharters` +
      `&begin_date=${begin}&end_date=${end}` +
      `&datum=MLLW&station=${loc.noaaStationId}` +
      `&time_zone=lst_ldt&units=english&interval=hilo&format=json`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("NOAA tides request failed");
    const data = await res.json();

    const preds = data.predictions || [];
    if (!preds.length){
      el.textContent = "No tide predictions found for today.";
      return;
    }

    const now = new Date();
    const upcoming = preds
      .map(p => ({ ...p, dt: new Date(p.t.replace(" ", "T")) }))
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
    console.error(err);
    el.textContent = "Tides unavailable right now.";
  }
}

/* ===== Map (Leaflet) ===== */
let map, markers = {};

function initMap(){
  if (!window.L) return;

  const centerLat = (LOCATIONS.crystal.lat + LOCATIONS.tampa.lat) / 2;
  const centerLon = (LOCATIONS.crystal.lon + LOCATIONS.tampa.lon) / 2;

  map = L.map("map", { scrollWheelZoom: false }).setView([centerLat, centerLon], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
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
  map.setView([loc.lat, loc.lon], 11, { animate: true });
  markers[key].openPopup();
}

function wireFocusButtons(){
  document.querySelectorAll("[data-focus]").forEach(btn => {
    btn.addEventListener("click", () => focusOn(btn.dataset.focus));
  });
}

/* =========================
   3) DOMContentLoaded — wire everything once
========================= */
window.addEventListener("DOMContentLoaded", () => {

  /* --- Gallery toggle --- */
  const toggleBtn = document.getElementById("toggleGallery");
  const fullGallery = document.getElementById("fullGallery");
  const galleryActions = document.getElementById("galleryActions");
  const previewGallery = document.querySelector(".gallery-preview");

  if (toggleBtn && fullGallery && galleryActions && previewGallery) {
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

  /* --- Trips + Trip Panel + Pricing Sync --- */
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
      if (data.bg) {
        tripPanel.style.setProperty("--trip-bg", `url('${data.bg}')`);
        tripPanel.classList.add("has-bg");
      } else {
        tripPanel.style.removeProperty("--trip-bg");
        tripPanel.classList.remove("has-bg");
      }
      tripPanel.removeAttribute("hidden");
    }

    if (priceHalf) priceHalf.textContent = data.prices?.half ?? "$___";
    if (priceFull) priceFull.textContent = data.prices?.full ?? "$___";
    if (pricingNote) pricingNote.textContent = data.pricingNote ?? "";

    if (scrollToPanel && tripPanel) {
      tripPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  tripButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-trip");
      renderTrip(key, { scrollToPanel: true });
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

  // Default trip on load
  renderTrip("inshore", { scrollToPanel: false });

  /* --- Lightbox --- */
  const galleryImages = Array.from(
    document.querySelectorAll(".gallery-preview img, .gallery-full img")
  );

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const btnClose = document.querySelector(".lightbox-close");
  const btnPrev = document.querySelector(".lightbox-prev");
  const btnNext = document.querySelector(".lightbox-next");

  if (galleryImages.length && lightbox && lightboxImg && btnClose && btnPrev && btnNext) {
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

    function showNext() {
      currentIndex = (currentIndex + 1) % galleryImages.length;
      openLightbox(currentIndex);
    }

    function showPrev() {
      currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
      openLightbox(currentIndex);
    }

    galleryImages.forEach((img, idx) => {
      img.addEventListener("click", () => openLightbox(idx));
    });

    btnClose.addEventListener("click", (e) => { e.stopPropagation(); closeLightbox(); });
    btnNext.addEventListener("click", (e) => { e.stopPropagation(); showNext(); });
    btnPrev.addEventListener("click", (e) => { e.stopPropagation(); showPrev(); });

    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") showNext();
      if (e.key === "ArrowLeft") showPrev();
    });
  }

  /* --- Captain sliders --- */
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

    prev.addEventListener("click", () => {
      index = (index - 1 + images.length) % images.length;
      showImage(index);
    });

    next.addEventListener("click", () => {
      index = (index + 1) % images.length;
      showImage(index);
    });

    showImage(0);
  });

  /* --- Live Conditions boot --- */
  loadWeather("crystal", "weather-crystal");
  loadWeather("tampa", "weather-tampa");

  loadTidesHilo("crystal", "tides-crystal");
  loadTidesHilo("tampa", "tides-tampa");

  initMap();
  wireFocusButtons();
});