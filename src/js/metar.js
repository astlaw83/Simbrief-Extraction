const flightPlanMetars = document.getElementById("flight-plan-metars");
const searchMetarInput = document.getElementById("search-metar-icao");
const searchMetarButton = document.getElementById("search-metar-button");
const searchMetarOutput = document.getElementById("search-metar");

// globals to store the airport idents & metars
let depMetar = "";
let arrMetar = "";
let searchMetar = "";

class Metar {
	constructor(icao) {
		this.icao = icao;
	}

	static async create(icao) {
		let metar = new Metar(icao);
		await metar.update();
		return metar;
	}

	async update() {
		// get the metar from vatsim
		let url = `https://metar.vatsim.net/${this.icao}`;

		let response;
		try {
			response = await fetch(url); // wait for the request to complete
		} catch (err) {
			console.error(err);
			alert(`Failed to fetch METAR. Check your internet connection`);
			return;
		}

		if (!response.ok) {
			alert(`Server error (VATSIM): ${response.status} ${response.statusText}`);
			throw new Error(`Server error: ${response.status} ${response.statusText}`);
		}

		// parse the data
		this.raw = await response.text();
	}
}

async function initMetars() {
	// create metars
	depMetar = await Metar.create(flightPlan.origin.icao_code);
	arrMetar = await Metar.create(flightPlan.destination.icao_code);

	displayMetars();
}

async function refreshMetars() {
	// update metars
	await depMetar.update();
	await arrMetar.update();

	// display the new metars
	displayMetars();
}

function displayMetars() {
	// if decode is enabled, show the decoded version, otherwise raw
	if (decode.checked) {
		flightPlanMetars.textContent = decodeMetar(depMetar.raw, depMetar.icao) + "\n\n";
		flightPlanMetars.textContent += decodeMetar(arrMetar.raw, arrMetar.icao) || "Not available";
	} else {
		flightPlanMetars.textContent = ((depMetar.raw == "") ? `Metar for ${depMetar.icao} not available` : depMetar.raw) + "\n\n";
		flightPlanMetars.textContent += ((arrMetar.raw == "") ? `Metar for ${arrMetar.icao} not available` : arrMetar.raw);
	}
}

async function displaySearchMetar() {
	// get the metar for icao
	searchMetar = await Metar.create(searchMetarInput.value);

	// return if no metar has been requested
	if (searchMetarInput == "") return;

	if (decode.checked) {
		searchMetarOutput.textContent = decodeMetar(searchMetar.raw, searchMetar.icao);
	} else {
		searchMetarOutput.textContent = (searchMetar.raw == "") ? `Metar for ${searchMetar.icao} not available` : searchMetar.raw;
	}
}

function decodeMetar(raw, icao) {
	// tell user if metar is not available
	if (raw == "") return `Metar for ${icao} not available`;

	// remove identifier and resulting whitespace at start
	let trimmed = raw.slice(4, raw.length);

	// regex expressions
	let age = /\d{4}Z/i;
	let wind = /\d{5}(G\d{2})?KT|VRB\d{2}(G\d{2})?KT/i;
	let varying = /(?<!CIG )\d{3}V\d{3}/i;
	let visibility = /\s\d{4}\s|(\d{1})?(\/)?\d{1}SM|\d{1,2}KM/i;
	let clouds = /NCD|NSC|SKC|CLR|FEW\d{3}|SCT\d{3}|BKN\d{3}|OVC\d{3}/ig;
	let cavok = /CAVOK/i;
	let tempDew = / M?\d{2}\/M?(\d{2})?/i;
	let pressure = /[AQ]\d{4}/i;

	// find individual parts of the metar
	let parts = {
		icao: raw.slice(0, 4),
		age: trimmed.match(age),
		wind: trimmed.match(wind),
		varying: trimmed.match(varying),
		vis: trimmed.match(visibility),
		clouds: trimmed.match(clouds),
		cavok: cavok.test(trimmed),
		tempDew: trimmed.match(tempDew),
		pressure: trimmed.match(pressure)
	};

	// give every thing a value
	for (let part in parts) {
		if (!parts[part]) parts[part] = ["not available"];
	}

	// add gusting if applicable
	let gusting = "";
	if (parts.wind[0].includes("G")) gusting = `, gusting ${parts.wind[0].slice(6, 8)} knots`;

	if (parts.wind[0] != "not available") {
		if (parts.wind[0].includes("VRB")) {
			parts.wind[0] = `variable at ${+parts.wind[0].slice(3, 5)} knots`;
		} else {
			parts.wind[0] = `${parts.wind[0].slice(0, 3)}\u00b0 at ${+parts.wind[0].slice(3, 5)} knots`;
		}

	}

	// make cavok true or false
	if (parts.cavok[0] == "not available") {
		parts.cavok = false;
	}

	// if visibility of format xxxx then turn into xx km
	if (parts.vis[0] != "not available") {
		if (Number(parts.vis[0]) > 99) {
			if (Number(parts.vis[0]) == 9999) {
				parts.vis[0] = Math.round(Number(parts.vis[0]) / 1000) + "km or more";
			} else {
				parts.vis[0] = Math.round(Number(parts.vis[0]) / 1000) + "km";
			}
		}
	}

	// if in miles change sm suffix to mi
	if (parts.vis[0].includes("SM")) {
		parts.vis[0] = parts.vis[0].replace("SM", "mi");
	}

	if (parts.cavok) {
		parts.vis[0] = "Ceiling and visibility okay";
	} else {
		// add visibility to the start
		parts.vis[0] = "Visibility " + parts.vis[0].toLowerCase();
	}

	// turn cloud layers into sentences
	let cloudWords = "";
	for (let cloud of parts.clouds) {
		if (cloud == "NCD" || cloud == "NSC" || cloud == "SKC" || cloud == "CLR") {
			cloudWords = "No clouds. ";
			break;
		}

		switch (cloud.slice(0, 3)) {
			case "FEW":
				cloudWords += `Few clouds at ${+cloud.slice(3, 6)}00ft. `;
				break;
			case "SCT":
				cloudWords += `Scattered clouds at ${+cloud.slice(3, 6)}00ft. `;
				break;
			case "BKN":
				cloudWords += `Broken clouds at ${+cloud.slice(3, 6)}00ft. `;
				break;
			case "OVC":
				cloudWords += `Overcast clouds at ${+cloud.slice(3, 6)}00ft. `;
				break;
		}
	}

	// turn M (minus) into -
	parts.tempDew[0] = parts.tempDew[0].replaceAll("M", "-");

	// find slash for temp/dew
	let slash = parts.tempDew[0].length;
	for (let i = 0; i < parts.tempDew[0].length; i++) {
		if (parts.tempDew[0][i] == "/") {
			slash = i;
			break;
		}
	}

	// detect if only temp available
	let dewpoint = "";
	if (parts.tempDew[0].length < 6) {
		dewpoint = "not available";
	} else {
		dewpoint = `${+parts.tempDew[0].slice(slash + 1, parts.tempDew[0].length)}\u00b0C`;
	}

	// remove zeros
	if (parts.tempDew[0] != "not available") parts.tempDew[0] = `${+parts.tempDew[0].slice(0, slash)}\u00b0C, Dewpoint ${dewpoint}`;

	// wind variation
	if (parts.varying[0] == "not available") {
		parts.varying[0] = "";
	} else {
		parts.varying[0] = `, varying between ${parts.varying[0].slice(0, 3)}\u00b0 and ${parts.varying[0].slice(4, 7)}\u00b0`;
	}

	// add pressure unit
	if (parts.pressure[0][0] == "Q") {
		parts.pressure[0] = `QNH ${+parts.pressure[0].slice(1)}hPa`;
	} else if (parts.pressure[0][0] == "A") {
		parts.pressure[0] = `${parts.pressure[0].slice(0, 3)}.${String(parts.pressure[0].slice(3, 5))}`;
		parts.pressure[0] = `Altimeter ${+parts.pressure[0].slice(1)}inHg`;
	}

	// turn into a paragraph
	return `METAR for ${parts.icao}. Issued at ${parts.age[0].slice(0, 2)}:${parts.age[0].slice(2, 4)} UTC. Wind ${parts.wind[0]}${gusting}${parts.varying[0]}. ${parts.vis[0]}. ${cloudWords}Temperature ${parts.tempDew[0]}. ${parts.pressure[0]}.`;
}

// function for decoding the metars. It is a variable because we add to it when a flight plan is available
let decodeFunction = () => displaySearchMetar();
decode.addEventListener("click", () => decodeFunction());

searchMetarInput.addEventListener("keydown", e => {
	if (e.key == "Enter") {
		searchMetarButton.click();
		searchMetarInput.blur();
	}
});

searchMetarButton.addEventListener("click", displaySearchMetar);