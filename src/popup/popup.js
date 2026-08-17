const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const browserAPI = globalThis.browser || globalThis.chrome;
const storage = browserAPI.storage.local;

function updateUI(enabled) {
    status.textContent = enabled ? "ON" : "OFF";
    toggle.style.background = enabled ? "#4285f4" : "#eee";
    toggle.style.color = enabled ? "white" : "black";
}

storage.get("enabled", (result) => {
    updateUI(Boolean(result.enabled));
});

browserAPI.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.enabled) {
        return;
    }

    updateUI(Boolean(changes.enabled.newValue));
});

toggle.addEventListener("click", async () => {
    const result = await new Promise((resolve) => {
        storage.get("enabled", resolve);
    });

    const enabled = !(result.enabled ?? false);

    await new Promise((resolve) => {
        storage.set({ enabled }, resolve);
    });
});