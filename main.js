const simbriefID = document.getElementById("simbrief-ID");
const ofp = document.getElementById("ofp-container");
const decode = document.getElementById("decode-checkbox");
const briefingPage = document.getElementById("briefing");
const scratchpadPage = document.getElementById("scratchpad");

let flightPlan;
let loaded = false;
let requested = false;

// check if an id has been saved
let savedID = localStorage.getItem("userID");
if (savedID) simbriefID.value = savedID;

// check for service worker
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("pwa/service-worker.js")
		.then(() => console.log("Service Worker registered"))
		.catch(console.error);
}

async function fetchFlightPlan() {
	loaded = false;

	// limit requests
	if (requested) return;
	requested = true;

	// stop transmitter
	stopTracking();
	clearTransmitter();

	// get the inputted ID
	let userID = simbriefID.value;
	let url = `https://www.simbrief.com/api/xml.fetcher.php?userid=${userID}&json=1`;

	let response;
	try {
		response = await fetch(url); // wait for the request to complete
	} catch (err) {
		console.error(err);
		alert(`Failed to fetch flight plan. Check your internet connection`);
		return;
	}


	flightPlan = await response.json(); // parse JSON data

	if (!response.ok) {
		console.log(response);
		requested = false;
		alert(`Server error (SimBrief): ${response.status}\n${flightPlan.fetch.status}`);
		throw new Error(`Server error: ${response.status}\n${flightPlan.fetch.status}`);
	} else {
		loaded = true;
	}

	populateFlightData();

	// fetch the waypoints
	let waypoints = decodeWaypoints();
	let altRoutes = decodeAlternates();

	// initialise the map with the waypoints
	initMap(waypoints, altRoutes);

	// enable button to refresh the metars
	document.getElementById("refresh-metars").addEventListener("click", refreshMetars);

	// update decode function to include the flight plan metars
	decodeFunction = () => {
		displayMetars();
		displaySearchMetar();
	};

	// ofp buttons
	document.getElementById("ofp-text-increase").addEventListener("click", () => incrementOfpFontSize(1));
	document.getElementById("ofp-text-decrease").addEventListener("click", () => incrementOfpFontSize(-1));
	document.addEventListener("keydown", e => {
		if (e.key == "=" && e.altKey) incrementOfpFontSize(1, "increase");
		if (e.key == "-" && e.altKey) incrementOfpFontSize(-1, "decrease");
	});


	// allow more requests
	requested = false;
}

function populateFlightData() {
	let data = {
		"<strong>Callsign</strong>": flightPlan.atc.callsign,
		"<strong>Departure</strong>": `${flightPlan.origin.icao_code}/${flightPlan.origin.plan_rwy}`,
		"<strong>Destination</strong>": `${flightPlan.destination.icao_code}/${flightPlan.destination.plan_rwy}`,
		"<strong>Initial Altitude</strong>": flightPlan.general.initial_altitude + "ft",
		"<strong>Distance</strong>": flightPlan.general.route_distance + "NM",
		"<strong>Block Time</strong>": secondsToHours(flightPlan.times.est_block),
		"<strong>Route</strong>": flightPlan.general.route,
	};

	// put all the data into a string
	let info = "";
	for (let item in data) {
		info += `${item}: ${data[item]}\n`;
	}

	// add the data to the textarea
	document.getElementById("flight-info").innerHTML = info;

	// fetch and display the ofp
	ofp.innerHTML = flightPlan.text.plan_html;
	// give text an id
	ofp.children[0].children[0].id = "ofp-text";

	// change styles
	ofp.children[0].style.lineHeight = 1.1;

	// fill in the metar
	initMetars();
}

function decodeWaypoints() {
	// each waypoint is stored as an object with {ident, name, lat, long, via_airway, distance, track_true, track_mag, info}
	let waypoints = [];

	// start with the departure airport
	const origin = flightPlan.origin;
	let ident = origin.icao_code;
	let name = origin.name;
	let lat = Number(origin.pos_lat);
	let long = Number(origin.pos_long);

	// all are to the next waypoint
	let via_airway = flightPlan.navlog.fix[0].via_airway;
	let distance = flightPlan.navlog.fix[0].distance;
	let track_true = flightPlan.navlog.fix[0].track_true;
	let track_mag = flightPlan.navlog.fix[0].track_mag;

	let info = "";

	// add the data as an object to the array
	let waypoint = {ident, name, lat, long, via_airway, distance, track_true, track_mag, info};
	waypoints.push(waypoint);

	let i = 1;
	for (let fix of flightPlan.navlog.fix) {
		let ident = fix.ident;
		let name = fix.name;
		let lat = Number(fix.pos_lat);
		let long = Number(fix.pos_long);

		let via_airway = "";
		let distance = "";
		let track_true = "";
		let track_mag = "";
		if (i < flightPlan.navlog.fix.length) {
			via_airway = flightPlan.navlog.fix[i].via_airway;
			distance = flightPlan.navlog.fix[i].distance;
			track_true = flightPlan.navlog.fix[i].track_true;
			track_mag = flightPlan.navlog.fix[i].track_mag;
		}

		let info = "";
		if (fix.type != "wpt" && fix.type != "ltlg" && fix.type != "apt") info = `${fix.type.toUpperCase()} ${fix.frequency}`;

		let waypoint = {ident, name, lat, long, via_airway, distance, track_true, track_mag, info};
		waypoints.push(waypoint);
		i++;
	}

	return waypoints;
}

function decodeAlternates() {
	let altRoutes = [];
	let alternateCount;

	// get the number of alternates
	if (Array.isArray(flightPlan.alternate)) {
		alternateCount = flightPlan.alternate.length;
	} else if (flightPlan.alternate.icao_code) {
		alternateCount = 1;
	} else {
		// return if none
		return [];
	}

	// loop through if more than one alternate
	if (alternateCount > 1) {
		for (let altNavlog of flightPlan.alternate_navlog) {
			let waypoints = [];

			// add the destination airport (that is where the alternate route starts from)
			const destination = flightPlan.destination;
			let ident = destination.icao_code;
			let name = destination.name;
			let lat = Number(destination.pos_lat);
			let long = Number(destination.pos_long);

			// all are to the next waypoint
			let via_airway = altNavlog.fix[0].via_airway;
			let distance = altNavlog.fix[0].distance;
			let track_true = altNavlog.fix[0].track_true;
			let track_mag = altNavlog.fix[0].track_mag;

			let info = "";

			// add the data as an object to the array
			let waypoint = {ident, name, lat, long, via_airway, distance, track_true, track_mag, info};
			waypoints.push(waypoint);

			let i = 1;
			for (let fix of altNavlog.fix) {
				let ident = fix.ident;
				let name = fix.name;
				let lat = Number(fix.pos_lat);
				let long = Number(fix.pos_long);

				let via_airway = "";
				let distance = "";
				let track_true = "";
				let track_mag = "";
				if (i < flightPlan.navlog.fix.length) {
					via_airway = altNavlog.fix[i].via_airway;
					distance = altNavlog.fix[i].distance;
					track_true = altNavlog.fix[i].track_true;
					track_mag = altNavlog.fix[i].track_mag;
				}

				let info = "";
				if (fix.type != "wpt" && fix.type != "ltlg" && fix.type != "apt") info = `${fix.type.toUpperCase()} ${fix.frequency}`;

				let waypoint = {ident, name, lat, long, via_airway, distance, track_true, track_mag, info};
				waypoints.push(waypoint);
				i++;
			}
			altRoutes.push(waypoints);
		}
	} else {
		let waypoints = [];

		// add the destination airport (that is where the alternate route starts from)
		const destination = flightPlan.destination;
		let ident = destination.icao_code;
		let name = destination.name;
		let lat = Number(destination.pos_lat);
		let long = Number(destination.pos_long);

		// all are to the next waypoint
		let via_airway = flightPlan.alternate_navlog.fix[0].via_airway;
		let distance = flightPlan.alternate_navlog.fix[0].distance;
		let track_true = flightPlan.alternate_navlog.fix[0].track_true;
		let track_mag = flightPlan.alternate_navlog.fix[0].track_mag;

		let info = "";

		// add the data as an object to the array
		let waypoint = {ident, name, lat, long, via_airway, distance, track_true, track_mag, info};
		waypoints.push(waypoint);

		let i = 1;
		for (let fix of flightPlan.alternate_navlog.fix) {
			let ident = fix.ident;
			let name = fix.name;
			let lat = Number(fix.pos_lat);
			let long = Number(fix.pos_long);

			let via_airway = "";
			let distance = "";
			let track_true = "";
			let track_mag = "";
			if (i < flightPlan.alternate_navlog.fix.length) {
				via_airway = flightPlan.alternate_navlog.fix[i].via_airway;
				distance = flightPlan.alternate_navlog.fix[i].distance;
				track_true = flightPlan.alternate_navlog.fix[i].track_true;
				track_mag = flightPlan.alternate_navlog.fix[i].track_mag;
			}

			let info = "";
			if (fix.type != "wpt" && fix.type != "ltlg" && fix.type != "apt") info = `${fix.type.toUpperCase()} ${fix.frequency}`;

			let waypoint = {ident, name, lat, long, via_airway, distance, track_true, track_mag, info};
			waypoints.push(waypoint);
			i++;
		}

		altRoutes.push(waypoints);
	}

	return altRoutes;
}

function getTimestamp(offsetHours) {
	let utc = Date.now();
	return utc + (offsetHours * 3600000);
}

updateClocks();

function updateClocks() {
	// get the utc time
	let now = new Date();
	let hours = String(now.getUTCHours()).padStart(2, "0");
	let minutes = String(now.getUTCMinutes()).padStart(2, "0");
	let seconds = String(now.getUTCSeconds()).padStart(2, "0");

	// display the utc time
	let clock = document.getElementById("c1");
	clock.textContent = `UTC\n${hours}:${minutes}:${seconds} Z`;

	if (loaded) {
		let timezone = flightPlan.origin.timezone;

		// get the timstamp for the local time at origin airport
		let date = new Date(getTimestamp(timezone));

		// get components
		let hours = String(date.getUTCHours()).padStart(2, "0");
		let minutes = String(date.getUTCMinutes()).padStart(2, "0");
		let seconds = String(date.getUTCSeconds()).padStart(2, "0");

		// add a plus sign in front of the offset if applicable
		if (timezone > 0) timezone = "+" + timezone;

		// display the time
		clock = document.getElementById("c2");
		clock.style.display = "inline-block";
		clock.textContent = `${flightPlan.origin.icao_code}\n${hours}:${minutes}:${seconds} (${timezone})`;


		// repeat for the destination
		timezone = flightPlan.destination.timezone;

		// get the timstamp for the local time at destination airport
		date = new Date(getTimestamp(timezone));

		// get components
		hours = String(date.getUTCHours()).padStart(2, "0");
		minutes = String(date.getUTCMinutes()).padStart(2, "0");
		seconds = String(date.getUTCSeconds()).padStart(2, "0");

		// add a plus sign in front of the offset if applicable
		if (timezone > 0) timezone = "+" + timezone;

		// display the time
		clock = document.getElementById("c3");
		clock.style.display = "inline-block";
		clock.textContent = `${flightPlan.destination.icao_code}\n${hours}:${minutes}:${seconds} (${timezone})`;
	}

	setTimeout(updateClocks, 1000);
}

function secondsToHours(seconds) {
	let minutes = Math.floor(seconds / 60);
	let hours = Math.floor(minutes / 60);
	return `${hours}:${String(minutes - hours * 60).padStart(2, "0")}`;
}

function incrementOfpFontSize(increment) {
	// get element
	const element = document.getElementById("ofp-text");

	// get current size as a number e.g. "16px" => 16
	const currentSize = Number(getComputedStyle(element).fontSize.replace("px", ""));

	// return if min size (6px font size)
	if (currentSize == 6 && Math.sign(increment) == -1) return;

	// add increment
	const newSize = currentSize + increment;

	// update element
	element.style.fontSize = newSize + "px";

	// image size
	document.querySelectorAll("#ofp a img").forEach(img => {
		const styles = getComputedStyle(img);
		let currentWidth = Number(styles.width.replace("px", ""));
		img.style.width = currentWidth + increment * 50 + "px";
	});

}

// submit on enter key
simbriefID.addEventListener("keydown", e => {
	if (e.key == "Enter") {
		document.getElementById("fetch-plan").click();
		simbriefID.blur();
	}
});

// focusing input field selects all text and all inputs are uppercase
document.querySelectorAll("input").forEach(e => e.addEventListener("focus", () => e.select()));

document.getElementById("save-ID").addEventListener("click", () => localStorage.setItem("userID", simbriefID.value));
document.getElementById("fetch-plan").addEventListener("click", fetchFlightPlan);

document.getElementById("ofp-fullscreen").addEventListener("click", () => ofp.requestFullscreen());

// switching between pages
document.getElementById("briefing-button").addEventListener("click", () => {
	briefingPage.style.display = "block";
	scratchpadPage.style.display = "none";
});