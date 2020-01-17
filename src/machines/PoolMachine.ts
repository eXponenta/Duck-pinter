import { Rope } from "../geom/Rope";
import { Scene, Mesh, Vector3, ArrowHelper, Geometry, BufferGeometry, MeshPhongMaterial, VertexColors } from "three";

import { Roller } from "./../actor/Roller";
import {
	FaceResultEntry,
	ClosestTriangle,
	ISegmentResultEntry,
	ClosestSegment,
	ILineSegm,
	IFaceGear
} from "./../math/Utils";

import { RTBlitter } from "./../math/RTBlitter";
import { App } from "../app";
import { RollerEntity, ViewCmp, SurfCalcCmp } from "../actor/RollerEntity";

export interface IRopePoolEntry {
	rope: Rope;
	used: boolean;
}

export interface IRollerEntry {
	roller: RollerEntity;
	ropes: IRopePoolEntry[];
	color: number;
	initial: Vector3;
}

export enum RENDER_MODE {
	MESH,
	BLIT
}

const DEF_ROPE_WIDTH = 0.1;

export class PoolMachine {
	private ropePool: IRopePoolEntry[] = [];
	private activeRopesFlat: Rope[] = [];
	private ropeMat: MeshPhongMaterial = new MeshPhongMaterial({ vertexColors: VertexColors, depthWrite: true });
	private surface: Mesh;
	private geom: Geometry;
	private checkResults: FaceResultEntry[] = [];
	private rt: RTBlitter;
	private intersections: Set<ILineSegm> = new Set();

	public rollers: Map<RollerEntity, IRollerEntry> = new Map();
	public rollersFlat: RollerEntity[] = [];

	constructor(
		private scene: Scene,
		private ropePoolSize = 10,
		ropeSize = 300,
		private renderMode = RENDER_MODE.MESH
	) {
		if (renderMode === RENDER_MODE.MESH) {
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
		} else {
			this.rt = new RTBlitter(App.instance.renderer, 2048);
		}
	}

	init(mesh: Mesh) {
		this.surface = mesh;

		if (this.surface.geometry.isGeometry) {
			this.geom = this.surface.geometry as Geometry;
		} else {
			this.geom = new Geometry();
			this.geom.fromBufferGeometry(this.surface.geometry as BufferGeometry);
		}

		if (this.renderMode === RENDER_MODE.BLIT) {
			this.surface.material.map = this.rt.texture;
		} else {
			this.scene.add(...this.ropePool.map(e => e.rope));
		}

		this.reset();
	}

	registerRoller(roller: RollerEntity, color: number, initial?: Vector3) {
		if (!this.surface) throw new Error("U must init before roolers registering");

		let registry;

		if (this.renderMode === RENDER_MODE.MESH) {
			registry = this._getFreeRope();

			registry.used = true;
			registry.rope.color = color;
			registry.rope.onIntersectionFound = this._onIntersection.bind(this);

			this.activeRopesFlat.push(registry.rope);
		}

		this.rollers.set(roller, {
			roller,
			ropes: [registry],
			color,
			initial: initial || new Vector3(0, 0, 5)
		});

		this.rollersFlat.push(roller);
		this.checkResults.push(new FaceResultEntry());

		this.scene.add(roller.get<ViewCmp>(ViewCmp).view);
	}

	spawn() {
		this.rollers.forEach(e => {
			e.roller.get<SurfCalcCmp>(SurfCalcCmp).faceRequest.point = e.initial;
			e.roller.get<SurfCalcCmp>(SurfCalcCmp).faceRequest.skip = false;
		});

		this._calcClosestPoints();
	}

	update(delta: number) {
		// search closes points avery frame
		this._calcClosestPoints();
		//this._calcClosestLine();
	}

	reset() {
		this.ropePool.forEach(e => {
			e.used = false;
			e.rope.clean();
		});
		this.activeRopesFlat.length = 0;

		this.rollers.forEach(e => this.scene.remove(e.roller.get<ViewCmp>(ViewCmp).view));
		this.rollers.clear();
	}

	_calcClosestPoints() {
		const from: IFaceGear[] = this.rollersFlat.map(e => e.get<SurfCalcCmp>(SurfCalcCmp));

		if (from.length === 0) {
			return;
		}

		const results = ClosestTriangle({
			from,
			geometry: this.geom,
			maxDistance: Infinity,
			uvs: this.renderMode === RENDER_MODE.BLIT,
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

			this._updateRopeData(this.rollersFlat[i], r);

			// important!!
			r.reset();
		}

		if (this.renderMode === RENDER_MODE.BLIT) {
			//this.rt.commit();
		}
	}

	// doesnt works correct yet
	_calcClosestLine() {
		const results: ISegmentResultEntry[] = [];
		const gears = this.rollersFlat;

		ClosestSegment({
			from: gears,
			lines: this.activeRopesFlat,
			skipLastSegment: true,
			results
		});

		for (let r of results) {
			this._onIntersection(r);
		}
	}

	_onIntersection(region: ISegmentResultEntry) {
		if (this.intersections.has(region.segment)) return;

		this.intersections.add(region.segment);

		const d = new ArrowHelper(region.point.n, region.point.p, 0.5, 0xff0000);
		this.scene.add(d);
	}

	_updateRopeData(from: RollerEntity, data: FaceResultEntry) {
		const rollerData = this.rollers.get(from);

		if (!rollerData) {
			throw Error("Rolles can't be registered!");
		}

		if (this.renderMode === RENDER_MODE.BLIT) {
			return this._blit2RT(from, data);
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
			this.activeRopesFlat.push(nextRope.rope);
		}
	}

	_blit2RT(from: RollerEntity, data: FaceResultEntry) {
		const color = this.rollers.get(from).color;

		this.rt.push({
			point: data.uv,
			color,
			size: 10.2
		});
	}

	_getFreeRope() {
		const free = this.ropePool.filter(e => !e.used)[0];

		if (!free) throw new Error("Rope pool empty!");

		return free;
	}
}
