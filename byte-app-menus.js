export function setupMenus(ctx, gridApi) {
	const { dom, state } = ctx;

	function handleImportExportDocumentPointerDown(event) {
		if (!dom.importExportMenuEl || !dom.importExportToggleEl) return;
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (dom.importExportMenuEl.contains(target) || dom.importExportToggleEl.contains(target)) return;
		closeImportExportMenu();
	}

	function handleImportExportDocumentKeyDown(event) {
		if (event.key !== "Escape") return;
		if (!state.importExportMenuOpen) return;
		event.preventDefault();
		closeImportExportMenu();
		dom.importExportToggleEl?.focus();
	}

	function openImportExportMenu() {
		if (!dom.importExportMenuEl || !dom.importExportToggleEl || state.importExportMenuOpen) return;
		dom.importExportMenuEl.hidden = false;
		requestAnimationFrame(() => dom.importExportMenuEl.classList.add("open"));
		dom.importExportToggleEl.setAttribute("aria-expanded", "true");
		state.importExportMenuOpen = true;
		ctx.importExportApi?.showImportExportStatus("");
		dom.configBase64El?.focus();
		document.addEventListener("pointerdown", handleImportExportDocumentPointerDown);
		document.addEventListener("keydown", handleImportExportDocumentKeyDown);
	}

	function closeImportExportMenu() {
		if (!dom.importExportMenuEl || !dom.importExportToggleEl || !state.importExportMenuOpen) return;
		dom.importExportMenuEl.classList.remove("open");
		dom.importExportToggleEl.setAttribute("aria-expanded", "false");
		state.importExportMenuOpen = false;
		const onTransitionEnd = () => {
			dom.importExportMenuEl.hidden = true;
		};
		dom.importExportMenuEl.addEventListener("transitionend", onTransitionEnd, { once: true });
		setTimeout(() => {
			if (!state.importExportMenuOpen) dom.importExportMenuEl.hidden = true;
		}, 180);
		document.removeEventListener("pointerdown", handleImportExportDocumentPointerDown);
		document.removeEventListener("keydown", handleImportExportDocumentKeyDown);
	}

	function toggleImportExportMenu() {
		if (state.importExportMenuOpen) closeImportExportMenu();
		else openImportExportMenu();
	}

	function handleOptionsDocumentPointerDown(event) {
		if (!dom.optionsMenuEl || !dom.optionsToggleEl) return;
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (dom.optionsMenuEl.contains(target) || dom.optionsToggleEl.contains(target)) return;
		closeOptionsMenu();
	}

	function handleOptionsDocumentKeyDown(event) {
		if (event.key !== "Escape") return;
		if (!state.optionsMenuOpen) return;
		event.preventDefault();
		closeOptionsMenu();
		dom.optionsToggleEl?.focus();
	}

	function openOptionsMenu() {
		if (!dom.optionsMenuEl || !dom.optionsToggleEl || state.optionsMenuOpen) return;
		dom.optionsMenuEl.hidden = false;
		requestAnimationFrame(() => dom.optionsMenuEl.classList.add("open"));
		dom.optionsToggleEl.setAttribute("aria-expanded", "true");
		state.optionsMenuOpen = true;
		document.addEventListener("pointerdown", handleOptionsDocumentPointerDown);
		document.addEventListener("keydown", handleOptionsDocumentKeyDown);
		dom.bitOrderEl?.focus();
	}

	function closeOptionsMenu() {
		if (!dom.optionsMenuEl || !dom.optionsToggleEl || !state.optionsMenuOpen) return;
		dom.optionsMenuEl.classList.remove("open");
		dom.optionsToggleEl.setAttribute("aria-expanded", "false");
		state.optionsMenuOpen = false;
		const onTransitionEnd = () => {
			dom.optionsMenuEl.hidden = true;
		};
		dom.optionsMenuEl.addEventListener("transitionend", onTransitionEnd, { once: true });
		setTimeout(() => {
			if (!state.optionsMenuOpen) dom.optionsMenuEl.hidden = true;
		}, 180);
		document.removeEventListener("pointerdown", handleOptionsDocumentPointerDown);
		document.removeEventListener("keydown", handleOptionsDocumentKeyDown);
	}

	function toggleOptionsMenu() {
		if (state.optionsMenuOpen) closeOptionsMenu();
		else openOptionsMenu();
	}

	if (dom.importExportToggleEl) {
		dom.importExportToggleEl.addEventListener("click", toggleImportExportMenu);
	}
	if (dom.closeImportExportBtnEl) {
		dom.closeImportExportBtnEl.addEventListener("click", closeImportExportMenu);
	}
	if (dom.optionsToggleEl) {
		dom.optionsToggleEl.addEventListener("click", toggleOptionsMenu);
	}
	if (dom.closeOptionsBtnEl) {
		dom.closeOptionsBtnEl.addEventListener("click", closeOptionsMenu);
	}
	if (dom.byteOrderEl) {
		dom.byteOrderEl.addEventListener("change", () => {
			const val = String(dom.byteOrderEl.value).toLowerCase();
			gridApi.applyByteOrder(val === "lsbyte" ? "lsbyte" : "msbyte");
		});
	}
	if (dom.bitOrderEl) {
		dom.bitOrderEl.addEventListener("change", () => {
			const val = String(dom.bitOrderEl.value).toLowerCase();
			gridApi.applyBitOrder(val === "lsb" ? "lsb" : "msb");
		});
	}

	return {
		openImportExportMenu,
		closeImportExportMenu,
		openOptionsMenu,
		closeOptionsMenu,
	};
}


