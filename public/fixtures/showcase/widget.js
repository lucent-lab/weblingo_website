(() => {
  document.documentElement.setAttribute("data-fixture-script-ready", "1");

  for (const toggle of document.querySelectorAll("[data-fixture-toggle]")) {
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      const output = document.querySelector("[data-fixture-output]");
      if (output) {
        output.textContent = expanded ? "Drawer closed" : "Drawer open";
      }
    });
  }
})();
