// Footer year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

window.addEventListener("DOMContentLoaded", () => {
  // ---------------------------
  // Collapsible gallery toggle + move button
  // ---------------------------
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

  // ---------------------------
  // Trips + Trip Panel + Pricing Sync
  // ---------------------------
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
      prices: {
        half: "$475",
        full: "$600"
      },
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
      prices: {
        half: "$400",
        full: "$600"
      },
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
      prices: {
        half: "From $500",
        full: "From $700"
      },
      pricingNote: "Nearshore trips are weather dependent — we’ll confirm conditions before launch."
    }
  };

  // Trip panel elements
  const tripPanel = document.getElementById("tripPanel");
  const tripTitle = document.getElementById("tripTitle");
  const tripDesc = document.getElementById("tripDesc");
  const tripList = document.getElementById("tripList");
  const tripBtn = document.getElementById("tripBtn");
  const closeTrip = document.getElementById("closeTrip");
  const tripButtons = document.querySelectorAll("[data-trip]");

  // Pricing elements
  const priceHalf = document.getElementById("priceHalf");
  const priceThreeQuarter = document.getElementById("priceThreeQuarter");
  const priceFull = document.getElementById("priceFull");
  const pricingNote = document.getElementById("pricingNote");

  function renderTrip(key, { scrollToPanel = false } = {}) {
    const data = tripData[key];
    if (!data) return;

    // Fill trip panel text
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

    // Background
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

    // Update pricing
    if (priceHalf) priceHalf.textContent = data.prices?.half ?? "$___";
    if (priceFull) priceFull.textContent = data.prices?.full ?? "$___";
    if (pricingNote) pricingNote.textContent = data.pricingNote ?? "";

    // Optional scroll
    if (scrollToPanel && tripPanel) {
      tripPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // Click behavior
  if (tripButtons.length) {
    tripButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-trip");
        renderTrip(key, { scrollToPanel: true });
      });
    });
  }

  // Close behavior (hides panel but does NOT reset pricing)
  if (closeTrip && tripPanel) {
    closeTrip.addEventListener("click", () => {
      tripPanel.setAttribute("hidden", "");
      tripPanel.style.removeProperty("--trip-bg");
      tripPanel.classList.remove("has-bg");
      document.getElementById("trips")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ✅ Default on load: Inshore details + Inshore prices
  renderTrip("inshore", { scrollToPanel: false });

  // ---------------------------
  // Lightbox (preview + full gallery)
  // ---------------------------
  const galleryImages = Array.from(
    document.querySelectorAll(".gallery-preview img, .gallery-full img")
  );

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const btnClose = document.querySelector(".lightbox-close");
  const btnPrev = document.querySelector(".lightbox-prev");
  const btnNext = document.querySelector(".lightbox-next");

  if (!galleryImages.length || !lightbox || !lightboxImg || !btnClose || !btnPrev || !btnNext) {
    return;
  }

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
});

// Captain image sliders
document.querySelectorAll(".captain-slider").forEach(slider => {
  const images = slider.querySelectorAll("img");
  const prev = slider.querySelector(".prev");
  const next = slider.querySelector(".next");

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
});