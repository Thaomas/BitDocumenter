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

		if (!bytesContainer || !addByteBtn || !removeByteBtn || !groupsContainer || !selectModeCheckbox || !groupSelectedBtn || !clearSelectedBtn || !groupLabelInput) return;

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

		const defaultDecoder = `function decode(bits) {\n  // bits: array of 0/1, MSB..LSB (left -> right)\n  let value = 0;\n  for (const b of bits) value = (value << 1) | b;\n  return value;\n}`;
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
			const vals = getBitsValues(group.bits);
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
						labeledOutputs.push(`${idx}:${chosenLabel}`);
					}
				}
			}

			if (labeledOutputs.length > 0) {
				return { text: `Labels: [${labeledOutputs.join(", ")}]`, error: parseError };
			}

			// Fallback to previous "set bits" behavior
			const described = setIdx.map(i => (descMap && Object.prototype.hasOwnProperty.call(descMap, String(i))) ? `${i}:${descMap[String(i)]}` : String(i));
			return { text: setIdx.length ? `Set: [${described.join(", ")}]` : "Set: none", error: parseError };
		}

		function computeValueOutput(group) {
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

			function close() {
				modal.classList.remove("open");
				document.removeEventListener("keydown", onKey);
				saveBtn.removeEventListener("click", onSave);
				deleteBtn.removeEventListener("click", onDelete);
				cancelBtns.forEach(btn => btn.removeEventListener("click", onCancel));
				typeEl.removeEventListener("change", onTypeChange);
				if (flagsPrettyEl) flagsPrettyEl.removeEventListener("click", onPretty);
			}
			function onKey(e) { if (e.key === "Escape") close(); }
			function onCancel() { close(); }
			function onTypeChange() {
				decoderWrap.hidden = typeEl.value !== "value";
				flagsWrap.hidden = typeEl.value !== "flags";
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
				if (group.type === "flags") group.flagsDescriptionSource = flagsEl.value;
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
			if (flagsPrettyEl) flagsPrettyEl.addEventListener("click", onPretty);

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
				// const positions = bits.map(bit => {
				// 	const row = bit.parentElement;
				// 	const byteIndex = Array.from(bytesContainer.children).indexOf(row);
				// 	const bitIndex = Array.from(row.children).indexOf(bit);
				// 	return `B${byteIndex}[${bitIndex}]`;
				// }).join(", ");	
				text.textContent = `${label}`;

				const output = document.createElement("span");
				output.className = "group-output";
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
		}

		function addByte() {
			const idx = bytesContainer.querySelectorAll(".byte-row").length;
			const row = createByteRow(idx);
			bytesContainer.appendChild(row);
			updateRemoveVisibility();
		}

		function removeLastByte() {
			const rows = bytesContainer.querySelectorAll(".byte-row");
			if (rows.length > 1) {
				const last = rows[rows.length - 1];
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
			}
		}

		addByteBtn.addEventListener("click", addByte);
		removeByteBtn.addEventListener("click", removeLastByte);
		groupSelectedBtn.addEventListener("click", addGroupFromSelection);
		clearSelectedBtn.addEventListener("click", clearSelection);
		selectModeCheckbox.addEventListener("change", () => {
			if (selectModeCheckbox.checked) clearSelection();
		});

		// initialize with one byte
		addByte();
	}
});


