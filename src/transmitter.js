const transmitterServer = document.getElementById("transmitter-server");
const transmitterCallsign = document.getElementById("transmitter-callsign");
const transmitterDataTable = document.getElementById("transmitter-data-table");

let aircraftData;
let server;
let timeoutId;

// check if a server has been saved
let savedServer = localStorage.getItem("transmitterServer");
if (savedServer) transmitterServer.value = savedServer;

async function fetchTransmitterData(callsign) {
	const url = `${server}/status_json.php`;

	let response = await fetch(url);

	// alert if response not 200
	if (!response.ok) {
		stopTracking();
		alert("Server returned " + response.status);
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
		alert("Aircraft not found");
		return;
	}

	// show the aircraft on the map
	displayAircraft(aircraftData);

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

	for (let i = 0; i < transmitterDataTable.rows[1].cells.length; i++) {
		transmitterDataTable.rows[1].cells[i].innerHTML = info[i].replaceAll("&amp;", "&");
	}

	timeoutId = setTimeout(() => fetchTransmitterData(callsign), 1000);
}

function stopTracking() {
	clearTimeout(timeoutId);
	clearTimeout(timeoutId);
	clearTimeout(timeoutId);
	clearTimeout(timeoutId);
}

function clearTransmitter() {
	// clear table
	for (let i = 0; i < transmitterDataTable.rows[1].cells.length; i++) {
		transmitterDataTable.rows[1].cells[i].innerHTML = "-";
	}

	// remove aircraft from map
	if (planeMarker) planeMarker.remove();
	planeMarker = undefined;
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
	if (map && transmitterCallsign.value) {
		// clear current
		stopTracking();
		clearTransmitter();

		server = transmitterServer.value;
		fetchTransmitterData(transmitterCallsign.value);
	}
});
document.getElementById("transmitter-stop-tracking").addEventListener("click", () => {
	stopTracking();
	clearTransmitter();
});