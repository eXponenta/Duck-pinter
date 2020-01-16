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
	MeshToonMaterial,
	MeshPhongMaterial
} from "three";

import { Roller2 } from "./actor/Roller2";
import { BaseApp } from "./BaseApp";
import { PoolMachine } from "./math/PoolMachine";
import { CameraMachine } from "./actor/CameraMachine";
import { UniversalInput } from "./math/Input";

// TEST ONLY
const ROPE_POOL_SIZE = 30;
const ROPE_POOL_LEN = 300;

export class App extends BaseApp {
	lights = {
		d: new DirectionalLight(0xffffff, 1),
		a: new AmbientLight(0x808080, 0.5)
	};

	inputAxis: Vector3 = new Vector3();
	input: UniversalInput = new UniversalInput();
	model: Mesh;
	poolMachine: PoolMachine;
	cameraMachine: CameraMachine;
	rollerViewPref: Scene;

	get player() {
		return this.poolMachine.rollersFlat[0];
	}

	constructor(appEl: HTMLElement) {
		super(appEl);

		const { d, a } = this.lights;

		d.position.set(2, 2, 2);

		this.scene.add(a, d);

		this.input.attach(this.renderer.domElement);
		this.input.enable = false;

		//this.controlls = new OrbitControls(this.camera, this.renderer.domElement);
		//this.controlls.target = this.roller.position;

		this.cameraMachine = new CameraMachine(this.camera);
		this.poolMachine = new PoolMachine(this.scene, ROPE_POOL_SIZE, ROPE_POOL_LEN);
	}

	init() {}

	postInit() {
		super.postInit();

		this.poolMachine.init(this.model);

		this.poolMachine.registerRoller(this.createRoller(0xf4d203), 0xf4d203, new Vector3(1, 0, 4));
		this.poolMachine.registerRoller(this.createRoller(0x00ff00), 0x00ff00, new Vector3(-1, 0, 4));
		this.poolMachine.registerRoller(this.createRoller(0x0000ff), 0x0000ff, new Vector3(-1, 1, 4));

		this.cameraMachine.target = this.player.view;

		this.runs.update.add(this.input);
		this.runs.update.add(this.poolMachine);

		// udapte after pool update
		this.poolMachine.rollersFlat.forEach(r => {
			this.runs.update.add(r);
		});

		this.runs.update.add(this.cameraMachine);

		this.input.enable = true;

		this.poolMachine.spawn();
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

		this.setSurface(scene.scene);

		const roller = await this.getModel("roller");

		this.rollerViewPref = roller.scene;

		//this.player.view = roller.scene;
		this.postInit();
	}

	update(delta) {
		this.lights.d.position.copy(this.player.position);

		if (this.input.activeInput) {
			if (this.input.activeInput.name === "Keyboard") {
				this.player.moveByThrustRotate(this.input.axis);
			} else {
				this.player.moveByDirection(this.input.axis);
			}
		}

		// почему нет?
		this.poolMachine.rollersFlat[1].moveByDirection(new Vector2(0, -1));
		this.poolMachine.rollersFlat[2].moveByDirection(new Vector2(0, 1));
	}

	createRoller(color: number) {
		// проблемы с GLTF
		//const frame = this.rollerViewPref.clone();

		const frame = new Mesh(new BoxBufferGeometry(0.1, 0.1, 0.1), new MeshPhongMaterial({ color }));

		frame.geometry.translate(0, 0.05, 0);

		return new Roller2(this, frame);
	}
}
