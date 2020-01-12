import { Mesh, DirectionalLight, AmbientLight, Vector3, MeshLambertMaterial, FrontSide, Scene } from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Roller2 } from "./actor/Roller2";
import { BaseApp } from "./BaseApp";
import { PoolMachine } from "./math/PoolMachine";

export class App extends BaseApp {
	lights = {
		d: new DirectionalLight(0xffffff, 1),
		a: new AmbientLight(0x808080, 0.5)
	};

	inputAxis: Vector3 = new Vector3();
	model: Mesh;
	controlls: OrbitControls;
	roller: Roller2;
	pool: PoolMachine;

	constructor(appEl: HTMLElement) {
		super(appEl);

		const { d, a } = this.lights;

		d.position.set(2, 2, 2);

		this.scene.add(a, d);

		this.roller = new Roller2(this);
		this.controlls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controlls.target = this.roller.position;

		this.pool = new PoolMachine(this.scene, 10, 300);
	}

	init() {}

	postInit() {
		//this.scene.add(this.roller.view);
		this.pool.init(this.model);
		this.pool.registerRoller(this.roller, 0x00ff00);

		this.bindInput();

		this.runs.update.add(this.controlls);
		this.runs.update.add(this.roller);

		super.postInit();
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

		this.roller.view = roller.scene;

		this.postInit();
	}

	update(delta) {
		this.lights.d.position.copy(this.roller.position);

		const t = this.inputAxis.clone().multiplyScalar(0.01);
		this.roller.move(t);
	}

	bindInput() {
		this.inputAxis.set(0, 0, 0);
		window.addEventListener("keydown", this._keyDown.bind(this));
		window.addEventListener("keyup", this._keyUp.bind(this));
	}

	_keyUp(event) {
		const c = event.which;

		let x = c === 65 || c === 37;
		let z = c === 87 || c === 38;

		x += c === 68 || c === 39;
		z += c === 83 || c === 40;

		if (x !== 0) this.inputAxis.x = 0;
		if (z !== 0) this.inputAxis.z = 0;
	}

	_keyDown(event) {
		const c = event.which;

		let x = c === 65 || c === 37;
		let z = c === 87 || c === 38;

		x -= c === 68 || c === 39;
		z -= c === 83 || c === 40;

		this.inputAxis.x = Math.max(-1, Math.min(1, x + this.inputAxis.x));
		this.inputAxis.z = Math.max(-1, Math.min(1, z + this.inputAxis.z));
	}
}
