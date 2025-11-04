let flightPlan;
const simbriefID = document.getElementById("simbriefID");
const flightInfo = document.getElementById("flightInfo");
const ofp = document.getElementById("ofp");
const metar = document.getElementById("metars");

// check if an id has been saved
let savedID = localStorage.getItem("userID");
if (savedID) simbriefID.value = savedID;

async function fetchFlightPlan() {
	// get the inputted ID
	let userID = simbriefID.value;
	let url = `https://www.simbrief.com/api/xml.fetcher.php?userid=${userID}&json=1`;

	let response = await fetch(url); // wait for the request to complete
	if (!response.ok) {
		let error = "";
		if (response.status == 400) error = "Bad Request";

		alert(`Server error (SimBrief): ${response.status} ${response.statusText}\n${error}`);
		throw new Error(`Server error: ${response.status} ${response.statusText}`);
	}

	flightPlan = await response.json(); // parse JSON data
	populateFlightData();

	// fetch the waypoints
	let waypoints = decodeWaypoints();

	// initialise the map with the waypoints
	initMap(waypoints);

	// do not allow the user to fetch another flight plan
	document.getElementById("fetchPlan").removeEventListener("click", fetchFlightPlan);

	// add a button to refresh the metars
	document.getElementById("refreshMetars").addEventListener("click", refreshMetars);
}

async function fetchMetar(icao) {
	// get the metar from vatsim
	let url = `https://metar.vatsim.net/${icao}`;
	let response = await fetch(url);

	if (!response.ok) {
		alert(`Server error (VATSIM): ${response.status} ${response.statusText}`);
		throw new Error(`Server error: ${response.status} ${response.statusText}`);
	}

	// parse the data
	let metar = await response.text();

	return metar;
}

async function refreshMetars() {
	// clear the current metars
	metar.textContent = "";

	// get the new metars
	let origin = await fetchMetar(flightPlan.origin.icao_code);
	let destination = await fetchMetar(flightPlan.destination.icao_code);

	// display them
	metar.textContent += origin +"\n\n";
	metar.textContent += destination;
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
	let origin = flightPlan.origin;
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
		let info = undefined;
		if (fix.type != "wpt" && fix.type != "ltlg" && fix.type != "apt") info = `${fix.type.toUpperCase()} ${fix.frequency}`;

		let waypoint = {ident, name, lat, long, via_airway, info};
		waypoints.push(waypoint);
		i++;
	}

	return waypoints;
}

function saveID() {
	// get the inputted ID
	let userID = simbriefID.value;

	// put the id in localStorage
	localStorage.setItem("userID", userID);
}

function secondsToHours(seconds) {
	let minutes = Math.floor(seconds / 60);
	let hours = Math.floor(minutes / 60);
	return `${hours}:${String(minutes - hours * 60).padStart(2, "0")}`;
}

document.getElementById("ofpHeader").addEventListener("click", () => ofp.requestFullscreen());
document.getElementById("saveID").addEventListener("click", saveID);
document.getElementById("fetchPlan").addEventListener("click", fetchFlightPlan);