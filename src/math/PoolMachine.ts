import { Rope, IIntersectionRegion } from "../geom/Rope";
import { Scene, Mesh, Vector3, ArrowHelper, Geometry, BufferGeometry, MeshPhongMaterial, VertexColors } from "three";
import { Roller2 } from "../actor/Roller2";
import { FaceDataEntry, ClosestTriangle } from "./Utils";

export interface IRopePoolEntry {
	rope: Rope;
	used: boolean;
}

export interface IRollerEntry {
	roller: Roller2;
	ropes: IRopePoolEntry[];
	color: number;
	initial: Vector3;
}

const DEF_ROPE_WIDTH = 0.1;

export class PoolMachine {
	private ropePool: IRopePoolEntry[] = [];
	private ropeMat: MeshPhongMaterial = new MeshPhongMaterial({ vertexColors: VertexColors });
	private surface: Mesh;
	private geom: Geometry;
	private checkResults: FaceDataEntry[] = [];

	public rollers: Map<Roller2, IRollerEntry> = new Map();
	public rollersFlat: Roller2[] = [];

	constructor(private scene: Scene, private ropePoolSize = 10, ropeSize = 300) {
		this.ropePool = Array.from({ length: ropePoolSize }, () => {
			const rope = new Rope(ropeSize, DEF_ROPE_WIDTH, 0xff0000, this.ropeMat);

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

		if (this.surface.geometry.isGeometry) {
			this.geom = this.surface.geometry as Geometry;
		} else {
			this.geom = new Geometry();
			this.geom.fromBufferGeometry(this.surface.geometry as BufferGeometry);
		}

		this.reset();
	}

	registerRoller(roller: Roller2, color: number, initial?: Vector3) {
		if (!this.surface) throw new Error("U must init before roolers registering");

		const registry = this._getFreeRope();

		registry.used = true;
		registry.rope.color = color;
		registry.rope.onIntersectionFound = this._onIntersection.bind(this);

		this.rollers.set(roller, {
			roller,
			ropes: [registry],
			color,
			initial: initial || new Vector3(0, 0, 5)
		});

		this.rollersFlat.push(roller);
		this.checkResults.push(new FaceDataEntry());

		this.scene.add(roller.view);
	}

	spawn() {
		this.rollers.forEach(e => {
			e.roller.faceRequest.point = e.initial;
			e.roller.faceRequest.skip = false;
		});

		this._calcClosestPoints();
	}

	update(delta: number) {
		// search closes points avery frame
		this._calcClosestPoints();
	}

	reset() {
		this.ropePool.forEach(e => {
			e.used = false;
			e.rope.clean();
		});

		this.rollers.forEach(e => this.scene.remove(e.roller.view));
		this.rollers.clear();
	}

	_calcClosestPoints() {
		const from: Roller2[] = this.rollersFlat;

		if (from.length === 0) {
			return;
		}

		const results = ClosestTriangle({
			from,
			geometry: this.geom,
			maxDistance: Infinity,
			uvs: false,
			results: this.checkResults
		});

		for (let i = 0; i < from.length; i++) {
			const f = from[i];
			const r = results[i];

			if (!f.faceRequest || f.faceRequest.skip) {
				continue;
			}

			// TODO remove me
			r.normal.transformDirection(this.surface.matrixWorld);
			f.onFaceRequestDone && f.onFaceRequestDone(r);

			this._updateRopeData(f, r);

			// important!!
			r.reset();
		}
	}

	_onIntersection(region: IIntersectionRegion) {
		const d = new ArrowHelper(region.point.n, region.point.p, 0.5, 0xff0000);
		this.scene.add(d);
	}

	_updateRopeData(from: Roller2, data: FaceDataEntry) {
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
			nextRope.rope.onIntersectionFound = this._onIntersection.bind(this);

			rollerData.ropes.push(nextRope);
		}
	}

	_getFreeRope() {
		const free = this.ropePool.filter(e => !e.used)[0];

		if (!free) throw new Error("Rope pool empty!");

		return free;
	}
}
