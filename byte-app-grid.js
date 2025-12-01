export function setupBitGrid(ctx) {
	const { dom, state } = ctx;
	let groupsApi = null;

	function setGroupsApi(api) {
		groupsApi = api;
	}

	function notifyGroupsOutputs() {
		groupsApi?.updateGroupsOutputs();
	}

	function createBit(initialOn, byteIndex, bitIndex) {
		const el = document.createElement("button");
		el.className = "bit" + (initialOn ? " on" : "");
		el.type = "button";
		el.textContent = initialOn ? "1" : "0";
		el.dataset.byteIndex = String(byteIndex);
		el.dataset.bitIndex = String(bitIndex);
		el.addEventListener("click", () => {
			if (!dom.selectModeEl.checked) {
				el.classList.toggle("selected");
				updateSelectionControls();
			} else {
				const isOn = el.classList.toggle("on");
				el.textContent = isOn ? "1" : "0";
				notifyGroupsOutputs();
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
		const rows = dom.bytesContainerEl.querySelectorAll(".byte-row");
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
		state.bitOrder = normalized;
		dom.bitOrderEl.value = normalized;
		dom.bytesContainerEl.querySelectorAll(".byte-row").forEach((row) => {
			if (normalized === "lsb") row.classList.add("lsb");
			else row.classList.remove("lsb");
		});
		notifyGroupsOutputs();
	}

	function applyByteOrder(order) {
		const normalized = order === "lsbyte" ? "lsbyte" : "msbyte";
		state.byteOrder = normalized;
		dom.byteOrderEl.value = normalized;
		if (normalized === "lsbyte") dom.bytesContainerEl.classList.add("lsbyte");
		else dom.bytesContainerEl.classList.remove("lsbyte");
		updateHexInputFromGrid();
	}

	function getBitCoordinates(bitEl) {
		const byteIndex = Number(bitEl.dataset.byteIndex);
		const bitIndex = Number(bitEl.dataset.bitIndex);
		if (Number.isFinite(byteIndex) && Number.isFinite(bitIndex)) {
			return { byteIndex, bitIndex };
		}
		const parent = bitEl.parentElement;
		const rows = Array.from(dom.bytesContainerEl.querySelectorAll(".byte-row"));
		const rowIndex = rows.indexOf(parent);
		const bits = parent ? Array.from(parent.querySelectorAll(".bit")) : [];
		const idx = bits.indexOf(bitEl);
		return { byteIndex: rowIndex, bitIndex: idx };
	}

	function getBitElement(byteIndex, bitIndex) {
		const rows = dom.bytesContainerEl.querySelectorAll(".byte-row");
		const row = rows[byteIndex];
		if (!row) return null;
		const bits = row.querySelectorAll(".bit");
		return bits[bitIndex] || null;
	}

	function updateRemoveVisibility() {
		const count = dom.bytesContainerEl.querySelectorAll(".byte-row").length;
		dom.removeByteBtnEl.hidden = count <= 1;
		if (!dom.removeByteBtnEl.hidden) {
			const rows = dom.bytesContainerEl.querySelectorAll(".byte-row");
			const last = rows[rows.length - 1];
			const hasGroupsInLast = last ? Array.from(last.querySelectorAll(".bit")).some(b => !!b.dataset.groupIds) : false;
			dom.removeByteBtnEl.disabled = hasGroupsInLast;
		}
	}

	function updateSelectionControls() {
		const someSelected = dom.bytesContainerEl.querySelector(".bit.selected") !== null;
		dom.groupSelectedBtnEl.disabled = !someSelected;
		dom.clearSelectedBtnEl.disabled = !someSelected;
	}

	function clearSelection() {
		dom.bytesContainerEl.querySelectorAll(".bit.selected").forEach(b => b.classList.remove("selected"));
		updateSelectionControls();
	}

	function addByte() {
		const idx = dom.bytesContainerEl.querySelectorAll(".byte-row").length;
		const row = createByteRow(idx);
		if (state.bitOrder === "lsb") row.classList.add("lsb");
		dom.bytesContainerEl.appendChild(row);
		updateBitDatasets();
		updateRemoveVisibility();
		updateHexInputFromGrid();
	}

	function removeLastByte() {
		const rows = dom.bytesContainerEl.querySelectorAll(".byte-row");
		if (rows.length <= 1) return false;

		const last = rows[rows.length - 1];
		const hasGroupsInLast = Array.from(last.querySelectorAll(".bit")).some(b => !!b.dataset.groupIds);
		if (hasGroupsInLast) {
			updateRemoveVisibility();
			return false;
		}
		const bitsInLast = Array.from(last.querySelectorAll(".bit"));
		for (const [gid, group] of Array.from(ctx.groups.entries())) {
			const remainingBits = group.bits.filter(b => !bitsInLast.includes(b));
			if (remainingBits.length === 0) {
				ctx.groups.delete(gid);
			} else if (remainingBits.length !== group.bits.length) {
				group.bits = remainingBits;
			}
		}
		groupsApi?.renderGroups();

		last.remove();
		updateBitDatasets();
		updateRemoveVisibility();
		updateSelectionControls();
		notifyGroupsOutputs();
		updateHexInputFromGrid();
		return true;
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

	function setBytesFromArray(bytesArray) {
		const normalized = normalizeBytesArray(bytesArray);
		while (dom.bytesContainerEl.querySelectorAll(".byte-row").length < normalized.length) {
			addByte();
		}
		while (dom.bytesContainerEl.querySelectorAll(".byte-row").length > normalized.length) {
			const removed = removeLastByte();
			if (!removed) break;
		}
		const rows = dom.bytesContainerEl.querySelectorAll(".byte-row");
		normalized.forEach((byte, idx) => {
			const row = rows[idx];
			if (row) setBitsForByte(row, byte);
		});
		updateBitDatasets();
		notifyGroupsOutputs();
		updateHexInputFromGrid();
	}

	function getBytesArrayFromGrid() {
		const rows = Array.from(dom.bytesContainerEl.querySelectorAll(".byte-row"));
		const orderedRows = state.byteOrder === "lsbyte" ? rows.slice().reverse() : rows;
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
		if (!dom.bytesHexInputEl) return;
		const bytes = getBytesArrayFromGrid();
		let hex = bytes.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
		hex = hex.replace(/^0+/, "") || "0";
		dom.bytesHexInputEl.value = "0x" + hex;
	}

	function collectSetBits() {
		const rows = dom.bytesContainerEl.querySelectorAll(".byte-row");
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

	function addEventListeners() {
		dom.addByteBtnEl.addEventListener("click", addByte);
		dom.removeByteBtnEl.addEventListener("click", removeLastByte);
		dom.selectModeEl.addEventListener("change", () => {
			if (dom.selectModeEl.checked) clearSelection();
		});
	}

	addEventListeners();
	applyByteOrder(state.byteOrder);
	addByte();
	updateHexInputFromGrid();
	updateSelectionControls();

	return {
		setGroupsApi,
		updateBitDatasets,
		applyBitOrder,
		applyByteOrder,
		addByte,
		removeLastByte,
		setBytesFromArray,
		getBytesArrayFromGrid,
		updateHexInputFromGrid,
		clearSelection,
		updateSelectionControls,
		getBitCoordinates,
		getBitElement,
		collectSetBits,
		updateRemoveVisibility,
	};
}


