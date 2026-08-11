const toggle = document.getElementById("toggle");
const status = document.getElementById("status");

function updateUI(enabled) {
    status.textContent = enabled ? "ON" : "OFF";
    toggle.style.background = enabled ? "#4285f4" : "#eee";
    toggle.style.color = enabled ? "white" : "black";
}

// Initial state
browser.storage.local.get("enabled").then((result) => {
    updateUI(result.enabled ?? false);
});

// Listen for changes made anywhere in the extension
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.enabled) {
        return;
    }

    updateUI(changes.enabled.newValue ?? false);
});

// Toggle from popup button
toggle.addEventListener("click", async () => {
    const result = await browser.storage.local.get("enabled");
    const enabled = !(result.enabled ?? false);

    await browser.storage.local.set({ enabled });
});