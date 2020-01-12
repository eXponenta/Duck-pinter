import { Rope } from "../geom/Rope";
import { Scene, Mesh, Vector3 } from "three";
import { Roller2 } from "../actor/Roller2";

export interface IRopePoolEntry {
	rope: Rope;
	used: boolean;
}
export interface IRollerEntry {
	roller: Roller2;
	ropes: IRopePoolEntry[];
	color: number;
}

const DEF_ROPE_WIDTH = 0.1;

export class PoolMachine {
	private ropePool: IRopePoolEntry[] = [];
	private surface: Mesh;
	private rollers: Map<Roller2, IRollerEntry> = new Map();

	constructor(private scene: Scene, private ropePoolSize = 10, ropeSize = 300) {
		this.ropePool = Array.from({ length: ropePoolSize }, () => {
			const rope = new Rope(ropeSize, DEF_ROPE_WIDTH, 0xff0000);

			rope.minDistance = 0.05;
			rope.updateNormals = true;

			return {
				rope,
				used: false,
				full: false
			};
		});

		this.scene.add(...this.ropePool.map(e => e.rope));
	}

	init(mesh: Mesh) {
		this.surface = mesh;

		this.reset();
	}

	registerRoller(roller: Roller2, color: number) {
		if (!this.surface) throw new Error("U must init before roolers registering");

		const rope = this._getFreeRope();

		rope.used = true;
		rope.rope.color = color;

		this.rollers.set(roller, {
			roller,
			ropes: [rope],
			color
		});

		roller.bind(this.surface, new Vector3(0, 0, 5));
		roller.onSolved = (data: any) => this._updateRopeData(roller, data);

		this.scene.add(roller.view);
	}

	reset() {
		this.ropePool.forEach(e => {
			e.used = false;
			e.rope.clean();
		});

		this.rollers.forEach(e => this.scene.remove(e.roller.view));
		this.rollers.clear();
	}

	_updateRopeData(from: Roller2, data: { point: Vector3; normal: Vector3 }) {
		const rollerData = this.rollers.get(from);

		if (!rollerData) {
			throw Error("Rolles can't be registered!");
		}

		let curRope = rollerData.ropes[rollerData.ropes.length - 1];

		curRope.rope.pushPoint(data.point, data.normal, true);

		if (curRope.rope.closed) {
			const nextRope = this._getFreeRope();
			nextRope.used = true;
			nextRope.rope.color = rollerData.color;
			nextRope.rope.join(curRope.rope);
			rollerData.ropes.push(nextRope);
		}
	}

	_getFreeRope() {
		const free = this.ropePool.filter(e => !e.used)[0];

		if (!free) throw new Error("Rope pool empty!");

		return free;
	}
}
