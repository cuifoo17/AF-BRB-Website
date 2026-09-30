// Cars are not typed into these pages. Each one is a profile kept in the
// private dashboard, and the pages load the current list from here.
const CARS_URL = "https://us-central1-do-favor-demo.cloudfunctions.net/cars?site=auto-favors";
const CARS_CACHE = "af_cars";
const STATUS_LABELS = { sold: "SOLD", "coming soon": "COMING SOON" };

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));

const carName = (car) => `${car.year} ${car.make} ${car.model}`;

// Hero slideshow: crossfades to the next photo on a fixed interval, looping.
// Tapping the photo card skips to the next photo with a bounce.
let slideTimers = [];

const startSlides = (slides) => {
  const photos = Array.from(slides.querySelectorAll(".slide"));
  if (photos.length < 2) return;

  const hero = slides.closest(".hero");
  const interval = Number(slides.dataset.interval) || 6000;
  let current = 0;
  let timer;

  // Fetch the next photo ahead of time so the fade never shows a blank frame.
  const preload = (index) => {
    photos[index].loading = "eager";
  };

  const advance = () => {
    const next = (current + 1) % photos.length;
    photos[current].classList.remove("is-active");
    photos[next].classList.add("is-active");
    current = next;
    preload((current + 1) % photos.length);
  };

  // Restart the clock after a tap so the new photo gets its full time on screen.
  const restartTimer = () => {
    clearInterval(timer);
    slideTimers = slideTimers.filter((id) => id !== timer);
    timer = setInterval(advance, interval);
    slideTimers.push(timer);
  };

  const bounce = () => {
    hero.classList.remove("is-bouncing");
    void hero.offsetWidth; // restart the animation on rapid taps
    hero.classList.add("is-bouncing");
  };

  const skip = () => {
    advance();
    restartTimer();
    bounce();
  };

  hero.addEventListener("click", skip);
  hero.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      skip();
    }
  });
  hero.addEventListener("animationend", () => hero.classList.remove("is-bouncing"));

  preload(1);
  restartTimer();
};

const stopSlides = () => {
  slideTimers.forEach(clearInterval);
  slideTimers = [];
};

// One car: photo slideshow with its price, then its name, mileage and buttons.
const vehicleCard = (car, heading, eager) => {
  const name = carName(car);
  const section = document.createElement("section");
  section.className = "vehicle";
  section.dataset.type = car.category;
  section.dataset.year = car.year;
  section.dataset.miles = car.miles ?? 0;
  section.dataset.price = car.price ?? 0;

  const slides = car.photos
    .map((photo, index) => {
      const alt = photo.alt || `${name}, photo ${index + 1}`;
      const lazy = index === 0 && eager ? "" : ' loading="lazy"';
      return `<img class="slide${index === 0 ? " is-active" : ""}" src="${escapeHtml(photo.url)}" alt="${escapeHtml(alt)}"${lazy}>`;
    })
    .join("");
  const tappable = car.photos.length > 1 ? ` role="button" tabindex="0" aria-label="Next photo of the ${escapeHtml(name)}"` : "";
  const price = car.price == null ? "" : `<div class="price-pill">$${car.price.toLocaleString("en-US")}</div>`;
  const status = STATUS_LABELS[car.status]
    ? `<div class="status-pill status-${car.status.replace(/ /g, "-")}">${STATUS_LABELS[car.status]}</div>`
    : "";
  const miles = car.miles == null ? "" : `<span class="vehicle-miles">${car.miles.toLocaleString("en-US")} mi</span>`;
  const moreInfo = car.moreInfoUrl
    ? `<a class="action action-info" href="${escapeHtml(car.moreInfoUrl)}"><span>MORE INFO</span></a>`
    : "";

  section.innerHTML = `
    <div class="hero"${tappable}>
      <div class="slides" data-interval="6000">${slides}</div>
      ${price}
      ${status}
    </div>
    <div class="vehicle-info">
      <div class="vehicle-text">
        <${heading} class="vehicle-name">${escapeHtml(name)}</${heading}>
        ${miles}
      </div>
      <div class="vehicle-actions">
        ${moreInfo}
        <a class="action action-call" href="tel:+18046608899"><span>CALL US</span></a>
      </div>
    </div>`;
  return section;
};

// Burger menu: opens a panel under the header; closes on a link tap,
// a tap anywhere else, or the Escape key.
const burger = document.querySelector(".burger");
const menu = document.querySelector(".menu");

if (burger && menu) {
  const setOpen = (open) => {
    menu.hidden = !open;
    burger.setAttribute("aria-expanded", String(open));
  };

  burger.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(menu.hidden);
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  // Capture phase, so a tap that closes the menu does nothing else
  // (it won't also flip the photo or press a button underneath).
  document.addEventListener(
    "click",
    (event) => {
      if (menu.hidden || menu.contains(event.target) || burger.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      burger.focus();
    }
  });
}

// Homepage: the featured car is the big photo at the top. With no car
// marked featured, the first available one stands in.
let featured = document.querySelector(".vehicle.is-featured");

const showFeatured = (cars) => {
  if (!featured) return;
  const car = cars.find((item) => item.featured) || cars.find((item) => item.status === "available") || cars[0];
  const divider = featured.nextElementSibling;
  featured.hidden = !car;
  if (divider && divider.matches(".divider")) divider.hidden = !car;
  if (!car) return;

  const card = vehicleCard(car, "h1", true);
  card.classList.add("is-featured");
  featured.replaceWith(card);
  featured = card;
  startSlides(card.querySelector(".slides"));
};

// Inventory: filter by type (several at once; none selected shows all)
// and sort. Defaults to newest first.
const list = document.querySelector(".inventory-list");
let showInventory = () => {};

if (list) {
  const toggle = document.querySelector(".sort-toggle");
  const panel = document.querySelector(".sort-panel");
  const typeButtons = Array.from(panel.querySelectorAll("[data-type]"));
  const sortButtons = Array.from(panel.querySelectorAll("[data-sort]"));
  const count = document.querySelector(".result-count");
  const empty = document.querySelector(".empty-state");

  const types = new Set();
  let sort = "year-desc";
  let vehicles = [];

  const render = () => {
    const [field, direction] = sort.split("-");
    const sign = direction === "asc" ? 1 : -1;
    const shown = vehicles
      .filter((vehicle) => types.size === 0 || types.has(vehicle.dataset.type))
      .sort((a, b) => sign * (Number(a.dataset[field]) - Number(b.dataset[field])));

    list.replaceChildren();
    shown.forEach((vehicle, index) => {
      if (index > 0) {
        const divider = document.createElement("hr");
        divider.className = "divider";
        list.append(divider);
      }
      list.append(vehicle);
    });

    count.textContent = shown.length === 1 ? "1 vehicle" : `${shown.length} vehicles`;
    empty.hidden = shown.length > 0;
    typeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(types.has(button.dataset.type)));
    });
    sortButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.sort === sort));
    });
  };

  showInventory = (cars) => {
    vehicles = cars.map((car, index) => vehicleCard(car, "h2", index === 0));
    render();
    vehicles.forEach((vehicle) => startSlides(vehicle.querySelector(".slides")));
  };

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };

  typeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.type;
      if (types.has(type)) types.delete(type);
      else types.add(type);
      render();
    });
  });

  sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      sort = button.dataset.sort;
      render();
    });
  });

  toggle.addEventListener("click", () => setOpen(panel.hidden));

  // Same rule as the menu: a tap that closes the panel does nothing else.
  document.addEventListener(
    "click",
    (event) => {
      if (panel.hidden || panel.contains(event.target) || toggle.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Homepage category buttons arrive with ?type=luxury etc.
  new URLSearchParams(location.search).getAll("type").forEach((type) => {
    if (typeButtons.some((button) => button.dataset.type === type)) types.add(type);
  });
}

// Load the cars. The copy saved from the last visit shows right away,
// then the current list replaces it if anything changed.
const showCars = (cars) => {
  stopSlides();
  showFeatured(cars);
  showInventory(cars);
};

const loadCars = async () => {
  let saved = null;
  try {
    saved = localStorage.getItem(CARS_CACHE);
    if (saved) showCars(JSON.parse(saved));
  } catch (error) {
    saved = null;
  }

  try {
    const response = await fetch(CARS_URL);
    if (!response.ok) throw new Error(`Cars request failed: ${response.status}`);
    const cars = (await response.json()).cars;
    const current = JSON.stringify(cars);
    if (current === saved) return;
    showCars(cars);
    try {
      localStorage.setItem(CARS_CACHE, current);
    } catch (error) {
      // Private browsing can block storage; the page still works without it.
    }
  } catch (error) {
    if (!saved) showCars([]);
  }
};

loadCars();
