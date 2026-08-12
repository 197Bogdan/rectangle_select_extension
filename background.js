function updateBadge(enabled) {
    browser.action.setBadgeText({
        text: enabled ? "●" : ""
    });

    browser.action.setBadgeBackgroundColor({
        color: "#1ee750"
    });
}

// Initial state
browser.storage.local.get("enabled").then((result) => {
    updateBadge(result.enabled ?? false);
});

// Listen for changes made anywhere in the extension
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.enabled) {
        return;
    }

    updateBadge(changes.enabled.newValue ?? false);
});

// Keyboard shortcut
browser.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-rectangle-selection") {
        return;
    }

    const result =
        await browser.storage.local.get("enabled");

    const enabled =
        !(result.enabled ?? false);

    await browser.storage.local.set({
        enabled
    });
});