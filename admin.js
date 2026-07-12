const db = window.hairImageSupabase;

const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#admin-login-form");
const logoutButton = document.querySelector("#logout-button");
const refreshButton = document.querySelector("#refresh-dashboard");
const adminUserLabel = document.querySelector("#admin-user-label");
const appointmentFilter = document.querySelector("#appointment-filter");

const appointmentsList = document.querySelector("#appointments-list");
const messagesList = document.querySelector("#messages-list");
const reviewsList = document.querySelector("#admin-reviews-list");

let appointments = [];
let messages = [];
let reviews = [];
let isLoadingDashboard = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setLoginMessage(message, type = "error") {
  const status = loginForm.querySelector(".form-message");
  status.textContent = message;
  status.classList.remove("success", "error");
  if (message) status.classList.add(type);
}

function setLoginSubmitting(isSubmitting) {
  const button = loginForm.querySelector('button[type="submit"]');
  if (isSubmitting) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Signing in…";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || "Sign In";
    button.disabled = false;
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not provided";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(
    "en-US",
    includeTime
      ? {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }
      : {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric"
        }
  );
}

function formatRequestedDate(dateValue, timeValue) {
  if (!dateValue) return "No date selected";
  const date = new Date(`${dateValue}T12:00:00`);
  const formattedDate = Number.isNaN(date.getTime())
    ? dateValue
    : date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
      });

  if (!timeValue) return formattedDate;

  const [hours, minutes] = String(timeValue).split(":");
  const timeDate = new Date();
  timeDate.setHours(Number(hours), Number(minutes), 0, 0);
  const formattedTime = timeDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });

  return `${formattedDate} at ${formattedTime}`;
}

function statusLabel(status) {
  return String(status || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusOptions(current, values) {
  return values
    .map(
      (value) =>
        `<option value="${value}" ${value === current ? "selected" : ""}>${statusLabel(value)}</option>`
    )
    .join("");
}


function findEmailInText(value) {
  const match = String(value || "").match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );
  return match ? match[0] : "";
}

function findPhoneInText(value) {
  const match = String(value || "").match(
    /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/
  );
  return match ? match[0] : "";
}

function getMessageEmail(item) {
  return String(item.email || findEmailInText(item.contact_information)).trim();
}

function getMessagePhone(item) {
  return String(item.phone || findPhoneInText(item.contact_information)).trim();
}

function normalizePhoneForLink(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const hasLeadingPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return hasLeadingPlus ? `+${digits}` : digits;
}

function buildEmailReplyLink(item, email) {
  const subject = "Reply from Hair Image";
  const body = `Hi ${item.customer_name || "there"},

Thank you for contacting Hair Image.

`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderMessageReplyButtons(item) {
  const email = getMessageEmail(item);
  const phone = getMessagePhone(item);
  const phoneLink = normalizePhoneForLink(phone);
  const preferredMethod = String(item.preferred_contact_method || "").toLowerCase();

  const actions = {
    email: email
      ? `
        <a class="button ${preferredMethod === "email" ? "primary" : "secondary"} small-button reply-action-button"
           href="${escapeHtml(buildEmailReplyLink(item, email))}">
          Reply by Email${preferredMethod === "email" ? " · Preferred" : ""}
        </a>
      `
      : "",
    call: phoneLink
      ? `
        <a class="button ${preferredMethod === "call" ? "primary" : "secondary"} small-button reply-action-button"
           href="tel:${escapeHtml(phoneLink)}">
          Call${preferredMethod === "call" ? " · Preferred" : ""}
        </a>
      `
      : "",
    text: phoneLink
      ? `
        <a class="button ${preferredMethod === "text" ? "primary" : "secondary"} small-button reply-action-button"
           href="sms:${escapeHtml(phoneLink)}">
          Text${preferredMethod === "text" ? " · Preferred" : ""}
        </a>
      `
      : ""
  };

  const preferredAction = actions[preferredMethod] || "";
  const remainingActions = ["email", "text", "call"]
    .filter((method) => method !== preferredMethod)
    .map((method) => actions[method])
    .filter(Boolean);

  const buttons = [preferredAction, ...remainingActions].filter(Boolean);

  if (buttons.length === 0) {
    return '<p class="no-reply-contact">No usable email address or phone number was provided.</p>';
  }

  return `<div class="message-reply-actions">${buttons.join("")}</div>`;
}

function renderEmpty(container, text) {
  container.innerHTML = `<div class="admin-empty-state">${escapeHtml(text)}</div>`;
}

function updateStats() {
  document.querySelector("#pending-appointments-count").textContent =
    appointments.filter((item) => item.status === "pending").length;
  document.querySelector("#new-messages-count").textContent =
    messages.filter((item) => item.status === "new").length;
  document.querySelector("#pending-reviews-count").textContent =
    reviews.filter((item) => item.status === "pending").length;
}

function renderAppointments() {
  const selectedStatus = appointmentFilter.value;
  const filtered =
    selectedStatus === "all"
      ? appointments
      : appointments.filter((item) => item.status === selectedStatus);

  if (filtered.length === 0) {
    renderEmpty(
      appointmentsList,
      selectedStatus === "all"
        ? "No appointment requests yet."
        : `No ${selectedStatus} appointment requests.`
    );
    return;
  }

  appointmentsList.innerHTML = filtered
    .map(
      (item) => `
        <article class="admin-record-card">
          <div class="admin-record-top">
            <div>
              <span class="record-kicker">${escapeHtml(item.service)}</span>
              <h3>${escapeHtml(item.customer_name)}</h3>
            </div>
            <span class="status-chip status-${escapeHtml(item.status)}">
              ${escapeHtml(statusLabel(item.status))}
            </span>
          </div>

          <dl class="record-details">
            <div>
              <dt>Requested</dt>
              <dd>${escapeHtml(formatRequestedDate(item.preferred_date, item.preferred_time))}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>${escapeHtml(item.phone)}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>${escapeHtml(item.email || "Not provided")}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>${escapeHtml(formatDate(item.created_at, true))}</dd>
            </div>
          </dl>

          ${
            item.notes
              ? `<div class="record-note"><strong>Customer notes</strong><p>${escapeHtml(item.notes)}</p></div>`
              : ""
          }

          <div class="record-actions">
            <label>
              Status
              <select data-appointment-status="${escapeHtml(item.id)}">
                ${statusOptions(item.status, [
                  "pending",
                  "approved",
                  "declined",
                  "cancelled",
                  "completed"
                ])}
              </select>
            </label>
            <button class="button dark small-button" type="button"
              data-save-appointment="${escapeHtml(item.id)}">Save Status</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderMessages() {
  if (messages.length === 0) {
    renderEmpty(messagesList, "No customer messages yet.");
    return;
  }

  messagesList.innerHTML = messages
    .map((item) => {
      const email = getMessageEmail(item);
      const phone = getMessagePhone(item);

      return `
        <article class="admin-record-card">
          <div class="admin-record-top">
            <div>
              <span class="record-kicker">Customer message</span>
              <h3>${escapeHtml(item.customer_name)}</h3>
            </div>
            <span class="status-chip status-${escapeHtml(item.status)}">
              ${escapeHtml(statusLabel(item.status))}
            </span>
          </div>

          <dl class="record-details">
            <div>
              <dt>Email</dt>
              <dd>${escapeHtml(email || "Not provided")}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>${escapeHtml(phone || "Not provided")}</dd>
            </div>
            <div>
              <dt>Preferred contact</dt>
              <dd>${escapeHtml(statusLabel(item.preferred_contact_method || "not specified"))}</dd>
            </div>
            <div>
              <dt>Text consent</dt>
              <dd>${item.preferred_contact_method === "text" ? (item.sms_consent ? "Yes" : "No") : "Not applicable"}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>${escapeHtml(formatDate(item.created_at, true))}</dd>
            </div>
          </dl>

          <div class="record-note">
            <strong>Message</strong>
            <p>${escapeHtml(item.message)}</p>
          </div>

          ${renderMessageReplyButtons(item)}

          <div class="record-actions">
            <label>
              Status
              <select data-message-status="${escapeHtml(item.id)}">
                ${statusOptions(item.status, ["new", "read", "resolved"])}
              </select>
            </label>
            <button class="button dark small-button" type="button"
              data-save-message="${escapeHtml(item.id)}">Save Status</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderReviews() {
  if (reviews.length === 0) {
    renderEmpty(reviewsList, "No reviews have been submitted yet.");
    return;
  }

  reviewsList.innerHTML = reviews
    .map(
      (item) => `
        <article class="admin-record-card">
          <div class="admin-record-top">
            <div>
              <span class="record-kicker">${"★".repeat(Number(item.rating))}${"☆".repeat(5 - Number(item.rating))}</span>
              <h3>${escapeHtml(item.customer_name)}</h3>
            </div>
            <span class="status-chip status-${escapeHtml(item.status)}">
              ${escapeHtml(statusLabel(item.status))}
            </span>
          </div>

          <div class="record-note">
            <strong>Review</strong>
            <p>${escapeHtml(item.review_text)}</p>
          </div>

          <p class="record-timestamp">Submitted ${escapeHtml(formatDate(item.created_at, true))}</p>

          <div class="record-actions">
            <label>
              Status
              <select data-review-status="${escapeHtml(item.id)}">
                ${statusOptions(item.status, ["pending", "approved", "hidden"])}
              </select>
            </label>
            <button class="button dark small-button" type="button"
              data-save-review="${escapeHtml(item.id)}">Save Status</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderDashboard() {
  updateStats();
  renderAppointments();
  renderMessages();
  renderReviews();
}

async function verifyAdmin() {
  const { data, error } = await db.rpc("is_admin");

  if (error) {
    console.error("Admin verification failed:", error);
    return false;
  }

  return data === true;
}

async function loadDashboard() {
  if (!db || isLoadingDashboard) return;
  isLoadingDashboard = true;
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing…";

  appointmentsList.innerHTML = '<div class="admin-empty-state">Loading appointments…</div>';
  messagesList.innerHTML = '<div class="admin-empty-state">Loading messages…</div>';
  reviewsList.innerHTML = '<div class="admin-empty-state">Loading reviews…</div>';

  const [appointmentsResult, messagesResult, reviewsResult] = await Promise.all([
    db
      .from("appointments")
      .select("*")
      .order("preferred_date", { ascending: true })
      .order("preferred_time", { ascending: true }),
    db.from("messages").select("*").order("created_at", { ascending: false }),
    db.from("reviews").select("*").order("created_at", { ascending: false })
  ]);

  isLoadingDashboard = false;
  refreshButton.disabled = false;
  refreshButton.textContent = "Refresh";

  const firstError =
    appointmentsResult.error || messagesResult.error || reviewsResult.error;

  if (firstError) {
    console.error("Dashboard loading failed:", firstError);
    renderEmpty(
      appointmentsList,
      "The dashboard could not load. Refresh the page and try again."
    );
    renderEmpty(messagesList, "Messages could not be loaded.");
    renderEmpty(reviewsList, "Reviews could not be loaded.");
    return;
  }

  appointments = appointmentsResult.data || [];
  messages = messagesResult.data || [];
  reviews = reviewsResult.data || [];
  renderDashboard();
}

async function showDashboard(session) {
  const allowed = await verifyAdmin();

  if (!allowed) {
    await db.auth.signOut();
    showLogin("This account is not approved as a Hair Image administrator.");
    return;
  }

  loginView.hidden = true;
  dashboardView.hidden = false;
  logoutButton.hidden = false;
  refreshButton.hidden = false;
  adminUserLabel.textContent = session.user.email || "Administrator";
  await loadDashboard();
}

function showLogin(message = "") {
  loginView.hidden = false;
  dashboardView.hidden = true;
  logoutButton.hidden = true;
  refreshButton.hidden = true;
  adminUserLabel.textContent = "";
  if (message) setLoginMessage(message, "error");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!db) {
    setLoginMessage("The login system could not connect. Please try again later.");
    return;
  }

  setLoginSubmitting(true);
  setLoginMessage("");

  const email = document.querySelector("#admin-email").value.trim();
  const password = document.querySelector("#admin-password").value;

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  setLoginSubmitting(false);

  if (error || !data.session) {
    console.error("Login failed:", error);
    setLoginMessage("The email or password was not accepted.");
    return;
  }

  loginForm.reset();
  await showDashboard(data.session);
});

logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  showLogin("You have been signed out.");
  setLoginMessage("You have been signed out.", "success");
});

refreshButton.addEventListener("click", loadDashboard);
appointmentFilter.addEventListener("change", renderAppointments);

appointmentsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-appointment]");
  if (!button) return;

  const id = button.dataset.saveAppointment;
  const select = appointmentsList.querySelector(
    `[data-appointment-status="${CSS.escape(id)}"]`
  );
  const status = select.value;

  button.disabled = true;
  button.textContent = "Saving…";

  const { error } = await db
    .from("appointments")
    .update({ status })
    .eq("id", id);

  button.disabled = false;
  button.textContent = "Save Status";

  if (error) {
    console.error("Appointment update failed:", error);
    alert("The appointment status could not be updated.");
    return;
  }

  const item = appointments.find((entry) => entry.id === id);
  if (item) item.status = status;
  renderDashboard();
});

messagesList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-message]");
  if (!button) return;

  const id = button.dataset.saveMessage;
  const select = messagesList.querySelector(
    `[data-message-status="${CSS.escape(id)}"]`
  );
  const status = select.value;

  button.disabled = true;
  button.textContent = "Saving…";

  const { error } = await db.from("messages").update({ status }).eq("id", id);

  button.disabled = false;
  button.textContent = "Save Status";

  if (error) {
    console.error("Message update failed:", error);
    alert("The message status could not be updated.");
    return;
  }

  const item = messages.find((entry) => entry.id === id);
  if (item) item.status = status;
  renderDashboard();
});

reviewsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-review]");
  if (!button) return;

  const id = button.dataset.saveReview;
  const select = reviewsList.querySelector(
    `[data-review-status="${CSS.escape(id)}"]`
  );
  const status = select.value;

  button.disabled = true;
  button.textContent = "Saving…";

  const changes = {
    status,
    approved_at: status === "approved" ? new Date().toISOString() : null
  };

  const { error } = await db.from("reviews").update(changes).eq("id", id);

  button.disabled = false;
  button.textContent = "Save Status";

  if (error) {
    console.error("Review update failed:", error);
    alert("The review status could not be updated.");
    return;
  }

  const item = reviews.find((entry) => entry.id === id);
  if (item) {
    item.status = status;
    item.approved_at = changes.approved_at;
  }
  renderDashboard();
});

async function initializeAdmin() {
  if (!db) {
    showLogin("The login system could not connect. Please try again later.");
    return;
  }

  const {
    data: { session },
    error
  } = await db.auth.getSession();

  if (error) {
    console.error("Could not restore admin session:", error);
    showLogin();
    return;
  }

  if (session) {
    await showDashboard(session);
  } else {
    showLogin();
  }
}

initializeAdmin();
