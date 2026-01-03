const transmitterStatus = document.getElementById("transmitter-status");
const transmitterServer = document.getElementById("transmitter-server");
const transmitterCallsign = document.getElementById("transmitter-callsign");
const transmitterTrails = document.getElementById("transmitter-trails");
const dataTableCheckbox = document.getElementById("transmitter-data-table-checkbox");
const transmitterTable = document.getElementById("transmitter-data");
const transmitterTableData = document.getElementById("transmitter-data-table");

let aircraftData;
let positions = [];
let tracking;
let server;
let fetchController;
let trackingInterval;

// check if a server has been saved
let savedServer = localStorage.getItem("transmitterServer");
if (savedServer) transmitterServer.value = savedServer;

async function fetchTransmitterData(callsign) {
	// return if it should not be tracking
	if (tracking == false) return;

	if (fetchController) fetchController.abort();
	fetchController = new AbortController();

	const url = `${server}/status_json.php`;

	// alert that it is tracking
	setStatus(true);
	tracking = true;

	let response;
	try {
		response = await fetch(url, {signal: fetchController.signal}); // wait for the request to complete
	} catch (err) {
		// fetch intentionally aborted
		if (err.name === "AbortError") return;

		console.error(err);
		stopTracking();
		alert("Failed to fetch data. Check your internet connection.\nTracking has stopped, please restart it");
		return;
	}

	// alert if response not ok (200)
	if (!response.ok) {
		stopTracking();
		alert("Server returned " + response.status + ".\nTracking has stopped, please restart it");
		return;
	}

	// turn into object
	let data = await response.json();

	// find aircraft in list
	aircraftData = null;
	for (const aircraft of data) {
		if (aircraft.callsign == callsign) {
			aircraftData = aircraft;
			break;
		}
	}

	// alert and return if the aircraft was not in the list
	if (!aircraftData) {
		stopTracking();
		alert("Aircraft not found.\nTracking has stopped, please restart it");
		return;
	}

	// store position
	positions.push({
		lat: aircraftData.latitude,
		long: aircraftData.longitude,
		altitude: aircraftData.altitude
	});

	// show the aircraft on the map
	displayAircraft(aircraftData);

	// show the table if user wants
	if (dataTableCheckbox.checked) transmitterTable.style.display = "flex";

	// populate the table
	let info = [
		aircraftData.time_online,
		aircraftData.altitude_formatted + "ft",
		aircraftData.heading_formatted + "\u00b0T",
		aircraftData.airspeed_formatted + "kts",
		aircraftData.groundspeed_formatted + "kts",
		aircraftData.latitude_formatted,
		aircraftData.longitude_formatted
	];

	for (let i = 0; i < transmitterTableData.rows[1].cells.length; i++) {
		transmitterTableData.rows[1].cells[i].innerHTML = info[i].replaceAll("&amp;", "&");
	}

	if (positions.length < 2 || !transmitterTrails.checked) return;

	// draw trail
	const colour = trailColour(aircraftData.altitude);
	drawTrails(positions.slice(-2), `rgb(${colour[0]}, ${colour[1]}, ${colour[2]})`);
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function lerpRgb(rgbA, rgbB, t) {
	const lerped = [];

	// lerp each channel
	for (let i = 0; i < 3; i++) {
		lerped.push(Math.round(lerp(rgbA[i], rgbB[i], t)));
	}

	return lerped;
}

function trailColour(altitude) {
	// normailise alt
	const normal = Math.max(0, Math.min(altitude / 50000, 1));

	// [r, g, b, max t value]
	const colours = [
		[200, 200, 0, 0],
		[0, 255, 0, 0.1],
		[0, 255, 255, 0.2],
		[0, 0, 255, 0.5],
		[180, 0, 180, 0.75],
		[255, 0, 0, 1]
	];

	// find the colour band the alt fits into
	for (let i = 0; i < colours.length - 1; i++) {
		const a = colours[i];
		const b = colours[i + 1];

		if (normal >= a[3] && normal <= b[3]) {
			const t = (normal - a[3]) / (b[3] - a[3]);

			return lerpRgb(a, b, t);
		}
	}
}

function setStatus(status) {
	if (status) {
		transmitterStatus.style.background = "#0a0";
		transmitterStatus.style.boxShadow = "0 0 10px #0a0";
	} else {
		transmitterStatus.style.background = "#c00";
		transmitterStatus.style.boxShadow = "0 0 10px #c00";
	}
}

function startTracking(callsign) {
	// stop current
	stopTracking();
	clearTransmitter();

	tracking = true;
	setStatus(true);

	trackingInterval = setInterval(() => fetchTransmitterData(callsign), 1000);
}

function stopTracking() {
	// hide the table
	transmitterTable.style.display = "none";

	setStatus(false);
	tracking = false;

	if (trackingInterval) {
		clearInterval(trackingInterval);
		trackingInterval = undefined;
	}
}

function clearTransmitter() {
	// clear table
	for (let i = 0; i < transmitterTableData.rows[1].cells.length; i++) {
		transmitterTableData.rows[1].cells[i].innerHTML = "-";
	}

	// remove aircraft from map
	if (planeMarker) planeMarker.remove();
	planeMarker = undefined;

	// clear trails
	if (trails) trails.clearLayers();
	positions.length = 0;
}

transmitterCallsign.addEventListener("keydown", e => {
	if (e.key == "Enter") {
		document.getElementById("transmitter-start-tracking").click();
		transmitterCallsign.blur();
	}
});

document.getElementById("save-transmitter-server").addEventListener("click", () => localStorage.setItem("transmitterServer", transmitterServer.value));
document.getElementById("reset-transmitter-server").addEventListener("click", () => transmitterServer.value = "https://transmitter.virtualflight.online");

document.getElementById("transmitter-start-tracking").addEventListener("click", () => {
	if (!transmitterCallsign.value) {
		alert("Please enter a callsign");
		return;
	}

	if (!map) initMap();

	server = transmitterServer.value;
	startTracking(transmitterCallsign.value);
});
document.getElementById("transmitter-stop-tracking").addEventListener("click", () => {
	stopTracking();
	clearTransmitter();
});

transmitterTrails.addEventListener("change", () => {
	if (transmitterTrails.checked) {
		if (positions.length < 2) return;

		// draw all saved trails
		for (let i = 0; i < positions.length - 1; i++) {
			const colour = trailColour(positions[i + 1].altitude);
			drawTrails(positions.slice(i, i + 2), `rgb(${colour[0]}, ${colour[1]}, ${colour[2]})`);
		}
	} else {
		// clear trails
		if (trails) trails.clearLayers();
	}
});

dataTableCheckbox.addEventListener("change", () => {
	if (!tracking) return;

	if (dataTableCheckbox.checked) {
		transmitterTable.style.display = "flex";
	} else {
		transmitterTable.style.display = "none";
	}
});

window.addEventListener("beforeunload", () => {
	if (fetchController) fetchController.abort();
	stopTracking();
});