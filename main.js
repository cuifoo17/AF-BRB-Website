// Hero slideshow: crossfades to the next photo on a fixed interval, looping.
// Tapping the photo card skips to the next photo with a bounce.
document.querySelectorAll(".slides").forEach((slides) => {
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
    timer = setInterval(advance, interval);
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
});

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

// Inventory: filter by type (several at once; none selected shows all)
// and sort. Defaults to newest first.
const list = document.querySelector(".inventory-list");

if (list) {
  const vehicles = Array.from(list.querySelectorAll(".vehicle"));
  const toggle = document.querySelector(".sort-toggle");
  const panel = document.querySelector(".sort-panel");
  const typeButtons = Array.from(panel.querySelectorAll("[data-type]"));
  const sortButtons = Array.from(panel.querySelectorAll("[data-sort]"));
  const count = document.querySelector(".result-count");
  const empty = document.querySelector(".empty-state");

  const types = new Set();
  let sort = "year-desc";

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

  render();
}
