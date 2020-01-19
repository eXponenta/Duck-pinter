import "./styles.css";
import { App } from "./App.ts";

const appEl = document.querySelector("#app");
const ltext = document.querySelector("#ltext");
const loader = document.querySelector("#loader");

(async function() {
	const params = new URL(document.location).searchParams;
	const app = new App(appEl, {
		mode: params.get("mode"),
		mobs: Number(params.get("mobs")) || 3,
		spikes: Number(params.get("spikes")),
		fast: Number(params.get("fast")),
		octs: Number(params.get("octs"))
	});

	app.init();

	await app.preload((url, i, ii) => {
		ltext.textContent = `LOADING: ${i}/${ii}`;
	});

	loader.style.display = "none";

	app.tick();
})();
