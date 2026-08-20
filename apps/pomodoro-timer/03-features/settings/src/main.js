import { mountSettingsForm } from "./ui.js";

const container = document.getElementById("settings-root");
if (container) {
  mountSettingsForm(container);
}
