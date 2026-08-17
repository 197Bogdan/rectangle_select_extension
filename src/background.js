const browserAPI = globalThis.browser || globalThis.chrome;
const action = browserAPI.action || browserAPI.browserAction;
const storage = browserAPI.storage.local;

function updateBadge(enabled) {
    if (typeof action.setBadgeText === "function") {
        action.setBadgeText({
            text: enabled ? "●" : ""
        });
    }

    if (typeof action.setBadgeBackgroundColor === "function") {
        action.setBadgeBackgroundColor({
            color: "#1ee750"
        });
    }
}

storage.get("enabled", (result) => {
    updateBadge(Boolean(result.enabled));
});

browserAPI.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.enabled) {
        return;
    }

    updateBadge(Boolean(changes.enabled.newValue));
});

browserAPI.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-rectangle-selection") {
        return;
    }

    const result = await new Promise((resolve) => {
        storage.get("enabled", resolve);
    });

    const enabled = !(result.enabled ?? false);

    await new Promise((resolve) => {
        storage.set({ enabled }, resolve);
    });
});