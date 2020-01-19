import {
	Mesh,
	DirectionalLight,
	AmbientLight,
	Vector3,
	MeshLambertMaterial,
	FrontSide,
	Scene,
	Vector2,
	BoxBufferGeometry,
	MeshPhongMaterial,
	Color
} from "three";

import { RollerEntity, ViewCmp, MoveCmp, UserInputCmp } from "./actor/RollerEntity";
import { WorldMachine, RENDER_MODE } from "./machines/WorldMachine";
import { CameraMachine } from "./machines/CameraMachine";
import { UniversalInput } from "./math/Input";
import { BaseApp } from "./BaseApp";

// TEST ONLY
const ROPE_POOL_SIZE = 30; // how many lines for MESH render mode
const ROPE_POOL_LEN = 600; // how many segments per line for MESH render mode
const MODE = RENDER_MODE.BLIT; // BLIT - pixel render, MESH - line render

export interface IDemoOptions {
	mobs: number;
	mode: string;
	spikes: boolean;
	fast: boolean;
	octs: boolean;
}

const DEF_OPTIONS: IDemoOptions = {
	mobs: 3,
	mode: "mesh",
	spikes: true,
	fast: true,
	octs: true
};

export class App extends BaseApp {
	lights = {
		d: new DirectionalLight(0xffffff, 1),
		a: new AmbientLight(0x808080, 0.5)
	};

	inputAxis: Vector3 = new Vector3();
	input: UniversalInput = new UniversalInput();
	model: Mesh;
	worldMachine: WorldMachine;
	cameraMachine: CameraMachine;
	rollerViewPref: Scene;
	options: any;

	get player() {
		return this.worldMachine.rollersFlat[0];
	}

	constructor(appEl: HTMLElement, options: IDemoOptions) {
		super(appEl);

		this.options = options = Object.assign({}, DEF_OPTIONS, options || {});

		this.renderer.sortObjects = false;

		const { d, a } = this.lights;

		d.position.set(2, 2, 2);

		this.scene.add(a, d);

		//attach input to dom for mobiles
		this.input.attach(this.renderer.domElement);
		this.input.enable = false;

		//this.controlls = new OrbitControls(this.camera, this.renderer.domElement);
		//this.controlls.target = this.roller.position;

		const mode = (options.mode || "mesh") === "mesh" ? RENDER_MODE.MESH : RENDER_MODE.BLIT;
		const mobs = this.options.mobs || 3;

		this.cameraMachine = new CameraMachine(this.camera);
		this.worldMachine = new WorldMachine(this.scene, Math.max(ROPE_POOL_SIZE, mobs * 2), ROPE_POOL_LEN, mode);

		this.worldMachine.renderSpikes = options.spikes;
		this.worldMachine.octreeSolv = options.fast;
		this.worldMachine.renderOcts = options.octs;

		console.log("DEMO RUN OPTIONS", this.options);
	}

	init() {}

	async postInit() {
		super.postInit();

		// bin surface to machine
		await this.worldMachine.init(this.model);

		// player
		this.worldMachine.registerRoller(this.createRoller(0xf4d203), 0xf4d203, new Vector3(0, 0, 4));

		const count = Math.min(150, this.options.mobs || 3);

		for (let i = 0; i < count; i++) {
			const c = new Color(Math.random(), Math.random(), Math.random());
			const x = -3 + (6 * i) / count;
			const y = 2 * (-0.5 + Math.random());

			this.worldMachine.registerRoller(this.createRoller(c.getHex()), c.getHex(), new Vector3(x, y, 4));
		}

		// bind user input to roller
		const inputCmp = this.player.addFirst<UserInputCmp>(UserInputCmp);
		inputCmp.input = this.input;

		this.cameraMachine.target = this.player.get<ViewCmp>(ViewCmp).view;

		// bind update runners
		this.runs.update.add(this.input);
		this.runs.update.add(this.worldMachine);
		this.runs.update.add(this.cameraMachine);

		this.input.enable = true;

		// spawn any players
		this.worldMachine.spawn();
	}

	setSurface(gltfScene: Scene) {
		const model = gltfScene.children[0] as Mesh;

		if (this.model) {
			this.scene.remove(this.model);
		}

		this.model = model;

		model.material = new MeshLambertMaterial();
		model.material.side = FrontSide;

		this.scene.add(model);
	}

	async preload(progress) {
		if (progress) {
			this.manager.onProgress = progress;
		}

		const scene = await this.getModel("duck");
		const roller = await this.getModel("roller");

		this.setSurface(scene.scene);

		this.rollerViewPref = roller.scene;

		await this.postInit();
	}

	update(delta) {
		// sync light with player
		const move = this.player.get<MoveCmp>(MoveCmp);
		this.lights.d.position.copy(move.position);

		// why not? Simple bot movement
		// TODO - remove me

		this.worldMachine.rollersFlat.forEach(e => {
			if (e === this.player) return;

			e.get<MoveCmp>(MoveCmp).moveByDirection(new Vector2(0, -1));
		});
	}

	createRoller(color: number) {
		// проблемы с GLTF
		//const frame = this.rollerViewPref.clone();

		const frame = new Mesh(new BoxBufferGeometry(0.1, 0.1, 0.1), new MeshPhongMaterial({ color }));

		frame.geometry.translate(0, 0.05, 0);

		return new RollerEntity(frame);
	}
}
