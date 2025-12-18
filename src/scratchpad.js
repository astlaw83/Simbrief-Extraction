const canvas = document.getElementById("canvas");
const scratchpad = new SignaturePad(canvas, {
	penColor: "#fff"
});

// undos and redos that can happen
let undoStack = [];
let redoStack = [];

// name of current scratchpad if saved
let scratchpadName;

// current scratchpad template
let currentTemplate = "draw";

// elements
const typeTemplate = document.getElementById("type-template");
const craftTemplate = document.getElementById("craft-template");
const craftInputToggle = document.getElementById("craft-input-toggle");
const atisTemplate = document.getElementById("atis-template");
const atisInputToggle = document.getElementById("atis-input-toggle");

const fileButtons = document.getElementById("option-buttons");
const editingButtons = document.getElementById("editing-buttons");
const templates = document.getElementById("scratchpad-templates");
const savedOptions = document.getElementById("saved-scratchpads");
const saveStatus = document.getElementById("save-status");

// if there are no saved scratchpads, add one that is blank
if (!localStorage.getItem("savedScratchpads")) localStorage.setItem("savedScratchpads", JSON.stringify({}));

function getSavedScratchpads() {
	return JSON.parse(localStorage.getItem("savedScratchpads"));
}

function saveScratchpad(scratchpadName) {
	saveStatus.textContent = "";
	if (!scratchpadName) return;

	let data = [];
	let text = [];
	switch (currentTemplate) {
		case "draw":
			data = scratchpad.toData();
			break;
		case "type":
			text = typeTemplate.value;
			break;
		case "atis":
			data = scratchpad.toData();
			document.querySelectorAll(".atis-input").forEach((e) => text.push(e.textContent));
			break;
		case "craft":
			data = scratchpad.toData();
			document.querySelectorAll(".craft-input").forEach((e) => text.push(e.textContent));
			break;
	}

	let currentScratchpad = {
		template: currentTemplate,
		data: data,
		text: text
	};

	// get saved scratchpads
	let savedScratchpads = getSavedScratchpads();

	// add new scratchpad
	savedScratchpads[scratchpadName] = currentScratchpad;

	// update saved scratchpads
	localStorage.setItem("savedScratchpads", JSON.stringify(savedScratchpads));

	// tell user scratchpad has been saved
	saveStatus.textContent = `(Saved) ${scratchpadName}`;
}

function hideMenus() {
	fileButtons.classList.remove("open");
	editingButtons.classList.remove("open");
}

function deleteScratchpad(chosenScratchpad) {
	if (!confirm("Are you sure?")) {
		hideMenus();
		return;
	}

	let savedScratchpads = getSavedScratchpads();
	delete savedScratchpads[chosenScratchpad];
	localStorage.setItem("savedScratchpads", JSON.stringify(savedScratchpads));
}

function populateSavedScratchpads() {
	// get saved scratchpads
	let savedScratchpads = getSavedScratchpads();

	// get list of options
	let options = document.getElementById("saved-scratchpads-container");

	// clear list
	options.innerHTML = "";

	// populate with saved scratchpads
	for (let savedScratchpad of Object.keys(savedScratchpads)) {
		// create a div
		const option = document.createElement("div");

		option.textContent = savedScratchpad; // give it the name of the scratchpad
		option.classList = "saved-scratchpad-option"; // give it a class for styling

		// delete img
		const deleteImg = document.createElement("img");
		deleteImg.src = "images/delete.png";

		// event listener to delete scratchpad
		deleteImg.addEventListener("click", e => {
			e.stopPropagation();

			// delete the scratchpad
			deleteScratchpad(deleteImg.parentElement.textContent);

			// update the options
			populateSavedScratchpads();

			// close menu and reset if there are no scratchpads left
			let savedScratchpads = getSavedScratchpads();

			if (Object.keys(savedScratchpads).length != 0) return;

			// reset
			scratchpadName = undefined;
			saveScratchpad();
			setTemplate("draw");
			scratchpad.clear();

			savedOptions.close("cancel");
			hideMenus();
		});

		// add img to option
		option.appendChild(deleteImg);

		// event listener
		option.addEventListener("click", () => savedOptions.close(option.textContent));

		// add it to the list of options
		options.appendChild(option);
	}
}

scratchpad.addEventListener("beginStroke", () => undoStack.push(structuredClone(scratchpad.toData())));

// autosave after stroke
scratchpad.addEventListener("endStroke", () => {
	hideMenus();

	// clear redo stack on new stroke to keep redos/undos branchless
	redoStack = [];

	// only autosave if already saved
	if (!scratchpadName) return;
	saveScratchpad(scratchpadName);
});

document.getElementById("hamburger-menu").addEventListener("click", () => {
	fileButtons.classList.toggle("open");
	editingButtons.classList.remove("open");
});

document.getElementById("dot-menu").addEventListener("click", () => {
	editingButtons.classList.toggle("open");
	fileButtons.classList.remove("open");
});

// file buttons
document.getElementById("new-scratchpad-button").addEventListener("click", () => templates.showModal());

document.querySelectorAll(".scratchpad-template").forEach(e => {
	e.addEventListener("click", () => templates.close(e.dataset.value));
});

document.getElementById("cancel-new-scratchpad").addEventListener("click", () => templates.close("cancel"));

templates.addEventListener("close", () => {
	hideMenus();

	if (templates.returnValue == "cancel") return;

	// reset
	scratchpad.clear();
	document.querySelectorAll(".craft-input").forEach(e => e.innerHTML = "<br/>");
	document.querySelectorAll(".atis-input").forEach(e => e.innerHTML = "");
	scratchpadName = undefined;

	saveScratchpad(scratchpadName);
	setTemplate(templates.returnValue);
});

document.getElementById("open-scratchpad-button").addEventListener("click", () => {
	// show the saved scratchpads dialog
	savedOptions.showModal();

	// poulate options
	populateSavedScratchpads();
});

savedOptions.addEventListener("close", () => {
	hideMenus();

	if (savedOptions.returnValue == "cancel") return;

	let savedScratchpads = getSavedScratchpads();

	resize();
	let currentScratchpad = savedScratchpads[savedOptions.returnValue];
	setTemplate(currentScratchpad.template, true, currentScratchpad);
	scratchpad.fromData(currentScratchpad.data);
	scratchpadName = savedOptions.returnValue;
	saveScratchpad(scratchpadName);
});

document.getElementById("cancel-open-scratchpad").addEventListener("click", () => {
	hideMenus();

	savedOptions.close("cancel");
});

document.getElementById("save-scratchpad-button").addEventListener("click", () => {
	scratchpadName = prompt("ScratchPad Name", `ScratchPad ${new Date().toISOString()}`) || scratchpadName;
	saveScratchpad(scratchpadName);

	hideMenus();
});

document.getElementById("delete-scratchpad-button").addEventListener("click", () => {
	if (!scratchpadName) {
		hideMenus();
		return;
	}

	// delete the scratchpad
	deleteScratchpad(scratchpadName);

	// reset
	scratchpadName = undefined;
	saveScratchpad();
	setTemplate("draw");
	scratchpad.clear();

	hideMenus();
});

// editing buttons
document.getElementById("clear-button").addEventListener("click", () => {
	let data = structuredClone(scratchpad.toData());
	if (data.length > 0) {
		undoStack.push(data); // add to undos
		scratchpad.clear(); // clear pad
	}

	// clear all text inputs
	typeTemplate.value = "";
	document.querySelectorAll(".craft-input").forEach(e => e.innerHTML = "<br/>");
	document.querySelectorAll(".atis-input").forEach(e => e.innerHTML = "");

	// only autosave if already saved
	if (!scratchpadName) return;
	saveScratchpad(scratchpadName);
});

document.getElementById("undo-button").addEventListener("click", () => {
	// return if nothing to undo
	if (undoStack.length == 0) return;

	let data = structuredClone(scratchpad.toData());
	redoStack.push(data);

	let undo = undoStack.pop();
	scratchpad.fromData(undo);

	// only autosave if already saved
	if (!scratchpadName) return;
	saveScratchpad(scratchpadName);
});

document.getElementById("redo-button").addEventListener("click", () => {
	if (redoStack.length == 0) return;

	undoStack.push(structuredClone(scratchpad.toData()));

	let next = redoStack.pop();
	scratchpad.fromData(next);  // redraw with redo

	// only autosave if already saved
	if (!scratchpadName) return;
	saveScratchpad(scratchpadName);
});

// atis and craft toggle input mode
craftInputToggle.addEventListener("click", () => {
	if (craftInputToggle.dataset.value == "draw") {
		craftInputToggle.dataset.value = "type";

		// disable canvas
		canvas.style.pointerEvents = "none";

		// focus first field
		document.querySelector(".craft-input").focus();

		// update icon
		document.querySelector("#craft-input-toggle img").src = "images/text-cursor.png";
	} else if (craftInputToggle.dataset.value == "type") {
		craftInputToggle.dataset.value = "draw";

		// enable canvas
		canvas.style.pointerEvents = "auto";

		// focus canvas
		canvas.focus();

		// update icon
		document.querySelector("#craft-input-toggle img").src = "images/scratchpad.png";
	}

});

atisInputToggle.addEventListener("click", () => {
	if (atisInputToggle.dataset.value == "draw") {
		atisInputToggle.dataset.value = "type";

		// disable canvas
		canvas.style.pointerEvents = "none";

		// focus first field
		document.querySelector(".atis-input").focus();

		// update icon
		document.querySelector("#atis-input-toggle img").src = "images/text-cursor.png";
	} else if (atisInputToggle.dataset.value == "type") {
		atisInputToggle.dataset.value = "draw";

		// enable canvas
		canvas.style.pointerEvents = "auto";

		// focus canvas
		canvas.focus();

		// update icon
		document.querySelector("#atis-input-toggle img").src = "images/scratchpad.png";
	}

});

// change craft and atis focus on enter key
const craftInputs = document.querySelectorAll(".craft-input");
craftInputs.forEach((e, index) => e.addEventListener("keydown", event => {
	if (event.key == "Enter" && event.shiftKey) {
		event.preventDefault();

		if (index > 0) {
			craftInputs[index - 1].focus();
		}

		return;
	}

	if (event.key == "Enter") {
		event.preventDefault();

		if (index < craftInputs.length - 1) {
			craftInputs[index + 1].focus();
		}
	}
}));

const atisInputs = document.querySelectorAll(".atis-input");
atisInputs.forEach((e, index) => e.addEventListener("keydown", event => {
	if (event.key === "Enter" && event.ctrlKey) {
		event.preventDefault();

		const range = window.getSelection().getRangeAt(0);
		const br = document.createElement("br");
		range.insertNode(br);

		// move cursor after the br
		range.setStartAfter(br);
		range.setEndAfter(br);

		return;
	}

	if (event.key == "Enter" && event.shiftKey) {
		event.preventDefault();

		if (index > 0) {
			atisInputs[index - 1].focus();
		}

		return;
	}

	if (event.key == "Enter") {
		event.preventDefault();

		if (index < atisInputs.length - 1) {
			atisInputs[index + 1].focus();
		}
	}
}));

// redraw on resize
window.addEventListener("resize", resize);

function resize() {
	// set canvas drawing buffer
	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	// redraw as setting buffers clears canvas
	scratchpad.redraw();
}

// switch pages
document.getElementById("scratchpad-button").addEventListener("click", () => {
	briefingPage.style.display = "none";
	scratchpadPage.style.display = "block";

	resize();
});

function setTemplate(template, populate = false, data = {}) {
	switch (template) {
		case "draw":
			// only show canvas
			canvas.style.display = "inline";
			canvas.style.pointerEvents = "auto";
			resize();
			typeTemplate.style.display = "none";
			craftTemplate.style.display = "none";
			atisTemplate.style.display = "none";

			currentTemplate = "draw";

			canvas.focus();
			break;
		case "type":
			// only show textarea
			canvas.style.display = "none";
			typeTemplate.style.display = "inline-block";
			craftTemplate.style.display = "none";
			atisTemplate.style.display = "none";

			currentTemplate = "type";

			// cleaar and focus the textarea
			typeTemplate.value = "";
			typeTemplate.focus();
			break;
		case "atis":
			// only show atis template and canvas
			canvas.style.display = "inline";
			canvas.style.pointerEvents = "auto";
			resize();
			typeTemplate.style.display = "none";
			craftTemplate.style.display = "none";
			atisTemplate.style.display = "grid";

			// reset input mode
			document.querySelector("#atis-input-toggle img").src = "images/scratchpad.png";
			atisInputToggle.dataset.value = "draw";

			currentTemplate = "atis";

			break;
		case "craft":
			// only show craft template and canvas
			canvas.style.display = "inline";
			canvas.style.pointerEvents = "auto";
			resize();
			typeTemplate.style.display = "none";
			craftTemplate.style.display = "grid";
			atisTemplate.style.display = "none";

			// reset input mode
			document.querySelector("#craft-input-toggle img").src = "images/scratchpad.png";
			craftInputToggle.dataset.value = "draw";

			currentTemplate = "craft";

			break;
	}

	if (!populate) return;

	switch (template) {
		case "draw":
			scratchpad.fromData(data.data);
			break;
		case "type":
			typeTemplate.value = data.text;
			break;
		case "atis":
			scratchpad.fromData(data.data);
			document.querySelectorAll(".atis-input").forEach((e, index) => e.textContent = data.text[index]);
			break;
		case "craft":
			scratchpad.fromData(data.data);
			document.querySelectorAll(".craft-input").forEach((e, index) => e.textContent = data.text[index]);
			break;
	}
}