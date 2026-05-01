const modalOverlay = document.getElementById("modal-overlay");

export function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function showModal({ message, hasInput, defaultValue, placeholder, confirmLabel, confirmStyle }) {
  return new Promise(resolve => {
    const inputHtml = hasInput
      ? '<input class="modal-input" value="' + escapeAttr(defaultValue || "") + '" placeholder="' + escapeAttr(placeholder || "") + '">'
      : '';
    const confirmClass = confirmStyle === "danger" ? "danger" : "primary";
    modalOverlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-message">' + escapeHtml(message) + '</div>' +
        inputHtml +
        '<div class="modal-buttons">' +
          '<button class="modal-btn modal-cancel">Cancel</button>' +
          '<button class="modal-btn ' + confirmClass + ' modal-ok">' + escapeHtml(confirmLabel || "OK") + '</button>' +
        '</div>' +
      '</div>';
    modalOverlay.classList.add("show");

    const inputEl = modalOverlay.querySelector(".modal-input");
    const okBtn = modalOverlay.querySelector(".modal-ok");
    const cancelBtn = modalOverlay.querySelector(".modal-cancel");

    if (inputEl) {
      setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30);
    } else {
      setTimeout(() => okBtn.focus(), 30);
    }

    const cancelValue = hasInput ? null : false;
    const confirmValue = () => hasInput ? inputEl.value : true;

    function close(value) {
      modalOverlay.classList.remove("show");
      modalOverlay.innerHTML = "";
      document.removeEventListener("keydown", onKey, true);
      resolve(value);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        close(cancelValue);
      } else if (e.key === "Enter") {
        if (hasInput || document.activeElement === okBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          close(confirmValue());
        }
      }
    }
    okBtn.addEventListener("click", () => close(confirmValue()));
    cancelBtn.addEventListener("click", () => close(cancelValue));
    document.addEventListener("keydown", onKey, true);
  });
}

export function customConfirm(message, opts) {
  opts = opts || {};
  return showModal({
    message,
    hasInput: false,
    confirmLabel: opts.confirmLabel || "OK",
    confirmStyle: opts.confirmStyle,
  });
}

export function customPrompt(message, defaultValue, placeholder) {
  return showModal({
    message,
    hasInput: true,
    defaultValue: defaultValue || "",
    placeholder: placeholder || "",
    confirmLabel: "OK",
  });
}
