let map;
let scale = 15;
const triangle = L.icon({
	iconUrl: "images/marker-icon.png",
	iconSize: [250 / scale, 232 / scale],
	iconAnchor: [122 / scale, 150 / scale],
	popupAnchor: [0, 0],
});

scale = 20;
const planeIcon = L.icon({
	iconUrl: "images/plane.png",
	iconSize: [512 / scale, 512 / scale],
	iconAnchor: [256 / scale, 256 / scale],
	popupAnchor: [256 / scale, 256 / scale],
});

let planeMarker = L.marker();
let centerAircraft = false;

function initMap(waypoints, altRoutes) {
	// remove the current map if there is one
	if (map) {
		map.remove();
	}

	// create the map
	map = L.map("map", {
		fullscreenControl: true,
		scrollWheelZoom: false,
		smoothWheelZoom: true,
		smoothSensitivity: 2,
		zoom: 13,
	}).on("mousedown", () => centerAircraft = false);

	// add a map layer
	let dark = true;
	let tileLayer = L.tileLayer.colorFilter("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom: 19,
		attribution: "&copy; <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
		filter: ["invert:100%", "grayscale:100%", "contrast:125%", "brightness:90%"]
	}).addTo(map);

	// enable map theme switching
	document.getElementById("map-theme").addEventListener("click", () => {
		document.querySelectorAll(".leaflet-marker-icon").forEach(e => e.classList.toggle("dark", !dark));
		document.querySelectorAll(".leaflet-marker-icon").forEach(e => e.classList.toggle("light", dark));
		if (dark) {
			dark = false;

			document.querySelectorAll(".leaflet-container").forEach(e => e.style.setProperty("background", "#ddd", "important"));
			document.querySelectorAll(".leaflet-control-zoom-out, .leaflet-control-zoom-in, .leaflet-control-zoom-fullscreen.leaflet-fullscreen-icon").forEach(e => e.style.filter = "none");

			tileLayer.updateFilter([
				"invert:0%",
				"grayscale:0%",
				"contrast:100%",
				"brightness:100%"
			]);
		} else {
			dark = true;

			document.querySelectorAll(".leaflet-container").forEach(e => e.style.setProperty("background", "#000", "important"));
			document.querySelectorAll(".leaflet-control-zoom-out, .leaflet-control-zoom-in, .leaflet-control-zoom-fullscreen.leaflet-fullscreen-icon").forEach(e => e.style.filter = "invert(100%) contrast(50%)");

			tileLayer.updateFilter([
				"invert:100%",
				"grayscale:100%",
				"contrast:125%",
				"brightness:90%"
			]);
		}
	});

	// centre the map on the departure airport
	map.setView([waypoints[0].lat, waypoints[0].long], 10);

	drawRoute(waypoints, altRoutes, -360);
	drawRoute(waypoints, altRoutes);
	drawRoute(waypoints, altRoutes, 360);
}

function unwrap(waypoints) {
	if (waypoints.length == 0) return [];

	// array to hold the unwrapped points
	const unwrapped = [];

	let prevLong = waypoints[0].long;

	// push first waypoint without changes
	unwrapped.push({...waypoints[0]});

	for (let i = 1; i < waypoints.length; i++) {
		let long = waypoints[i].long;

		// calculate difference
		let diff = long - prevLong;

		// if crossing the antimeridian
		if (diff > 180) long -= 360;
		else if (diff < -180) long += 360;

		// push unwrapped waypoint
		unwrapped.push({...waypoints[i], long: long});

		// update previous long
		prevLong = long;
	}

	return unwrapped;
}

function drawRoute(waypoints, altRoutes, offset = 0) {
	// unwrap waypoints
	const unwrapped = unwrap(waypoints);

	// add markers for each waypoint
	let i = 1;
	for (const wp of unwrapped) {
		let lat = wp.lat;
		let long = wp.long + offset;

		// add the marker and a line going to the next waypoint
		let marker = L.marker([lat, long], {icon: triangle}).addTo(map);
		marker._icon.classList.add("dark");
		marker.bindTooltip(`<strong>${wp.ident}</strong><br/>${wp.name}<br/>${wp.info}`);

		if (i < unwrapped.length) {
			L.polyline([
				[lat, long],
				[unwrapped[i].lat, unwrapped[i].long + offset]
			]).addTo(map);

			// add a thicker invisible line to make the tooltip easier to access
			let tipLine = L.polyline([
				[lat, long],
				[unwrapped[i].lat, unwrapped[i].long + offset]
			], {
				color: "#0000",
				weight: 20,
				opacity: 0,
			}).addTo(map);
			tipLine.bindTooltip(`<strong>${wp.via_airway}</strong><br/>${wp.distance}NM<br/>${wp.track_true}\u00b0T, ${wp.track_mag}\u00b0M`, {sticky: true});
		}

		i++;
	}

	// alternate waypoints
	for (const waypointsSet of altRoutes) {
		// pass full route so alt route lines up
		const altUnwrapped = unwrap([...unwrapped, ...waypointsSet]).slice(unwrapped.length);

		i = 1;
		for (const wp of altUnwrapped) {
			let lat = wp.lat;
			let long = wp.long + offset;

			// add the marker and a line going to the next wp
			let marker = L.marker([lat, long], {icon: triangle}).addTo(map);
			marker._icon.classList.add("dark");
			marker.bindTooltip(`<strong>${wp.ident}</strong><br/>${wp.name}<br/>${wp.info}`);

			if (i < altUnwrapped.length) {
				L.polyline([
					[lat, long],
					[altUnwrapped[i].lat, altUnwrapped[i].long + offset]
				], {
					dashArray: "5, 10",
					dashOffset: "0",
					color: "red"
				}).addTo(map);

				// add a thicker invisible line to make the tooltip easier to access
				let tipLine = L.polyline([
					[lat, long],
					[altUnwrapped[i].lat, altUnwrapped[i].long + offset]
				], {
					color: "#0000",
					weight: 20,
					opacity: 0,
				}).addTo(map);
				tipLine.bindTooltip(`<strong>${wp.via_airway}</strong><br/>${wp.distance}NM<br/>${wp.track_true}\u00b0T, ${wp.track_mag}\u00b0M`, {sticky: true});
			}

			i++;
		}
	}
}

function displayAircraft(aircraft) {
	const latLong = [aircraft.latitude, aircraft.longitude];

	// remove old marker
	if (planeMarker) planeMarker.remove();

	// add aircraft
	planeMarker = L.marker(latLong, {
		icon: planeIcon,
		rotationOrigin: "center center",
		rotationAngle: aircraft.heading,
	}).addTo(map).on("click", () => centerAircraft = true);

	// tooltip
	planeMarker.bindTooltip("Click to follow aircraft");

	// center map on aircraft
	if (centerAircraft) map.setView(latLong);
}