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
});


