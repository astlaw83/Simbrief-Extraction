let map;
let scale = 15;
const triangle = L.icon({
	iconUrl: "marker-icon.png",
	iconSize: [250 / scale, 232 / scale],
	iconAnchor: [122 / scale, 150 / scale],
	popupAnchor: [0, 0],
});

function initMap(waypoints, altRoutes) {
	// create the map
	map = L.map("map", {
		fullscreenControl: true,
		zoom: 13
	});

	// add a map layer
	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);

	// centre the map on the departure airport
	map.setView([waypoints[0].lat, waypoints[0].long], 10);

	// add markers for each waypoint
	let i = 1;
	for (let waypoint of waypoints) {
		let lat = waypoint.lat;
		let long = waypoint.long;

		// add the marker and a line going to the next waypoint
		let marker = L.marker([lat, long], {icon: triangle}).addTo(map);
		marker.bindTooltip(`<strong>${waypoint.ident}</strong><br/>${waypoint.name}<br/>${waypoint.info || ""}`);

		if (i < waypoints.length) {
			L.polyline([
				[lat, long],
				[waypoints[i].lat, waypoints[i].long]
			]).addTo(map);

			// add a thicker invisible line to make the tooltip easier to access
			let tipLine = L.polyline([
				[lat, long],
				[waypoints[i].lat, waypoints[i].long]
			], {
				color: "#0000",
				weight: 20,
				opacity: 0,
			}).addTo(map);
			tipLine.bindTooltip(waypoint.via_airway, {sticky: true});
		}

		i++;
	}

	// alternate waypoints
	for (let waypointsSet of altRoutes) {
		i = 1;
		for (let waypoint of waypointsSet) {
			let lat = waypoint.lat;
			let long = waypoint.long;

			// add the marker and a line going to the next waypoint
			let marker = L.marker([lat, long], {icon: triangle}).addTo(map);
			marker.bindTooltip(`<strong>${waypoint.ident}</strong><br/>${waypoint.name}<br/>${waypoint.info || ""}`);

			if (i < waypointsSet.length) {
				L.polyline([
					[lat, long],
					[waypointsSet[i].lat, waypointsSet[i].long]
				], {
					dashArray: "5, 10",
					color: "red"
				}).addTo(map);

				// add a thicker invisible line to make the tooltip easier to access
				let tipLine = L.polyline([
					[lat, long],
					[waypointsSet[i].lat, waypointsSet[i].long]
				], {
					color: "#0000",
					weight: 20,
					opacity: 0,
				}).addTo(map);
				tipLine.bindTooltip(waypoint.via_airway, {sticky: true});
			}

			i++;
		}
	}

}

// https://tile.openstreetmap.org/{z}/{x}/{y}.png
// http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png