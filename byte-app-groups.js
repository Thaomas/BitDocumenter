export function setupGroups(ctx, gridApi) {
	const { dom, constants, groups, state } = ctx;

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
			if (Number.isFinite(num) && num >= state.groupIdCounter) {
				state.groupIdCounter = num + 1;
			}
		}
	}

	function addGroupFromSelection() {
		const selectedBits = Array.from(dom.bytesContainerEl.querySelectorAll(".bit.selected"));
		if (selectedBits.length === 0) return;

		const label = dom.groupLabelInputEl.value.trim() || `Group ${state.groupIdCounter + 1}`;
		const id = `g${state.groupIdCounter++}`;
		const colorIndex = constants.groupColors.length ? (state.groupIdCounter - 1) % constants.groupColors.length : 0;

		attachBitsToGroup(id, colorIndex, selectedBits);

		groups.set(id, {
			id,
			label,
			bits: selectedBits,
			colorIndex,
			type: "flags",
			decoderSource: constants.defaultDecoder,
			flagsDescriptionSource: constants.defaultFlagsDescriptions,
			els: {},
		});
		renderGroups();
		gridApi.updateSelectionControls();
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
		const orderedBits = state.bitOrder === "msb" ? group.bits : group.bits.slice().reverse();
		const vals = getBitsValues(orderedBits);
		const setIdx = vals.map((v, i) => [v, i]).filter(([v]) => v === 1).map(([, i]) => i);
		let descMap = {};
		let parseError = "";
		try {
			descMap = group.flagsDescriptionSource ? JSON.parse(group.flagsDescriptionSource) : {};
		} catch (e) {
			parseError = e instanceof Error ? e.message : String(e);
		}

		const labeledOutputs = [];
		if (descMap && typeof descMap === "object") {
			for (const key of Object.keys(descMap)) {
				const idx = Number(key);
				if (!Number.isFinite(idx)) continue;
				const bitVal = vals[idx] ?? 0;
				const raw = descMap[key];

				let chosenLabel = "";
				if (raw && typeof raw === "object") {
					if (bitVal === 1 && typeof raw["1"] === "string") chosenLabel = raw["1"];
					else if (bitVal === 0 && typeof raw["0"] === "string") chosenLabel = raw["0"];
				} else if (typeof raw === "string") {
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
			return { text: `Labels:\n${labeledOutputs.join("\n")}`, error: parseError };
		}

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
		const modal = dom.groupSettingsModalEl;
		if (!modal) return;
		const labelEl = dom.gsLabelEl;
		const typeEl = dom.gsTypeEl;
		const decoderWrap = dom.gsDecoderWrapEl;
		const decoderEl = dom.gsDecoderEl;
		const flagsWrap = dom.gsFlagsWrapEl;
		const flagsEl = dom.gsFlagsDescriptionsEl;
		const flagsModeEl = dom.gsFlagsModeEl;
		const flagsFieldsWrap = dom.gsFlagsFieldsEl;
		const flagsListEl = dom.gsFlagsListEl;
		const addFlagRowBtn = dom.gsAddFlagRowEl;
		const flagsPrettyEl = dom.gsFlagsPrettyEl;
		const saveBtn = dom.gsSaveEl;
		const deleteBtn = dom.gsDeleteEl;
		const cancelBtns = modal.querySelectorAll("[data-close-modal]");

		if (!labelEl || !typeEl || !decoderWrap || !decoderEl || !flagsWrap || !flagsEl || !saveBtn || !deleteBtn) {
			return;
		}

		labelEl.value = group.label;
		typeEl.value = group.type;
		decoderEl.value = group.decoderSource || constants.defaultDecoder;
		flagsEl.value = group.flagsDescriptionSource || constants.defaultFlagsDescriptions;
		decoderWrap.hidden = group.type !== "value";
		flagsWrap.hidden = group.type !== "flags";

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

		function onKey(e) {
			if (e.key === "Escape") close();
		}

		function onCancel() {
			close();
		}

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

		if (flagsModeEl) {
			const initialMap = parseFlagsMapFromJson(flagsEl.value);
			const hasAny = Object.keys(initialMap).length > 0;
			if (hasAny) {
				setFlagsMode("json");
			} else {
				setFlagsMode("fields");
				buildFieldsFromMap({}, group.bits.length);
			}
		}

		modal.classList.add("open");
	}

	function renderGroups() {
		dom.groupsContainerEl.innerHTML = "";
		for (const group of groups.values()) {
			const { label, bits, colorIndex } = group;
			const chip = document.createElement("div");
			chip.className = "group-chip";

			const swatch = document.createElement("span");
			swatch.className = "group-swatch";
			swatch.style.background = constants.groupColors[colorIndex];

			const text = document.createElement("span");
			text.textContent = `${label}`;

			const output = document.createElement("span");
			output.className = "group-output";
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

			dom.groupsContainerEl.appendChild(chip);

			group.els = { chipEl: chip, outputEl: output, errorEl: error };
		}
		updateGroupsOutputs();
		gridApi.updateRemoveVisibility();
	}

	function clearAllGroups() {
		for (const [id, group] of Array.from(groups.entries())) {
			detachBitsFromGroup(id, group.colorIndex, group.bits);
		}
		groups.clear();
		renderGroups();
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
			const bitEl = gridApi.getBitElement(byteIndex, bitIndex);
			if (bitEl && !bitElements.includes(bitEl)) {
				bitElements.push(bitEl);
			}
		});
		if (bitElements.length === 0) return;

		let desiredId = typeof groupData.id === "string" && groupData.id.trim() ? groupData.id.trim() : "";
		let id = desiredId && !groups.has(desiredId) ? desiredId : "";
		if (!id) {
			id = `g${state.groupIdCounter++}`;
		} else {
			updateGroupIdCounterFromId(id);
		}
		while (groups.has(id)) {
			id = `g${state.groupIdCounter++}`;
		}

		const label = typeof groupData.label === "string" && groupData.label.trim() ? groupData.label.trim() : id;
		const type = groupData.type === "value" ? "value" : "flags";
		const decoderSource = typeof groupData.decoderSource === "string" && groupData.decoderSource.trim()
			? groupData.decoderSource
			: constants.defaultDecoder;
		const flagsDescriptionSource = typeof groupData.flagsDescriptionSource === "string" && groupData.flagsDescriptionSource.trim()
			? groupData.flagsDescriptionSource
			: constants.defaultFlagsDescriptions;
		const rawColor = Number(groupData.colorIndex);
		const colorIndex = Number.isFinite(rawColor) && constants.groupColors.length
			? ((rawColor % constants.groupColors.length) + constants.groupColors.length) % constants.groupColors.length
			: (constants.groupColors.length ? (groups.size % constants.groupColors.length) : 0);

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

	dom.groupSelectedBtnEl.addEventListener("click", addGroupFromSelection);
	dom.clearSelectedBtnEl.addEventListener("click", () => gridApi.clearSelection());

	return {
		updateGroupsOutputs,
		renderGroups,
		clearAllGroups,
		addGroupFromSelection,
		addGroupFromSerialized,
		removeGroup,
	};
}


