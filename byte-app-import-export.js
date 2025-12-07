export function setupImportExport(ctx, gridApi, groupsApi) {
	const { dom, groups, state } = ctx;
	const LOCAL_STORAGE_KEY = "bitdocumenter-byte-visualizer-v1";

	function showImportExportStatus(message, isError = false) {
		if (!dom.importExportStatusEl) return;
		dom.importExportStatusEl.textContent = message;
		if (!message) {
			delete dom.importExportStatusEl.dataset.state;
		} else {
			dom.importExportStatusEl.dataset.state = isError ? "error" : "success";
		}
	}

	function downloadTextFile(filename, content) {
		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
		URL.revokeObjectURL(url);
	}

	function encodeToBase64Utf8(str) {
		const encoder = new TextEncoder();
		const data = encoder.encode(str);
		let binary = "";
		data.forEach((byte) => {
			binary += String.fromCharCode(byte);
		});
		return btoa(binary);
	}

	function decodeFromBase64Utf8(base64) {
		const binary = atob(base64);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		const decoder = new TextDecoder();
		return decoder.decode(bytes);
	}

	function buildExportPayload(includeSetBits) {
		gridApi.updateBitDatasets();
		const bytes = gridApi.getBytesArrayFromGrid();
		const groupsData = Array.from(groups.values()).map((group) => {
			const bits = group.bits.map((bit) => gridApi.getBitCoordinates(bit));
			return {
				id: group.id,
				label: group.label,
				type: group.type,
				decoderSource: group.decoderSource,
				flagsDescriptionSource: group.flagsDescriptionSource,
				colorIndex: group.colorIndex,
				bits,
			};
		});
		const payload = {
			version: 1,
			exportedAt: new Date().toISOString(),
			bitOrder: state.bitOrder,
			byteOrder: state.byteOrder,
			bytes,
			groups: groupsData,
		};
		if (includeSetBits) {
			payload.setBits = gridApi.collectSetBits();
		}
		payload.hex = bytes.length ? "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase() : "0x0";
		return payload;
	}

	function generateExportFilename() {
		return `bitdocumenter-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
	}

	function generatePdfFilename() {
		return `bitdocumenter-groups-${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;
	}

	function exportGroupsToPdf() {
		try {
			if (groups.size === 0) {
				throw new Error("Create at least one group before exporting.");
			}
			const jspdfLib = window.jspdf;
			if (!jspdfLib || typeof jspdfLib.jsPDF !== "function") {
				throw new Error("PDF library failed to load.");
			}
			const doc = new jspdfLib.jsPDF({ unit: "pt", format: "a4" });
			const margin = 48;
			const lineHeight = 16;
			const pageHeight = doc.internal.pageSize.getHeight();
			const pageWidth = doc.internal.pageSize.getWidth();
			const maxWidth = pageWidth - margin * 2;
			let y = margin;

			function ensureSpace(lines = 1) {
				if (y + lineHeight * lines > pageHeight - margin) {
					doc.addPage();
					y = margin;
				}
			}

			function appendLines(text, fontSize = 12, font = "helvetica", gap = lineHeight) {
				if (!text) return;
				doc.setFont(font, "normal");
				doc.setFontSize(fontSize);
				const lines = doc.splitTextToSize(text, maxWidth);
				lines.forEach((line) => {
					ensureSpace();
					doc.text(line, margin, y);
					y += gap;
				});
				y += 4;
			}

			function appendCodeBlock(text) {
				if (!text) return;
				doc.setFont("courier", "normal");
				doc.setFontSize(10);
				const lines = doc.splitTextToSize(text, maxWidth);
				lines.forEach((line) => {
					ensureSpace();
					doc.text(line, margin, y);
					y += lineHeight;
				});
				y += 6;
			}

			doc.setFont("helvetica", "bold");
			doc.setFontSize(18);
			doc.text("BitDocumenter Groups", margin, y);
			y += lineHeight * 1.5;
			doc.setFont("helvetica", "normal");
			doc.setFontSize(11);
			doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
			y += lineHeight * 2;

			for (const group of groups.values()) {
				ensureSpace(4);
				doc.setFont("helvetica", "bold");
				doc.setFontSize(14);
				doc.text(group.label, margin, y);
				y += lineHeight;
				doc.setFont("helvetica", "normal");
				doc.setFontSize(11);

				const typeLabel = group.type === "value" ? "Value" : "Flags";
				appendLines(`Type: ${typeLabel}`);
				const bitSummary = group.bits.map((bit, idx) => {
					const { byteIndex, bitIndex } = gridApi.getBitCoordinates(bit);
					return `#${idx + 1}: Byte ${byteIndex}, Bit ${bitIndex}`;
				}).join("; ");
				appendLines(`Bits: ${bitSummary || "None"}`);

				if (group.type === "value") {
					appendLines("Decode function:");
					appendCodeBlock((group.decoderSource || ctx.constants.defaultDecoder).trim());
				} else {
					appendLines("Flags description:");
					appendCodeBlock((group.flagsDescriptionSource || ctx.constants.defaultFlagsDescriptions).trim());
				}

				y += lineHeight;
			}

			doc.save(generatePdfFilename());
			showImportExportStatus("Exported PDF with group decoders.", false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			showImportExportStatus(`PDF export failed: ${message}`, true);
		}
	}

	function applyConfigurationPayload(payload) {
		if (!payload || typeof payload !== "object") {
			throw new Error("Configuration payload is malformed.");
		}

		const bytes = Array.isArray(payload.bytes) ? payload.bytes : undefined;
		groupsApi.clearAllGroups();
		gridApi.setBytesFromArray(bytes);

		const order = payload.bitOrder === "lsb" ? "lsb" : "msb";
		gridApi.applyBitOrder(order);
		const byteOrderValue = payload.byteOrder === "lsbyte" ? "lsbyte" : "msbyte";
		gridApi.applyByteOrder(byteOrderValue);

		if (Array.isArray(payload.groups)) {
			payload.groups.forEach(groupsApi.addGroupFromSerialized);
		}
		groupsApi.renderGroups();
		groupsApi.updateGroupsOutputs();
		gridApi.updateSelectionControls();
		gridApi.updateRemoveVisibility();
	}

	function importConfigurationFromBase64(base64Text) {
		try {
			const normalized = (base64Text || "").replace(/\s+/g, "");
			if (!normalized) {
				throw new Error("Provide a Base64 configuration before importing.");
			}
			const decoded = decodeFromBase64Utf8(normalized);
			const payload = JSON.parse(decoded);
			applyConfigurationPayload(payload);
			showImportExportStatus("Import successful.", false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			showImportExportStatus(`Import failed: ${message}`, true);
		}
	}

	function exportConfiguration() {
		if (!dom.configBase64El) return;
		try {
			const includeSetBits = dom.exportIncludeSetBitsEl ? !!dom.exportIncludeSetBitsEl.checked : false;
			const payload = buildExportPayload(includeSetBits);
			const json = JSON.stringify(payload, null, 2);
			const base64 = encodeToBase64Utf8(json);
			dom.configBase64El.value = base64;
			const filename = generateExportFilename();
			downloadTextFile(filename, base64);
			showImportExportStatus(`Exported configuration to ${filename}.`, false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			showImportExportStatus(`Export failed: ${message}`, true);
		}
	}

	async function copyConfigurationToClipboard() {
		if (!dom.configBase64El) return;
		const text = (dom.configBase64El.value || "").trim();
		if (!text) {
			showImportExportStatus("Nothing to copy. Export or import a configuration first.", true);
			return;
		}
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				dom.configBase64El.focus();
				dom.configBase64El.select();
				const successful = document.execCommand("copy");
				window.getSelection()?.removeAllRanges();
				if (!successful) {
					throw new Error("Copy command failed.");
				}
			}
			showImportExportStatus("Configuration copied to clipboard.", false);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			showImportExportStatus(`Copy failed: ${message}`, true);
		}
	}

	function applyHexBytesInput() {
		if (!dom.bytesHexInputEl) return;
		let raw = dom.bytesHexInputEl.value.trim();
		if (raw === "") return;
		raw = raw.replace(/^0x/i, "").replace(/[\s_]/g, "");
		if (raw !== "" && !/^[0-9a-fA-F]+$/.test(raw)) {
			return;
		}
		if (raw.length % 2 === 1) raw = "0" + raw;
		const bytes = [];
		if (raw.length > 0) {
			for (let i = 0; i < raw.length; i += 2) {
				bytes.push(parseInt(raw.slice(i, i + 2), 16));
			}
		} else {
			bytes.push(0);
		}

		gridApi.setBytesFromArray(bytes);

		let hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
		hex = hex.replace(/^0+/, "") || "0";
		dom.bytesHexInputEl.value = "0x" + hex;
	}

	function sanitizeHexField() {
		if (!dom.bytesHexInputEl) return;
		let s = dom.bytesHexInputEl.value || "";
		s = s.trim();
		let prefix = "";
		if (/^0[xX]/.test(s)) {
			prefix = "0x";
			s = s.slice(2);
		}
		s = s.replace(/[^0-9a-fA-F]/g, "");
		dom.bytesHexInputEl.value = (prefix ? "0x" : "") + s.toUpperCase();
	}

	if (dom.bytesHexInputEl) {
		dom.bytesHexInputEl.addEventListener("input", () => {
			sanitizeHexField();
			applyHexBytesInput();
		});
	}
	if (dom.exportConfigBtnEl) {
		dom.exportConfigBtnEl.addEventListener("click", exportConfiguration);
	}
	if (dom.copyConfigBtnEl) {
		dom.copyConfigBtnEl.addEventListener("click", copyConfigurationToClipboard);
	}
	if (dom.importConfigBtnEl) {
		dom.importConfigBtnEl.addEventListener("click", () => {
			if (!dom.configBase64El) return;
			importConfigurationFromBase64(dom.configBase64El.value);
		});
	}
	if (dom.exportPdfBtnEl) {
		dom.exportPdfBtnEl.addEventListener("click", exportGroupsToPdf);
	}

	function saveConfigurationToLocalStorage() {
		try {
			const payload = buildExportPayload(true);
			const json = JSON.stringify(payload);
			if (typeof window !== "undefined" && window.localStorage) {
				window.localStorage.setItem(LOCAL_STORAGE_KEY, json);
			}
		} catch (error) {
			console.error("Error saving configuration to local storage:", error);
			// Ignore persistence errors
		}
	}

	function loadConfigurationFromLocalStorage() {
		try {
			if (typeof window === "undefined" || !window.localStorage) return false;
			const json = window.localStorage.getItem(LOCAL_STORAGE_KEY);
			if (!json) return false;
			const payload = JSON.parse(json);
			applyConfigurationPayload(payload);
			showImportExportStatus("Restored last session from this browser.", false);
			return true;
		} catch {
			return false;
		}
	}

	function clearConfigurationFromLocalStorage() {
		try {
			if (typeof window === "undefined" || !window.localStorage) return;
			window.localStorage.removeItem(LOCAL_STORAGE_KEY);
		} catch {
			// Ignore persistence errors
		}
	}

	let autosaveTimer = null;
	if (typeof window !== "undefined") {
		// Fallback: still attempt to save right before unload
		if (window.addEventListener) {
			window.addEventListener("beforeunload", saveConfigurationToLocalStorage);
		}
		// Primary autosave: persist the current configuration once per second
		autosaveTimer = window.setInterval(() => {
			saveConfigurationToLocalStorage();
		}, 1000);
	}

	return {
		showImportExportStatus,
		importConfigurationFromBase64,
		saveConfigurationToLocalStorage,
		loadConfigurationFromLocalStorage,
		clearConfigurationFromLocalStorage,
	};
}


