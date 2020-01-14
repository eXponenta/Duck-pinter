import { Mesh, DirectionalLight, AmbientLight, Vector3, MeshLambertMaterial, FrontSide, Scene } from "three";

import { Roller2 } from "./actor/Roller2";
import { BaseApp } from "./BaseApp";
import { PoolMachine } from "./math/PoolMachine";
import { CameraMachine } from "./actor/CameraMachine";
import { UniversalInput } from "./math/Input";

const ROPE_POOL_SIZE = 10;
const ROPE_POOL_LEN = 300;

export class App extends BaseApp {
	lights = {
		d: new DirectionalLight(0xffffff, 1),
		a: new AmbientLight(0x808080, 0.5)
	};

	inputAxis: Vector3 = new Vector3();
	input: UniversalInput = new UniversalInput();
	model: Mesh;
	roller: Roller2;
	pool: PoolMachine;
	cameraMachine: CameraMachine;

	constructor(appEl: HTMLElement) {
		super(appEl);

		const { d, a } = this.lights;

		d.position.set(2, 2, 2);

		this.scene.add(a, d);

		this.roller = new Roller2(this);
		this.input.attach(this.renderer.domElement);
		this.input.enable = false;

		//this.controlls = new OrbitControls(this.camera, this.renderer.domElement);
		//this.controlls.target = this.roller.position;

		this.cameraMachine = new CameraMachine(this.camera);
		this.pool = new PoolMachine(this.scene, ROPE_POOL_SIZE, ROPE_POOL_LEN);
	}

	init() {}

	postInit() {
		//this.scene.add(this.roller.view);
		this.pool.init(this.model);
		this.pool.registerRoller(this.roller, 0x00ff00);
		this.cameraMachine.target = this.roller.view;

		this.runs.update.add(this.input);
		this.runs.update.add(this.roller);
		this.runs.update.add(this.cameraMachine);

		this.input.enable = true;

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

		const t = this.input.axis.clone().multiplyScalar(-0.01);
		this.roller.move(t);
	}
}
