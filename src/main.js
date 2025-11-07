let flightPlan;
let loaded = false;
let requested = false;
const simbriefID = document.getElementById("simbrief-ID");
const flightInfo = document.getElementById("flight-info");
const ofp = document.getElementById("ofp");
const decode = document.getElementById("decode-checkbox");
const metar = document.getElementById("metars");

// check if an id has been saved
let savedID = localStorage.getItem("userID");
if (savedID) simbriefID.value = savedID;

async function fetchFlightPlan() {
	// if already initialised don't re-init
	if (requested) {
		return;
	}

	requested = true;

	// get the inputted ID
	let userID = simbriefID.value;
	let url = `https://www.simbrief.com/api/xml.fetcher.php?userid=${userID}&json=1`;

	let response = await fetch(url); // wait for the request to complete
	flightPlan = await response.json(); // parse JSON data

	if (!response.ok) {
		console.log(response);
		console.log(flightPlan);
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

	// do not allow the user to fetch another flight plan
	document.getElementById("fetch-plan").removeEventListener("click", fetchFlightPlan);
	// enable button to refresh the metars
	document.getElementById("refresh-metars").addEventListener("click", refreshMetars);
	// enable decode toggle
	decode.addEventListener("click", displayMetars);
}

function populateFlightData() {
	let data = {
		Callsign: flightPlan.atc.callsign,
		Departure: `${flightPlan.origin.icao_code}/${flightPlan.origin.plan_rwy}`,
		Destination: `${flightPlan.destination.icao_code}/${flightPlan.destination.plan_rwy}`,
		"Initial Altitude": flightPlan.general.initial_altitude,
		Distance: `${flightPlan.general.route_distance}nm`,
		"Block Time": secondsToHours(flightPlan.times.est_block),
		Route: flightPlan.general.route,
	};

	// put all the important data into a string
	let info = "";
	for (let item in data) {
		info += `${item}: ${data[item]}\n`;
	}

	// add the data to the textarea
	flightInfo.textContent = info;

	// fetch and display the ofp
	ofp.innerHTML = flightPlan.text.plan_html;
	// style the ofp text
	ofp.children[0].children[0].classList.add("ofp");

	// fill in the metar
	refreshMetars();
}

function decodeWaypoints() {
	// each waypoint is stored as an object with {ident, name, lat, long, via_airway, info}
	let waypoints = [];

	// start with the departure airport
	const origin = flightPlan.origin;
	let ident = origin.icao_code;
	let name = origin.name;
	let lat = origin.pos_lat;
	let long = origin.pos_long;
	let via_airway = flightPlan.navlog.fix[0].via_airway;

	// add the data as an object to the array
	let waypoint = {ident, name, lat, long, via_airway};
	waypoints.push(waypoint);

	let i = 1;
	for (let fix of flightPlan.navlog.fix) {
		let ident = fix.ident;
		let name = fix.name;
		let lat = fix.pos_lat;
		let long = fix.pos_long;
		let via_airway = "0";
		if (i < flightPlan.navlog.fix.length) via_airway = flightPlan.navlog.fix[i].via_airway;
		let info;
		if (fix.type != "wpt" && fix.type != "ltlg" && fix.type != "apt") info = `${fix.type.toUpperCase()} ${fix.frequency}`;

		let waypoint = {ident, name, lat, long, via_airway, info};
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
			let lat = destination.pos_lat;
			let long = destination.pos_long;
			let via_airway = altNavlog.fix[0].via_airway;

			let waypoint = {ident, name, lat, long, via_airway};
			waypoints.push(waypoint);

			let i = 1;
			for (let fix of altNavlog.fix) {
				let ident = fix.ident;
				let name = fix.name;
				let lat = fix.pos_lat;
				let long = fix.pos_long;
				let via_airway = "0";
				if (i < altNavlog.fix.length) via_airway = altNavlog.fix[i].via_airway;
				let info;
				if (fix.type != "wpt" && fix.type != "ltlg" && fix.type != "apt") info = `${fix.type.toUpperCase()} ${fix.frequency}`;

				let waypoint = {ident, name, lat, long, via_airway, info};
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
		let lat = destination.pos_lat;
		let long = destination.pos_long;
		let via_airway = flightPlan.alternate_navlog.fix[0].via_airway;

		let waypoint = {ident, name, lat, long, via_airway};
		waypoints.push(waypoint);

		let i = 1;
		for (let fix of flightPlan.alternate_navlog.fix) {

			let ident = fix.ident;
			let name = fix.name;
			let lat = fix.pos_lat;
			let long = fix.pos_long;
			let via_airway = "0";
			if (i < flightPlan.alternate_navlog.fix.length) via_airway = flightPlan.alternate_navlog.fix[i].via_airway;
			let info;
			if (fix.type != "wpt" && fix.type != "ltlg" && fix.type != "apt") info = `${fix.type.toUpperCase()} ${fix.frequency}`;

			let waypoint = {ident, name, lat, long, via_airway, info};
			waypoints.push(waypoint);
			i++;
		}

		altRoutes.push(waypoints);
	}

	return altRoutes;
}

function saveID() {
	// get the inputted ID
	let userID = simbriefID.value;

	// put the id in localStorage
	localStorage.setItem("userID", userID);
}

function getTimestamp(offsetHours) {
	let utc = Date.now();
	return utc + (offsetHours * 3600000);
}

updateClocks();
function updateClocks() {
	// get the utc time
	let hours = String(new Date().getUTCHours()).padStart(2, "0");
	let minutes = String(new Date().getUTCMinutes()).padStart(2, "0");
	let seconds = String(new Date().getUTCSeconds()).padStart(2, "0");

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
		clock.textContent = `${flightPlan.destination.icao_code}\n${hours}:${minutes}:${seconds} (${timezone})`;
	}

	requestAnimationFrame(updateClocks);
}

function secondsToHours(seconds) {
	let minutes = Math.floor(seconds / 60);
	let hours = Math.floor(minutes / 60);
	return `${hours}:${String(minutes - hours * 60).padStart(2, "0")}`;
}

document.getElementById("ofp-fullscreen").addEventListener("click", () => ofp.requestFullscreen());
document.getElementById("save-ID").addEventListener("click", saveID);
document.getElementById("fetch-plan").addEventListener("click", fetchFlightPlan);