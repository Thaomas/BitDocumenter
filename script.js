document.addEventListener("DOMContentLoaded", () => {
	const yearEl = document.getElementById("year");
	if (yearEl) {
		yearEl.textContent = String(new Date().getFullYear());
	}

	const ctaButton = document.getElementById("ctaButton");
	if (ctaButton) {
		ctaButton.addEventListener("click", () => {
			const features = document.getElementById("features");
			if (features) {
				features.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		});
	}

	// Byte visualizer page
	const byteApp = document.getElementById("byteApp");
	if (byteApp) {
		const bytesContainer = document.getElementById("bytesContainer");
		const groupsContainer = document.getElementById("groupsContainer");
		const addByteBtn = document.getElementById("addByteBtn");
		const removeByteBtn = document.getElementById("removeByteBtn");
		const selectModeCheckbox = document.getElementById("selectMode");
		const groupSelectedBtn = document.getElementById("groupSelectedBtn");
		const clearSelectedBtn = document.getElementById("clearSelectedBtn");
		const groupLabelInput = document.getElementById("groupLabelInput");
		const bitOrderSelect = document.getElementById("bitOrder");
		const bytesHexInput = document.getElementById("bytesHexInput");
		const exportConfigBtn = document.getElementById("exportConfigBtn");
		const copyConfigBtn = document.getElementById("copyConfigBtn");
		const importConfigBtn = document.getElementById("importConfigBtn");
		const configBase64Textarea = document.getElementById("configBase64");
		const importExportStatus = document.getElementById("importExportStatus");
		const exportIncludeSetBitsCheckbox = document.getElementById("exportIncludeSetBits");
		const importExportToggle = document.getElementById("importExportToggle");
		const importExportMenu = document.getElementById("importExportMenu");
		const closeImportExportBtn = document.getElementById("closeImportExportBtn");
		const optionsToggle = document.getElementById("optionsToggle");
		const optionsMenu = document.getElementById("optionsMenu");
		const closeOptionsBtn = document.getElementById("closeOptionsBtn");
		const byteOrderSelect = document.getElementById("byteOrder");

		if (!bytesContainer || !addByteBtn || !removeByteBtn || !groupsContainer || !selectModeCheckbox || !groupSelectedBtn || !clearSelectedBtn || !groupLabelInput) return;

		/** @type {"msb"|"lsb"} */
		let bitOrder = "msb";
		let importExportMenuOpen = false;
		let optionsMenuOpen = false;
		/** @type {"msbyte"|"lsbyte"} */
		let byteOrder = "msbyte";

		let groupIdCounter = 0;
		const groupColors = [
			"rgba(255, 99, 132, 1)",
			"rgba(255, 205, 86, 1)",
			"rgba(75, 192, 192, 1)",
			"rgba(153, 102, 255, 1)",
			"rgba(255, 159, 64, 1)",
			"rgba(54, 162, 235, 1)",
		];
		// id -> { id, label, bits: HTMLElement[], colorIndex, type, decoderSource, flagsDescriptionSource, els }
		const groups = new Map();

		const defaultDecoder = `function decode(bits) {\n  // bits: array of 0/1 in selected order\n  // MSB-first: bits[0] is most significant; LSB-first: bits[0] is least significant\n  let value = 0;\n  for (const b of bits) value = (value << 1) | b;\n  return value;\n}`;
		const defaultFlagsDescriptions = '{"0":"Flag 0|No Flag 0","1":{"1":"Flag 1 set","0":"Flag 1 clear"}}';

		function createBit(initialOn, byteIndex, bitIndex) {
			const el = document.createElement("button");
			el.className = "bit" + (initialOn ? " on" : "");
			el.type = "button";
			el.textContent = initialOn ? "1" : "0";
			el.dataset.byteIndex = String(byteIndex);
			el.dataset.bitIndex = String(bitIndex);
			el.addEventListener("click", () => {
				if (!selectModeCheckbox.checked) {
					el.classList.toggle("selected");
					updateSelectionControls();
				} else {
					const isOn = el.classList.toggle("on");
					el.textContent = isOn ? "1" : "0";
					updateGroupsOutputs();
					updateHexInputFromGrid();
				}
			});
			return el;
		}

		function createByteRow(byteIndex) {
			const row = document.createElement("div");
			row.className = "byte-row";
			for (let i = 0; i < 8; i++) {
				row.appendChild(createBit(false, byteIndex, i));
			}
			return row;
		}

		function updateBitDatasets() {
			const rows = bytesContainer.querySelectorAll(".byte-row");
			rows.forEach((row, byteIdx) => {
				const bits = row.querySelectorAll(".bit");
				bits.forEach((bit, bitIdx) => {
					bit.dataset.byteIndex = String(byteIdx);
					bit.dataset.bitIndex = String(bitIdx);
				});
			});
		}

		function applyBitOrder(order) {
			const normalized = order === "lsb" ? "lsb" : "msb";
			bitOrder = normalized;
			if (bitOrderSelect) {
				bitOrderSelect.value = normalized;
			}
			bytesContainer.querySelectorAll(".byte-row").forEach((row) => {
				if (normalized === "lsb") row.classList.add("lsb");
				else row.classList.remove("lsb");
			});
			updateGroupsOutputs();
		}

		function applyByteOrder(order) {
			const normalized = order === "lsbyte" ? "lsbyte" : "msbyte";
			byteOrder = normalized;
			if (byteOrderSelect) {
				byteOrderSelect.value = normalized;
			}
			if (bytesContainer) {
				if (normalized === "lsbyte") bytesContainer.classList.add("lsbyte");
				else bytesContainer.classList.remove("lsbyte");
			}
			updateHexInputFromGrid();
		}

		function getBitCoordinates(bitEl) {
			const byteIndex = Number(bitEl.dataset.byteIndex);
			const bitIndex = Number(bitEl.dataset.bitIndex);
			if (Number.isFinite(byteIndex) && Number.isFinite(bitIndex)) {
				return { byteIndex, bitIndex };
			}
			const parent = bitEl.parentElement;
			const rows = Array.from(bytesContainer.querySelectorAll(".byte-row"));
			const rowIndex = rows.indexOf(parent);
			const bits = parent ? Array.from(parent.querySelectorAll(".bit")) : [];
			const idx = bits.indexOf(bitEl);
			return { byteIndex: rowIndex, bitIndex: idx };
		}

		function getBitElement(byteIndex, bitIndex) {
			const rows = bytesContainer.querySelectorAll(".byte-row");
			const row = rows[byteIndex];
			if (!row) return null;
			const bits = row.querySelectorAll(".bit");
			return bits[bitIndex] || null;
		}

		function attachBitsToGroup(id, colorIndex, bits) {
			bits.forEach((bit) => {
				bit.classList.remove("selected");
				const cls = `group-${colorIndex}`;
				bit.classList.add(cls);
				if (bit.dataset.groupIds) {
					const existing = bit.dataset.groupIds.split(",").filter(Boolean);
					if (!existing.includes(id)) {
						existing.push(id);
						bit.dataset.groupIds = existing.join(",");
					}
				} else {
					bit.dataset.groupIds = id;
				}
			});
		}

		function detachBitsFromGroup(id, colorIndex, bits) {
			bits.forEach((bit) => {
				const cls = `group-${colorIndex}`;
				const ids = (bit.dataset.groupIds || "").split(",").filter(Boolean);
				const remaining = ids.filter(gid => gid !== id);
				if (remaining.length) {
					bit.dataset.groupIds = remaining.join(",");
				} else {
					delete bit.dataset.groupIds;
				}
				if (!remaining.some(gid => {
					const group = groups.get(gid);
					return group && group.colorIndex === colorIndex;
				})) {
					bit.classList.remove(cls);
				}
			});
		}

		function updateGroupIdCounterFromId(id) {
			const match = /^g(\d+)$/.exec(id);
			if (match) {
				const num = Number(match[1]);
				if (Number.isFinite(num) && num >= groupIdCounter) {
					groupIdCounter = num + 1;
				}
			}
		}

		function updateRemoveVisibility() {
			const count = bytesContainer.querySelectorAll(".byte-row").length;
			removeByteBtn.hidden = count <= 1;
			if (!removeByteBtn.hidden) {
				const rows = bytesContainer.querySelectorAll(".byte-row");
				const last = rows[rows.length - 1];
				const hasGroupsInLast = last ? Array.from(last.querySelectorAll(".bit")).some(b => !!b.dataset.groupIds) : false;
				removeByteBtn.disabled = hasGroupsInLast;
			}
		}

		function updateSelectionControls() {
			const someSelected = bytesContainer.querySelector(".bit.selected") !== null;
			groupSelectedBtn.disabled = !someSelected;
			clearSelectedBtn.disabled = !someSelected;
		}

		function clearSelection() {
			bytesContainer.querySelectorAll(".bit.selected").forEach(b => b.classList.remove("selected"));
			updateSelectionControls();
		}

		function addGroupFromSelection() {
			const selectedBits = Array.from(bytesContainer.querySelectorAll(".bit.selected"));
			if (selectedBits.length === 0) return;

			const label = groupLabelInput.value.trim() || `Group ${groupIdCounter + 1}`;
			const id = `g${groupIdCounter++}`;
			const colorIndex = groupColors.length ? (groupIdCounter - 1) % groupColors.length : 0;

			attachBitsToGroup(id, colorIndex, selectedBits);

			groups.set(id, { id, label, bits: selectedBits, colorIndex, type: "flags", decoderSource: defaultDecoder, flagsDescriptionSource: defaultFlagsDescriptions, els: {} });
			renderGroups();
			updateSelectionControls();
			updateGroupsOutputs();
		}

		function removeGroup(id) {
			const group = groups.get(id);
			if (!group) return;
			detachBitsFromGroup(id, group.colorIndex, group.bits);
			groups.delete(id);
			renderGroups();
			updateGroupsOutputs();
		}

		function getBitsValues(bits) {
			return bits.map(b => b.classList.contains("on") ? 1 : 0);
		}

		function computeFlagsOutput(group) {
			const orderedBits = bitOrder === "msb" ? group.bits : group.bits.slice().reverse();
			const vals = getBitsValues(orderedBits);
			const setIdx = vals.map((v, i) => [v, i]).filter(([v]) => v === 1).map(([, i]) => i);
			let descMap = {};
			let parseError = "";
			try {
				descMap = group.flagsDescriptionSource ? JSON.parse(group.flagsDescriptionSource) : {};
			} catch (e) {
				parseError = e instanceof Error ? e.message : String(e);
			}

			// Build outputs supporting per-bit labels for 1 and 0
			const labeledOutputs = [];
			if (descMap && typeof descMap === "object") {
				for (const key of Object.keys(descMap)) {
					const idx = Number(key);
					if (!Number.isFinite(idx)) continue;
					const bitVal = vals[idx] ?? 0;
					const raw = descMap[key];

					let chosenLabel = "";
					if (raw && typeof raw === "object") {
						// { "1": "On label", "0": "Off label" }
						const map1 = raw;
						if (bitVal === 1 && typeof map1["1"] === "string") chosenLabel = map1["1"];
						else if (bitVal === 0 && typeof map1["0"] === "string") chosenLabel = map1["0"];
					} else if (typeof raw === "string") {
						// "On|Off" or "On" (only when 1)
						if (raw.includes("|")) {
							const [onText, offText = ""] = raw.split("|");
							chosenLabel = bitVal === 1 ? onText : offText;
						} else {
							chosenLabel = bitVal === 1 ? raw : "";
						}
					}

					if (chosenLabel) {
						labeledOutputs.push(`${idx}: ${chosenLabel}`);
					}
				}
			}

			if (labeledOutputs.length > 0) {
				// Show each chosenLabel on its own line
				return { text: `Labels:\n${labeledOutputs.join("\n")}`, error: parseError };
			}

			// Fallback to previous "set bits" behavior
			const described = setIdx.map(i => (descMap && Object.prototype.hasOwnProperty.call(descMap, String(i))) ? `${i}:${descMap[String(i)]}` : String(i));
			return { text: setIdx.length ? `Set: [${described.join(", ")}]` : "Set: none", error: parseError };
		}

		function computeValueOutput(group) {
			// Always use MSB->LSB DOM order for decoding; visual order does not affect decode
			const bits = getBitsValues(group.bits);
			try {
				const fn = new Function("bits", `${group.decoderSource}\n; if (typeof decode !== 'function') { throw new Error('Define function decode(bits)'); } return decode(bits);`);
				const result = fn(bits);
				return { value: String(result), error: "" };
			} catch (e) {
				return { value: "", error: e instanceof Error ? e.message : String(e) };
			}
		}

		function updateGroupsOutputs() {
			for (const group of groups.values()) {
				if (!group.els.outputEl || !group.els.errorEl) continue;
				if (group.type === "flags") {
					const { text, error } = computeFlagsOutput(group);
					group.els.outputEl.textContent = text;
					group.els.errorEl.textContent = error;
				} else {
					const { value, error } = computeValueOutput(group);
					group.els.outputEl.textContent = value ? `Decoded: ${value}` : "";
					group.els.errorEl.textContent = error;
				}
			}
		}

		function openGroupSettingsModal(group) {
			const modal = document.getElementById("groupSettingsModal");
			const labelEl = document.getElementById("gsLabel");
			const typeEl = document.getElementById("gsType");
			const decoderWrap = document.getElementById("gsDecoderWrap");
			const decoderEl = document.getElementById("gsDecoder");
			const flagsWrap = document.getElementById("gsFlagsWrap");
			const flagsEl = document.getElementById("gsFlagsDescriptions");
			const flagsModeEl = document.getElementById("gsFlagsMode");
			const flagsFieldsWrap = document.getElementById("gsFlagsFields");
			const flagsListEl = document.getElementById("gsFlagsList");
			const addFlagRowBtn = document.getElementById("gsAddFlagRow");
			const flagsPrettyEl = document.getElementById("gsFlagsPretty");
			const saveBtn = document.getElementById("gsSave");
			const deleteBtn = document.getElementById("gsDelete");
			const cancelBtns = modal.querySelectorAll("[data-close-modal]");

			labelEl.value = group.label;
			typeEl.value = group.type;
			decoderEl.value = group.decoderSource || defaultDecoder;
			flagsEl.value = group.flagsDescriptionSource || defaultFlagsDescriptions;
			decoderWrap.hidden = group.type !== "value";
			flagsWrap.hidden = group.type !== "flags";

			// Flags fields helpers
			function parseFlagsMapFromJson(jsonText) {
				try {
					const obj = JSON.parse(jsonText || "{}");
					if (!obj || typeof obj !== "object") return {};
					return obj;
				} catch {
					return {};
				}
			}
			function addFlagRow(bitIdx = "", onLabel = "", offLabel = "") {
				if (!flagsListEl) return;
				const row = document.createElement("div");
				row.className = "flags-row";
				const bit = document.createElement("input");
				bit.type = "number";
				bit.min = "0";
				bit.placeholder = "0";
				bit.value = bitIdx === "" ? "" : String(bitIdx);
				const on = document.createElement("input");
				on.type = "text";
				on.placeholder = "On 1 label (optional)";
				on.value = onLabel;
				const off = document.createElement("input");
				off.type = "text";
				off.placeholder = "On 0 label (optional)";
				off.value = offLabel;
				const remove = document.createElement("button");
				remove.type = "button";
				remove.className = "row-remove";
				remove.textContent = "Remove";
				remove.addEventListener("click", () => row.remove());
				row.appendChild(bit);
				row.appendChild(on);
				row.appendChild(off);
				row.appendChild(remove);
				flagsListEl.appendChild(row);
			}
			function buildFieldsFromMap(map, totalBits) {
				if (!flagsListEl) return;
				flagsListEl.innerHTML = "";
				const keysSet = new Set(Object.keys(map).filter(k => Number.isFinite(Number(k))));
				const count = Number.isFinite(Number(totalBits)) ? Number(totalBits) : 0;
				// Always render rows for all bit indices in the group
				for (let i = 0; i < count; i++) {
					const k = String(i);
					const v = keysSet.has(k) ? map[k] : undefined;
					let on = "", off = "";
					if (v && typeof v === "object" && !Array.isArray(v)) {
						on = typeof v["1"] === "string" ? v["1"] : "";
						off = typeof v["0"] === "string" ? v["0"] : "";
					} else if (typeof v === "string") {
						if (v.includes("|")) {
							const [onText, offText = ""] = v.split("|");
							on = onText;
							off = offText;
						} else {
							on = v;
						}
					}
					addFlagRow(i, on, off);
				}
			}
			function getMapFromFields() {
				if (!flagsListEl) return {};
				/** @type {Record<string, any>} */
				const out = {};
				const rows = flagsListEl.querySelectorAll(".flags-row");
				rows.forEach(row => {
					const inputs = row.querySelectorAll("input");
					const bitStr = inputs[0].value.trim();
					const on = inputs[1].value.trim();
					const off = inputs[2].value.trim();
					if (bitStr === "" || !/^\d+$/.test(bitStr)) return;
					const idx = Number(bitStr);
					if (!Number.isFinite(idx)) return;
					if (on && off) out[String(idx)] = { "1": on, "0": off };
					else if (on) out[String(idx)] = on;
					else if (off) out[String(idx)] = { "0": off };
				});
				return out;
			}
			function setFlagsMode(mode) {
				if (!flagsModeEl || !flagsFieldsWrap) return;
				flagsModeEl.value = mode;
				const useJson = mode === "json";
				flagsEl.hidden = !useJson;
				if (flagsPrettyEl) flagsPrettyEl.hidden = !useJson;
				flagsFieldsWrap.hidden = useJson;
			}

			function close() {
				modal.classList.remove("open");
				document.removeEventListener("keydown", onKey);
				saveBtn.removeEventListener("click", onSave);
				deleteBtn.removeEventListener("click", onDelete);
				cancelBtns.forEach(btn => btn.removeEventListener("click", onCancel));
				typeEl.removeEventListener("change", onTypeChange);
				if (flagsModeEl) flagsModeEl.removeEventListener("change", onFlagsModeChange);
				if (addFlagRowBtn) addFlagRowBtn.removeEventListener("click", onAddFlagRow);
				if (flagsPrettyEl) flagsPrettyEl.removeEventListener("click", onPretty);
			}
			function onKey(e) { if (e.key === "Escape") close(); }
			function onCancel() { close(); }
			function onTypeChange() {
				decoderWrap.hidden = typeEl.value !== "value";
				flagsWrap.hidden = typeEl.value !== "flags";
			}
			function onFlagsModeChange() {
				const mode = flagsModeEl.value === "fields" ? "fields" : "json";
				if (mode === "fields") {
					const map = parseFlagsMapFromJson(flagsEl.value);
					buildFieldsFromMap(map, group.bits.length);
				}
				setFlagsMode(mode);
			}
			function onAddFlagRow() {
				addFlagRow();
			}
			function onPretty() {
				try {
					const parsed = JSON.parse(flagsEl.value || "{}");
					flagsEl.value = JSON.stringify(parsed, null, 2);
				} catch (e) {
					alert(e instanceof Error ? e.message : String(e));
				}
			}
			function onSave() {
				group.label = labelEl.value.trim() || group.label;
				group.type = typeEl.value;
				if (group.type === "value") group.decoderSource = decoderEl.value;
				if (group.type === "flags") {
					if (flagsModeEl && flagsModeEl.value === "fields") {
						const map = getMapFromFields();
						group.flagsDescriptionSource = JSON.stringify(map);
					} else {
						group.flagsDescriptionSource = flagsEl.value;
					}
				}
				renderGroups();
				updateGroupsOutputs();
				close();
			}
			function onDelete() {
				removeGroup(group.id);
				close();
			}

			saveBtn.addEventListener("click", onSave);
			deleteBtn.addEventListener("click", onDelete);
			cancelBtns.forEach(btn => btn.addEventListener("click", onCancel));
			typeEl.addEventListener("change", onTypeChange);
			document.addEventListener("keydown", onKey);
			if (flagsModeEl) flagsModeEl.addEventListener("change", onFlagsModeChange);
			if (addFlagRowBtn) addFlagRowBtn.addEventListener("click", onAddFlagRow);
			if (flagsPrettyEl) flagsPrettyEl.addEventListener("click", onPretty);

			// Initialize mode based on whether JSON parses to a non-empty map
			if (flagsModeEl) {
				const initialMap = parseFlagsMapFromJson(flagsEl.value);
				const hasAny = Object.keys(initialMap).length > 0;
				if (hasAny) {
					// Default to JSON but let user switch
					setFlagsMode("json");
				} else {
					setFlagsMode("fields");
					buildFieldsFromMap({}, group.bits.length);
				}
			}

			modal.classList.add("open");
		}

		function renderGroups() {
			groupsContainer.innerHTML = "";
			for (const group of groups.values()) {
				const { id, label, bits, colorIndex } = group;
				const chip = document.createElement("div");
				chip.className = "group-chip";

				const swatch = document.createElement("span");
				swatch.className = "group-swatch";
				swatch.style.background = groupColors[colorIndex];

				const text = document.createElement("span");
				text.textContent = `${label}`;

				const output = document.createElement("span");
				output.className = "group-output";
				// Ensure newline characters render as line breaks
				output.style.whiteSpace = "pre-line";
				const error = document.createElement("span");
				error.className = "group-error";

				const settingsBtn = document.createElement("button");
				settingsBtn.type = "button";
				settingsBtn.textContent = "Settings";
				settingsBtn.addEventListener("click", () => openGroupSettingsModal(group));

				chip.appendChild(swatch);
				chip.appendChild(text);
				chip.appendChild(output);
				chip.appendChild(error);
				chip.appendChild(settingsBtn);
				chip.addEventListener("mouseenter", () => bits.forEach(b => b.classList.add("selected")));
				chip.addEventListener("mouseleave", () => bits.forEach(b => b.classList.remove("selected")));

				groupsContainer.appendChild(chip);

				group.els = { chipEl: chip, outputEl: output, errorEl: error };
			}
			updateGroupsOutputs();
			updateRemoveVisibility();
		}

		function addByte() {
			const idx = bytesContainer.querySelectorAll(".byte-row").length;
			const row = createByteRow(idx);
			if (bitOrder === "lsb") row.classList.add("lsb");
			bytesContainer.appendChild(row);
			updateBitDatasets();
			updateRemoveVisibility();
			updateHexInputFromGrid();
		}

		function removeLastByte() {
			const rows = bytesContainer.querySelectorAll(".byte-row");
			if (rows.length <= 1) return false;

			const last = rows[rows.length - 1];
			// Prevent deletion if any bit in last byte belongs to a group
			const hasGroupsInLast = Array.from(last.querySelectorAll(".bit")).some(b => !!b.dataset.groupIds);
			if (hasGroupsInLast) {
				updateRemoveVisibility();
				return false;
			}
			const bitsInLast = Array.from(last.querySelectorAll(".bit"));
			for (const [gid, g] of Array.from(groups.entries())) {
				const remainingBits = g.bits.filter(b => !bitsInLast.includes(b));
				if (remainingBits.length === 0) {
					groups.delete(gid);
				} else if (remainingBits.length !== g.bits.length) {
					g.bits = remainingBits;
				}
			}
			renderGroups();

			last.remove();
			updateBitDatasets();
			updateRemoveVisibility();
			updateSelectionControls();
			updateGroupsOutputs();
			updateHexInputFromGrid();
			return true;
		}

		function clearAllGroups() {
			for (const [id, group] of Array.from(groups.entries())) {
				detachBitsFromGroup(id, group.colorIndex, group.bits);
			}
			groups.clear();
			renderGroups();
		}

		function normalizeBytesArray(bytesArray) {
			if (!Array.isArray(bytesArray) || bytesArray.length === 0) {
				return [0];
			}
			return bytesArray.map((byte) => {
				const num = Number(byte);
				if (!Number.isFinite(num)) return 0;
				return ((num % 256) + 256) % 256;
			});
		}

		function setBytesFromArray(bytesArray) {
			const normalized = normalizeBytesArray(bytesArray);
			while (bytesContainer.querySelectorAll(".byte-row").length < normalized.length) {
				addByte();
			}
			while (bytesContainer.querySelectorAll(".byte-row").length > normalized.length) {
				const removed = removeLastByte();
				if (!removed) break;
			}
			const rows = bytesContainer.querySelectorAll(".byte-row");
			normalized.forEach((byte, idx) => {
				const row = rows[idx];
				if (row) setBitsForByte(row, byte);
			});
			updateBitDatasets();
			updateGroupsOutputs();
			updateHexInputFromGrid();
		}

		function buildExportPayload(includeSetBits) {
			updateBitDatasets();
			const bytes = getBytesArrayFromGrid();
			const groupsData = Array.from(groups.values()).map((group) => {
				const bits = group.bits.map((bit) => {
					const { byteIndex, bitIndex } = getBitCoordinates(bit);
					return { byteIndex, bitIndex };
				});
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
				bitOrder,
				byteOrder,
				bytes,
				groups: groupsData,
			};
			if (includeSetBits) {
				payload.setBits = collectSetBits();
			}
			payload.hex = bytes.length ? "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase() : "0x0";
			return payload;
		}

		function generateExportFilename() {
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			return `bitdocumenter-${timestamp}.txt`;
		}

		function addGroupFromSerialized(groupData) {
			if (!groupData || typeof groupData !== "object") return;
			const bitCoords = Array.isArray(groupData.bits) ? groupData.bits : [];
			const bitElements = [];
			bitCoords.forEach((coord) => {
				if (!coord || typeof coord !== "object") return;
				const byteIndex = Number(coord.byteIndex);
				const bitIndex = Number(coord.bitIndex);
				if (!Number.isFinite(byteIndex) || !Number.isFinite(bitIndex)) return;
				const bitEl = getBitElement(byteIndex, bitIndex);
				if (bitEl && !bitElements.includes(bitEl)) {
					bitElements.push(bitEl);
				}
			});
			if (bitElements.length === 0) return;

			let desiredId = typeof groupData.id === "string" && groupData.id.trim() ? groupData.id.trim() : "";
			let id = desiredId && !groups.has(desiredId) ? desiredId : "";
			if (!id) {
				id = `g${groupIdCounter++}`;
			} else {
				updateGroupIdCounterFromId(id);
			}
			while (groups.has(id)) {
				id = `g${groupIdCounter++}`;
			}

			const label = typeof groupData.label === "string" && groupData.label.trim() ? groupData.label.trim() : id;
			const type = groupData.type === "value" ? "value" : "flags";
			const decoderSource = typeof groupData.decoderSource === "string" && groupData.decoderSource.trim()
				? groupData.decoderSource
				: defaultDecoder;
			const flagsDescriptionSource = typeof groupData.flagsDescriptionSource === "string" && groupData.flagsDescriptionSource.trim()
				? groupData.flagsDescriptionSource
				: defaultFlagsDescriptions;
			const rawColor = Number(groupData.colorIndex);
			const colorIndex = Number.isFinite(rawColor) && groupColors.length
				? ((rawColor % groupColors.length) + groupColors.length) % groupColors.length
				: (groupColors.length ? (groups.size % groupColors.length) : 0);

			attachBitsToGroup(id, colorIndex, bitElements);

			groups.set(id, {
				id,
				label,
				type,
				decoderSource,
				flagsDescriptionSource,
				colorIndex,
				bits: bitElements,
				els: {},
			});
			updateGroupIdCounterFromId(id);
		}

		function importConfigurationFromBase64(base64Text) {
			try {
				const normalized = (base64Text || "").replace(/\s+/g, "");
				if (!normalized) {
					throw new Error("Provide a Base64 configuration before importing.");
				}
				const decoded = decodeFromBase64Utf8(normalized);
				const payload = JSON.parse(decoded);
				if (!payload || typeof payload !== "object") {
					throw new Error("Configuration payload is malformed.");
				}

				const bytes = Array.isArray(payload.bytes) ? payload.bytes : undefined;
				clearAllGroups();
				setBytesFromArray(bytes);

				const order = payload.bitOrder === "lsb" ? "lsb" : "msb";
				applyBitOrder(order);
				const byteOrderValue = payload.byteOrder === "lsbyte" ? "lsbyte" : "msbyte";
				applyByteOrder(byteOrderValue);

				if (Array.isArray(payload.groups)) {
					payload.groups.forEach(addGroupFromSerialized);
				}
				renderGroups();
				updateGroupsOutputs();
				updateSelectionControls();
				updateRemoveVisibility();
				showImportExportStatus("Import successful.", false);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				showImportExportStatus(`Import failed: ${message}`, true);
			}
		}

		function exportConfiguration() {
			if (!configBase64Textarea) return;
			try {
				const includeSetBits = exportIncludeSetBitsCheckbox ? !!exportIncludeSetBitsCheckbox.checked : false;
				const payload = buildExportPayload(includeSetBits);
				const json = JSON.stringify(payload, null, 2);
				const base64 = encodeToBase64Utf8(json);
				configBase64Textarea.value = base64;
				const filename = generateExportFilename();
				downloadTextFile(filename, base64);
				showImportExportStatus(`Exported configuration to ${filename}.`, false);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				showImportExportStatus(`Export failed: ${message}`, true);
			}
		}

		async function copyConfigurationToClipboard() {
			if (!configBase64Textarea) return;
			const text = (configBase64Textarea.value || "").trim();
			if (!text) {
				showImportExportStatus("Nothing to copy. Export or import a configuration first.", true);
				return;
			}
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					await navigator.clipboard.writeText(text);
				} else {
					configBase64Textarea.focus();
					configBase64Textarea.select();
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

		addByteBtn.addEventListener("click", addByte);
		removeByteBtn.addEventListener("click", removeLastByte);
		groupSelectedBtn.addEventListener("click", addGroupFromSelection);
		clearSelectedBtn.addEventListener("click", clearSelection);

		function getBytesArrayFromGrid() {
			const rows = Array.from(bytesContainer.querySelectorAll(".byte-row"));
			const orderedRows = byteOrder === "lsbyte" ? rows.slice().reverse() : rows;
			/** @type {number[]} */
			const bytes = [];
			orderedRows.forEach((row) => {
				const bits = row.querySelectorAll(".bit");
				let value = 0;
				for (let i = 0; i < 8; i++) {
					const isOn = bits[i]?.classList.contains("on");
					value = (value << 1) | (isOn ? 1 : 0);
				}
				bytes.push(value);
			});
			return bytes;
		}

		function updateHexInputFromGrid() {
			if (!bytesHexInput) return;
			const bytes = getBytesArrayFromGrid();
			let hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
			hex = hex.replace(/^0+/, "") || "0";
			bytesHexInput.value = "0x" + hex;
		}

		function setBitsForByte(rowEl, byteValue) {
			const bits = rowEl.querySelectorAll(".bit");
			for (let i = 0; i < 8; i++) {
				const bitVal = (byteValue >> (7 - i)) & 1;
				const el = bits[i];
				if (!el) continue;
				el.classList.remove("selected");
				if (bitVal === 1) {
					el.classList.add("on");
					el.textContent = "1";
				} else {
					el.classList.remove("on");
					el.textContent = "0";
				}
			}
		}

		function collectSetBits() {
			const rows = bytesContainer.querySelectorAll(".byte-row");
			/** @type {{byteIndex:number, bitIndex:number}[]} */
			const setBits = [];
			rows.forEach((row, byteIndex) => {
				const bits = row.querySelectorAll(".bit");
				bits.forEach((bit, bitIndex) => {
					if (bit.classList.contains("on")) {
						setBits.push({ byteIndex, bitIndex });
					}
				});
			});
			return setBits;
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

		function showImportExportStatus(message, isError = false) {
			if (!importExportStatus) return;
			importExportStatus.textContent = message;
			if (!message) {
				delete importExportStatus.dataset.state;
			} else {
				importExportStatus.dataset.state = isError ? "error" : "success";
			}
		}

		function handleImportExportDocumentPointerDown(event) {
			if (!importExportMenu || !importExportToggle) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (importExportMenu.contains(target) || importExportToggle.contains(target)) return;
			closeImportExportMenu();
		}

		function handleImportExportDocumentKeyDown(event) {
			if (event.key !== "Escape") return;
			if (!importExportMenuOpen) return;
			event.preventDefault();
			closeImportExportMenu();
			if (importExportToggle) importExportToggle.focus();
		}

		function openImportExportMenu() {
			if (!importExportMenu || !importExportToggle) return;
			if (importExportMenuOpen) return;
			importExportMenu.hidden = false;
			requestAnimationFrame(() => importExportMenu.classList.add("open"));
			importExportToggle.setAttribute("aria-expanded", "true");
			importExportMenuOpen = true;
			showImportExportStatus("");
			if (configBase64Textarea) configBase64Textarea.focus();
			document.addEventListener("pointerdown", handleImportExportDocumentPointerDown);
			document.addEventListener("keydown", handleImportExportDocumentKeyDown);
		}

		function closeImportExportMenu() {
			if (!importExportMenu || !importExportToggle) return;
			if (!importExportMenuOpen) return;
			importExportMenu.classList.remove("open");
			importExportToggle.setAttribute("aria-expanded", "false");
			importExportMenuOpen = false;
			const onTransitionEnd = () => {
				importExportMenu.hidden = true;
			};
			importExportMenu.addEventListener("transitionend", onTransitionEnd, { once: true });
			// Fallback in case transitionend does not fire
			setTimeout(() => {
				if (!importExportMenuOpen) importExportMenu.hidden = true;
			}, 180);
			document.removeEventListener("pointerdown", handleImportExportDocumentPointerDown);
			document.removeEventListener("keydown", handleImportExportDocumentKeyDown);
		}

		function toggleImportExportMenu() {
			if (importExportMenuOpen) closeImportExportMenu();
			else openImportExportMenu();
		}

		function handleOptionsDocumentPointerDown(event) {
			if (!optionsMenu || !optionsToggle) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (optionsMenu.contains(target) || optionsToggle.contains(target)) return;
			closeOptionsMenu();
		}

		function handleOptionsDocumentKeyDown(event) {
			if (event.key !== "Escape") return;
			if (!optionsMenuOpen) return;
			event.preventDefault();
			closeOptionsMenu();
			if (optionsToggle) optionsToggle.focus();
		}

		function openOptionsMenu() {
			if (!optionsMenu || !optionsToggle) return;
			if (optionsMenuOpen) return;
			optionsMenu.hidden = false;
			requestAnimationFrame(() => optionsMenu.classList.add("open"));
			optionsToggle.setAttribute("aria-expanded", "true");
			optionsMenuOpen = true;
			document.addEventListener("pointerdown", handleOptionsDocumentPointerDown);
			document.addEventListener("keydown", handleOptionsDocumentKeyDown);
			if (bitOrderSelect) bitOrderSelect.focus();
		}

		function closeOptionsMenu() {
			if (!optionsMenu || !optionsToggle) return;
			if (!optionsMenuOpen) return;
			optionsMenu.classList.remove("open");
			optionsToggle.setAttribute("aria-expanded", "false");
			optionsMenuOpen = false;
			const onTransitionEnd = () => {
				optionsMenu.hidden = true;
			};
			optionsMenu.addEventListener("transitionend", onTransitionEnd, { once: true });
			setTimeout(() => {
				if (!optionsMenuOpen) optionsMenu.hidden = true;
			}, 180);
			document.removeEventListener("pointerdown", handleOptionsDocumentPointerDown);
			document.removeEventListener("keydown", handleOptionsDocumentKeyDown);
		}

		function toggleOptionsMenu() {
			if (optionsMenuOpen) closeOptionsMenu();
			else openOptionsMenu();
		}

		function applyHexBytesInput() {
			if (!bytesHexInput) return;
			let raw = bytesHexInput.value.trim();
			if (raw === "") return;
			// Allow prefix 0x/0X and spaces/underscores
			raw = raw.replace(/^0x/i, "").replace(/[\s_]/g, "");
			if (raw !== "" && !/^[0-9a-fA-F]+$/.test(raw)) {
				// Ignore invalid partial input without disturbing typing
				return;
			}
			// Pad to even number of digits
			if (raw.length % 2 === 1) raw = "0" + raw;
			/** @type {number[]} big-endian byte array */
			const bytes = [];
			if (raw.length > 0) {
				for (let i = 0; i < raw.length; i += 2) {
					bytes.push(parseInt(raw.slice(i, i + 2), 16));
				}
			} else {
				bytes.push(0);
			}

			setBytesFromArray(bytes);

			// Normalize input display to canonical uppercase 0x form
			let hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
			hex = hex.replace(/^0+/, "") || "0";
			bytesHexInput.value = "0x" + hex;
		}

		if (bytesHexInput) {
			function sanitizeHexField() {
				if (!bytesHexInput) return;
				let s = bytesHexInput.value || "";
				s = s.trim();
				// Normalize prefix
				let prefix = "";
				if (/^0[xX]/.test(s)) {
					prefix = "0x";
					s = s.slice(2);
				}
				// Keep only hex digits
				s = s.replace(/[^0-9a-fA-F]/g, "");
				bytesHexInput.value = (prefix ? "0x" : "") + s.toUpperCase();
			}
			bytesHexInput.addEventListener("input", () => {
				sanitizeHexField();
				applyHexBytesInput();
			});
		}
		if (exportConfigBtn) {
			exportConfigBtn.addEventListener("click", exportConfiguration);
		}
		if (copyConfigBtn) {
			copyConfigBtn.addEventListener("click", copyConfigurationToClipboard);
		}
		if (importConfigBtn) {
			importConfigBtn.addEventListener("click", () => {
				if (!configBase64Textarea) return;
				importConfigurationFromBase64(configBase64Textarea.value);
			});
		}
		if (importExportToggle) {
			importExportToggle.addEventListener("click", toggleImportExportMenu);
		}
		if (closeImportExportBtn) {
			closeImportExportBtn.addEventListener("click", closeImportExportMenu);
		}
		if (optionsToggle) {
			optionsToggle.addEventListener("click", toggleOptionsMenu);
		}
		if (closeOptionsBtn) {
			closeOptionsBtn.addEventListener("click", closeOptionsMenu);
		}
		if (byteOrderSelect) {
			byteOrderSelect.addEventListener("change", () => {
				const val = String(byteOrderSelect.value).toLowerCase();
				applyByteOrder(val === "lsbyte" ? "lsbyte" : "msbyte");
			});
		}
		selectModeCheckbox.addEventListener("change", () => {
			if (selectModeCheckbox.checked) clearSelection();
		});
		if (bitOrderSelect) {
			bitOrderSelect.addEventListener("change", () => {
				const val = String(bitOrderSelect.value).toLowerCase();
				applyBitOrder(val === "lsb" ? "lsb" : "msb");
			});
		}

		applyByteOrder(byteOrder);
		// initialize with one byte
		addByte();
		updateHexInputFromGrid();
	}
});


