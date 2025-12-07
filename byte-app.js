import { createByteAppContext } from "./byte-app-context.js";
import { setupBitGrid } from "./byte-app-grid.js";
import { setupGroups } from "./byte-app-groups.js";
import { setupImportExport } from "./byte-app-import-export.js";
import { setupMenus } from "./byte-app-menus.js";

document.addEventListener("DOMContentLoaded", () => {
	const ctx = createByteAppContext();
	if (!ctx) return;

	const gridApi = setupBitGrid(ctx);
	const groupsApi = setupGroups(ctx, gridApi);
	gridApi.setGroupsApi(groupsApi);

	const importExportApi = setupImportExport(ctx, gridApi, groupsApi);
	ctx.importExportApi = importExportApi;

	setupMenus(ctx, gridApi);

	// Restore last session from this browser if available
	if (importExportApi && typeof importExportApi.loadConfigurationFromLocalStorage === "function") {
		importExportApi.loadConfigurationFromLocalStorage();
	}

	// Wire up "Reset" button to clear everything and remove persisted state
	const { dom } = ctx;
	if (dom.resetAllBtnEl) {
		dom.resetAllBtnEl.addEventListener("click", () => {
			// Clear all groups and detach from bits
			groupsApi.clearAllGroups();

			// Reset grid to a single zero byte with default orders
			gridApi.applyBitOrder("msb");
			gridApi.applyByteOrder("msbyte");
			gridApi.setBytesFromArray([0]);

			// Reset controls
			if (dom.bytesHexInputEl) dom.bytesHexInputEl.value = "0x0";
			if (dom.groupLabelInputEl) dom.groupLabelInputEl.value = "";
			if (dom.selectModeEl) dom.selectModeEl.checked = false;

			gridApi.clearSelection();
			gridApi.updateSelectionControls();
			gridApi.updateRemoveVisibility();

			// Clear import/export UI and persisted configuration
			if (ctx.importExportApi) {
				if (typeof ctx.importExportApi.clearConfigurationFromLocalStorage === "function") {
					ctx.importExportApi.clearConfigurationFromLocalStorage();
				}
				if (typeof ctx.importExportApi.showImportExportStatus === "function") {
					ctx.importExportApi.showImportExportStatus("");
				}
			}
			if (dom.configBase64El) dom.configBase64El.value = "";
			if (dom.exportIncludeSetBitsEl) dom.exportIncludeSetBitsEl.checked = false;
		});
	}
});

