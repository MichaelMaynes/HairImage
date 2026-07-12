const menuButton = document.querySelector(".menu-button");
const siteNav = document.querySelector(".site-nav");
const db = window.hairImageSupabase;

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

function setFormMessage(form, message, type = "success") {
  const status = form.querySelector(".form-message");
  if (!status) return;

  status.textContent = message;
  status.classList.remove("success", "error");
  status.classList.add(type);
}

function setSubmitting(form, isSubmitting, waitingText = "Sending…") {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;

  if (isSubmitting) {
    button.dataset.originalText = button.textContent;
    button.textContent = waitingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function isHoneypotFilled(formData) {
  return String(formData.get("website") || "").trim().length > 0;
}

function isOpenAppointmentDate(dateValue) {
  const selectedDate = new Date(`${dateValue}T12:00:00`);
  const day = selectedDate.getDay();
  return day >= 2 && day <= 5;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatReviewDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

async function loadReviews() {
  const reviewsList = document.querySelector("#reviews-list");
  if (!reviewsList) return;

  if (!db) {
    reviewsList.innerHTML =
      '<div class="review-loading">Reviews are temporarily unavailable.</div>';
    return;
  }

  const { data, error } = await db
    .from("reviews")
    .select("id, customer_name, rating, review_text, created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Could not load reviews:", error);
    reviewsList.innerHTML =
      '<div class="review-loading">Reviews are temporarily unavailable.</div>';
    return;
  }

  if (!data || data.length === 0) {
    reviewsList.innerHTML = `
      <article class="public-review-card empty-review">
        <span class="quote-mark">“</span>
        <p>Be one of the first clients featured on the Hair Image website.</p>
      </article>
    `;
    return;
  }

  reviewsList.innerHTML = data
    .map((review) => {
      const stars = "★".repeat(Number(review.rating)) +
        "☆".repeat(5 - Number(review.rating));

      return `
        <article class="public-review-card">
          <div class="review-stars" aria-label="${Number(review.rating)} out of 5 stars">
            ${stars}
          </div>
          <p>“${escapeHtml(review.review_text)}”</p>
          <footer>
            <strong>${escapeHtml(review.customer_name)}</strong>
            <span>${escapeHtml(formatReviewDate(review.created_at))}</span>
          </footer>
        </article>
      `;
    })
    .join("");
}

const bookingForm = document.querySelector("#booking-form");
if (bookingForm) {
  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);

    if (isHoneypotFilled(formData)) {
      bookingForm.reset();
      setFormMessage(
        bookingForm,
        "Thank you. Your appointment request was received."
      );
      return;
    }

    if (!db) {
      setFormMessage(
        bookingForm,
        "The appointment system is temporarily unavailable. Please call (321) 264-0030.",
        "error"
      );
      return;
    }

    const preferredDate = String(formData.get("date") || "");
    const preferredTime = String(formData.get("time") || "");

    if (!isOpenAppointmentDate(preferredDate)) {
      setFormMessage(
        bookingForm,
        "Please choose a Tuesday, Wednesday, Thursday, or Friday.",
        "error"
      );
      return;
    }

    if (preferredTime < "11:30" || preferredTime > "19:00") {
      setFormMessage(
        bookingForm,
        "Please choose a time between 11:30 AM and 7:00 PM.",
        "error"
      );
      return;
    }

    setSubmitting(bookingForm, true, "Sending request…");
    setFormMessage(bookingForm, "");

    const { error } = await db.from("appointments").insert({
      customer_name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim() || null,
      service: String(formData.get("service") || "").trim(),
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      notes: String(formData.get("notes") || "").trim() || null
    });

    setSubmitting(bookingForm, false);

    if (error) {
      console.error("Appointment submission failed:", error);
      setFormMessage(
        bookingForm,
        "We could not send your request. Please call (321) 264-0030.",
        "error"
      );
      return;
    }

    bookingForm.reset();
    if (appointmentDate) {
      const today = new Date();
      appointmentDate.min = new Date(
        today.getTime() - today.getTimezoneOffset() * 60000
      )
        .toISOString()
        .split("T")[0];
    }
    setFormMessage(
      bookingForm,
      "Your appointment request was sent. Hair Image will contact you to confirm it."
    );
  });
}

const contactForm = document.querySelector("#contact-form");
if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(contactForm);

    if (isHoneypotFilled(formData)) {
      contactForm.reset();
      setFormMessage(contactForm, "Thank you. Your message was sent.");
      return;
    }

    if (!db) {
      setFormMessage(
        contactForm,
        "The message system is temporarily unavailable. Please call (321) 264-0030.",
        "error"
      );
      return;
    }

    setSubmitting(contactForm, true, "Sending message…");
    setFormMessage(contactForm, "");

    const { error } = await db.from("messages").insert({
      customer_name: String(formData.get("name") || "").trim(),
      contact_information: String(formData.get("contact") || "").trim(),
      message: String(formData.get("message") || "").trim()
    });

    setSubmitting(contactForm, false);

    if (error) {
      console.error("Message submission failed:", error);
      setFormMessage(
        contactForm,
        "We could not send your message. Please call (321) 264-0030.",
        "error"
      );
      return;
    }

    contactForm.reset();
    setFormMessage(
      contactForm,
      "Your message was sent. Hair Image will get back to you as soon as possible."
    );
  });
}

const reviewForm = document.querySelector("#review-form");
if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(reviewForm);

    if (isHoneypotFilled(formData)) {
      reviewForm.reset();
      setFormMessage(reviewForm, "Thank you. Your review was submitted.");
      return;
    }

    if (!db) {
      setFormMessage(
        reviewForm,
        "The review system is temporarily unavailable.",
        "error"
      );
      return;
    }

    setSubmitting(reviewForm, true, "Submitting review…");
    setFormMessage(reviewForm, "");

    const { error } = await db.from("reviews").insert({
      customer_name: String(formData.get("name") || "").trim(),
      rating: Number(formData.get("rating")),
      review_text: String(formData.get("review") || "").trim()
    });

    setSubmitting(reviewForm, false);

    if (error) {
      console.error("Review submission failed:", error);
      setFormMessage(
        reviewForm,
        "We could not submit your review. Please try again later.",
        "error"
      );
      return;
    }

    reviewForm.reset();
    setFormMessage(
      reviewForm,
      "Thank you! Your review was submitted and is waiting for approval."
    );
  });
}

loadReviews();
