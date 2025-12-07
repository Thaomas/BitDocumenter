const REQUIRED_IDS = [
	"bytesContainer",
	"groupsContainer",
	"addByteBtn",
	"removeByteBtn",
	"resetAllBtn",
	"selectMode",
	"groupSelectedBtn",
	"clearSelectedBtn",
	"groupLabelInput",
	"bitOrder",
	"bytesHexInput",
	"importExportToggle",
	"importExportMenu",
	"exportConfigBtn",
	"copyConfigBtn",
	"importConfigBtn",
	"configBase64",
	"importExportStatus",
	"optionsToggle",
	"optionsMenu",
	"closeOptionsBtn",
	"byteOrder",
];

const OPTIONAL_IDS = [
	"exportIncludeSetBits",
	"exportPdfBtn",
	"closeImportExportBtn",
	"groupSettingsModal",
	"gsLabel",
	"gsType",
	"gsDecoderWrap",
	"gsDecoder",
	"gsFlagsWrap",
	"gsFlagsDescriptions",
	"gsFlagsMode",
	"gsFlagsFields",
	"gsFlagsList",
	"gsAddFlagRow",
	"gsFlagsPretty",
	"gsSave",
	"gsDelete",
];

export function createByteAppContext() {
	const byteApp = document.getElementById("byteApp");
	if (!byteApp) return null;

	const dom = { byteApp };
	for (const id of REQUIRED_IDS) {
		dom[idMapKey(id)] = document.getElementById(id);
	}
	for (const id of OPTIONAL_IDS) {
		dom[idMapKey(id)] = document.getElementById(id);
	}

	if (!hasRequiredDom(dom)) {
		return null;
	}

	return {
		dom,
		state: {
			bitOrder: "msb",
			byteOrder: "msbyte",
			importExportMenuOpen: false,
			optionsMenuOpen: false,
			groupIdCounter: 0,
		},
		groups: new Map(),
		constants: {
			groupColors: [
				"rgba(255, 99, 132, 1)",
				"rgba(255, 205, 86, 1)",
				"rgba(75, 192, 192, 1)",
				"rgba(153, 102, 255, 1)",
				"rgba(255, 159, 64, 1)",
				"rgba(54, 162, 235, 1)",
			],
			defaultDecoder: `function decode(bits) {
  // bits: array of 0/1 in selected order
  // MSB-first: bits[0] is most significant; LSB-first: bits[0] is least significant
  let value = 0;
  for (const b of bits) value = (value << 1) | b;
  return value;
}`,
			defaultFlagsDescriptions: '{"0":"Flag 0|No Flag 0","1":{"1":"Flag 1 set","0":"Flag 1 clear"}}',
		},
	};
}

function idMapKey(id) {
	return `${id}El`;
}

function hasRequiredDom(dom) {
	return REQUIRED_IDS.every((id) => !!dom[idMapKey(id)]);
}


