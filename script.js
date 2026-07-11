const menuButton = document.querySelector(".menu-button");
const siteNav = document.querySelector(".site-nav");

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });
}

const year = document.querySelector("#year");
if (year) {
  year.textContent = new Date().getFullYear();
}

const appointmentDate = document.querySelector("#appointment-date");
if (appointmentDate) {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
  appointmentDate.min = localDate;
}

function showDemoMessage(form, message) {
  const status = form.querySelector(".form-message");
  status.textContent = message;
  status.classList.add("success");
}

const bookingForm = document.querySelector("#booking-form");
if (bookingForm) {
  bookingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    showDemoMessage(
      bookingForm,
      "The form design is working. We will connect it to Supabase next so Merle can receive and manage requests."
    );
  });
}

const contactForm = document.querySelector("#contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    showDemoMessage(
      contactForm,
      "The message form is ready. We will activate secure submissions when Supabase is connected."
    );
  });
}
