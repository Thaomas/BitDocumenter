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

		if (!bytesContainer || !addByteBtn || !removeByteBtn || !groupsContainer || !selectModeCheckbox || !groupSelectedBtn || !clearSelectedBtn || !groupLabelInput) return;

		/** @type {"msb"|"lsb"} */
		let bitOrder = "msb";

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

		function createBit(initialOn) {
			const el = document.createElement("button");
			el.className = "bit" + (initialOn ? " on" : "");
			el.type = "button";
			el.textContent = initialOn ? "1" : "0";
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
				row.appendChild(createBit(false));
			}
			return row;
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
			const colorIndex = (groupIdCounter - 1) % 6;

			selectedBits.forEach((bit) => {
				bit.classList.remove("selected");
				bit.classList.add(`group-${colorIndex}`);
				bit.dataset.groupIds = bit.dataset.groupIds ? `${bit.dataset.groupIds},${id}` : id;
			});

			groups.set(id, { id, label, bits: selectedBits, colorIndex, type: "flags", decoderSource: defaultDecoder, flagsDescriptionSource: defaultFlagsDescriptions, els: {} });
			renderGroups();
			updateSelectionControls();
			updateGroupsOutputs();
		}

		function removeGroup(id) {
			const group = groups.get(id);
			if (!group) return;
			group.bits.forEach((bit) => {
				const cls = `group-${group.colorIndex}`;
				const otherWithSameColor = (bit.dataset.groupIds || "")
					.split(",")
					.filter(gid => gid && gid !== id)
					.some(gid => {
						const g = groups.get(gid);
						return g && g.colorIndex === group.colorIndex;
					});
				if (!otherWithSameColor) bit.classList.remove(cls);

				const ids = (bit.dataset.groupIds || "").split(",").filter(gid => gid && gid !== id);
				if (ids.length) bit.dataset.groupIds = ids.join(",");
				else delete bit.dataset.groupIds;
			});
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
			updateRemoveVisibility();
			updateHexInputFromGrid();
		}

		function removeLastByte() {
			const rows = bytesContainer.querySelectorAll(".byte-row");
			if (rows.length > 1) {
				const last = rows[rows.length - 1];
				// Prevent deletion if any bit in last byte belongs to a group
				const hasGroupsInLast = Array.from(last.querySelectorAll(".bit")).some(b => !!b.dataset.groupIds);
				if (hasGroupsInLast) {
					updateRemoveVisibility();
					return;
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
				updateRemoveVisibility();
				updateSelectionControls();
				updateGroupsOutputs();
				updateHexInputFromGrid();
			}
		}

		addByteBtn.addEventListener("click", addByte);
		removeByteBtn.addEventListener("click", removeLastByte);
		groupSelectedBtn.addEventListener("click", addGroupFromSelection);
		clearSelectedBtn.addEventListener("click", clearSelection);

		function updateHexInputFromGrid() {
			if (!bytesHexInput) return;
			const rows = bytesContainer.querySelectorAll(".byte-row");
			/** @type {number[]} */
			const bytes = [];
			rows.forEach((row) => {
				const bits = row.querySelectorAll(".bit");
				let value = 0;
				for (let i = 0; i < 8; i++) {
					const isOn = bits[i]?.classList.contains("on");
					value = (value << 1) | (isOn ? 1 : 0);
				}
				bytes.push(value);
			});
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
				if (bitVal === 1) {
					el.classList.add("on");
					el.textContent = "1";
				} else {
					el.classList.remove("on");
					el.textContent = "0";
				}
			}
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

			// Ensure we have the right number of rows (big-endian: first byte -> first row)
			const current = bytesContainer.querySelectorAll(".byte-row").length;
			if (current < bytes.length) {
				for (let i = current; i < bytes.length; i++) addByte();
			} else if (current > bytes.length) {
				for (let i = current; i > bytes.length; i--) removeLastByte();
			}

			const rows = bytesContainer.querySelectorAll(".byte-row");
			for (let i = 0; i < bytes.length; i++) {
				setBitsForByte(rows[i], bytes[i]);
			}
			updateGroupsOutputs();

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
		selectModeCheckbox.addEventListener("change", () => {
			if (selectModeCheckbox.checked) clearSelection();
		});
		if (bitOrderSelect) {
			bitOrderSelect.addEventListener("change", () => {
				const val = String(bitOrderSelect.value).toLowerCase();
				bitOrder = (val === "lsb") ? "lsb" : "msb";
				// Flip visual order only
				bytesContainer.querySelectorAll(".byte-row").forEach(r => {
					if (bitOrder === "lsb") r.classList.add("lsb");
					else r.classList.remove("lsb");
				});
				updateGroupsOutputs();
			});
		}

		// initialize with one byte
		addByte();
		updateHexInputFromGrid();
	}
});


