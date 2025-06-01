// utils.js
export function $(id) {
  return document.getElementById(id);
}

export function showToast(msg = "", duration = 3300) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}
