import "./styles.css";
import { App } from "./app.ts";

const appEl = document.querySelector("#app");
const ltext = document.querySelector("#ltext");
const loader = document.querySelector("#loader");

(async function() {
	const app = new App(appEl);

	app.init();

	await app.preload((url, i, ii) => {
		ltext.textContent = `LOADING: ${i}/${ii}`;
	});

	loader.style.display = "none";

	app.tick();
})();
