import { Rope } from "../geom/Rope";
import {
	Scene,
	Mesh,
	Vector3,
	ArrowHelper,
	Geometry,
	BufferGeometry,
	MeshPhongMaterial,
	VertexColors,
	Raycaster
} from "three";

import {
	FaceResultEntry,
	ClosestTriangle,
	ClosestSegment,
	ISegmentResultEntry,
	ILineSegm,
	IFaceGear,
	ISegmentGear,
	ISegmentGearDataRequest
} from "./../math/Utils";

import { RTBlitter } from "./../math/RTBlitter";
import { App } from "../App";
import { RollerEntity, ViewCmp, SurfCalcCmp, MoveCmp, RopeDataCmp, IntersecCmp } from "../actor/RollerEntity";
import { Component } from "../components/ComponentSystem";
import { FaceOctree } from "../math/Octree";

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

export class WorldMachine {
	private ropePool: IRopePoolEntry[] = [];
	private activeRopesFlat: Rope[] = [];
	private ropeMat: MeshPhongMaterial = new MeshPhongMaterial({ vertexColors: VertexColors, depthWrite: true });
	private surface: Mesh;
	private geom: Geometry;
	private checkResults: FaceResultEntry[] = [];
	private rt: RTBlitter;
	private intersections: Set<ILineSegm> = new Set();
	private octree: FaceOctree;
	private raycaster: Raycaster = new Raycaster();

	private solverWorkTime = 0;

	public rollersFlat: RollerEntity[] = [];
	public renderSpikes: boolean = false;
	public renderOcts: boolean = false;
	public octreeSolv: boolean = false;

	constructor(
		private scene: Scene,
		private ropePoolSize = 10,
		ropeSize = 300,
		private renderMode = RENDER_MODE.MESH
	) {
		this.ropePool = Array.from({ length: ropePoolSize }, () => {
			const rope = new Rope(ropeSize, DEF_ROPE_WIDTH, 0xff0000, this.ropeMat);

			rope.minDistance = 0.05;
			return {
				rope,
				used: false
			};
		});
	}

	async init(mesh: Mesh) {
		this.surface = mesh;

		const start = performance.now();

		this.octree = FaceOctree.fromMesh(mesh);

		const end = performance.now();

		console.log(this.octree, "Build time", end - start);

		if (this.renderOcts && this.octreeSolv) {
			const nodes = this.octree.genNodeLevel(4);
			this.scene.add(nodes);
		}

		this.geom = this.octree.geom;

		if (this.renderMode === RENDER_MODE.BLIT) {
			this.rt = new RTBlitter(App.instance.renderer, 2048, 100);
		}

		if (this.renderMode === RENDER_MODE.BLIT) {
			this.surface.material.map = this.rt.texture;
		} else {
			this.scene.add(...this.ropePool.map(e => e.rope));
		}

		setInterval(() => {
			console.log("AVG Solver % (on 1 sec):", (0.1 * this.solverWorkTime).toFixed(2));
			console.log("AVG Solver method:" + (this.octreeSolv ? "Octree" : "Naive"));

			this.solverWorkTime = 0;
		}, 1000);

		this.reset();
		return new Promise(res => {
			setTimeout(res, 500);
		});
	}

	registerRoller(roller: RollerEntity, color: number, initial?: Vector3) {
		if (!this.surface) throw new Error("U must init before roolers registering");

		const registry = this._getFreeRope();
		const ropeDataCmp = roller.get<RopeDataCmp>(RopeDataCmp);
		const surfCmp = roller.get<SurfCalcCmp>(SurfCalcCmp);

		registry.used = true;
		registry.rope.color = color;

		ropeDataCmp.ropes = [registry.rope];
		ropeDataCmp.color = color;

		// set initial point for search
		surfCmp.faceRequest.point = initial;

		this.activeRopesFlat.push(registry.rope);
		this.rollersFlat.push(roller);
		this.checkResults.push(new FaceResultEntry());

		// add view from roller to scene
		this.scene.add(roller.get<ViewCmp>(ViewCmp).view);
	}

	spawn() {
		this.rollersFlat.forEach(e => {
			// setted on registerRoller
			// e.roller.get<SurfCalcCmp>(SurfCalcCmp).faceRequest.point = e.initial;
			e.get<SurfCalcCmp>(SurfCalcCmp).faceRequest.skip = false;
		});

		if (!this.octreeSolv) {
			this._calcClosestPoints();
		} else {
			this._calcClosestPointsFast(true);
		}
	}

	update(delta: number) {
		this.rollersFlat.forEach(r => {
			r.update(delta);
		});

		const start = performance.now();
		// search closes points avery frame
		if (!this.octreeSolv) {
			this._calcClosestPoints();
		} else {
			this._calcClosestPointsFast(false);
		}

		this.solverWorkTime += performance.now() - start;

		if (this.renderSpikes) {
			this._calcClosestSegment();
		}
	}

	reset() {
		this.ropePool.forEach(e => {
			e.used = false;
			e.rope.clean();
		});
		this.activeRopesFlat.length = 0;

		this.rollersFlat.forEach(e => this.scene.remove(e.get<ViewCmp>(ViewCmp).view));
		this.rollersFlat.length = 0;
	}

	_calcClosestPointsFast(useRay = false) {
		const from: IFaceGear[] = this.rollersFlat.map(e => e.get<SurfCalcCmp>(SurfCalcCmp));

		if (from.length === 0) {
			return;
		}

		for (let i = 0; i < from.length; i++) {
			const g = from[i];

			if (!g.faceRequest || g.faceRequest.skip) {
				continue;
			}

			const res = this._calcClosestPointPart(g, useRay);

			g.onFaceRequestDone && g.onFaceRequestDone(res as any);

			this._updateRopeData(this.rollersFlat[i], res as any);
		}
	}

	_calcClosestPointPart(gear: IFaceGear, raycast = false) {
		if (raycast) {
			const rr = this.raycaster;

			rr.ray.origin.copy(gear.faceRequest.point);
			rr.ray.direction
				.copy(this.surface.position)
				.sub(gear.faceRequest.point)
				.normalize();

			const nearest = rr.intersectObject(this.octree as any, false);

			return nearest[0];
		} else {
			return this.octree.closestPoint(gear.faceRequest.point);
		}
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
			this.rt.commit();
		}
	}

	_calcClosestSegment() {
		const from = this.rollersFlat.map(e => e.get<IntersecCmp>(IntersecCmp));
		const lines = this.activeRopesFlat;

		const results: ISegmentResultEntry[] = [];

		ClosestSegment({
			from,
			lines,
			results,
			skipLastSegment: true
		});

		results.forEach((e, i) => {
			this._onIntersection(e);
		});
	}

	_onIntersection(region: ISegmentResultEntry) {
		if (this.intersections.has(region.segment)) return;

		this.intersections.add(region.segment);

		const d = new ArrowHelper(region.point.n, region.point.p, 0.25, region.rope.color);
		this.scene.add(d);
	}

	_updateRopeData(from: RollerEntity, data: FaceResultEntry) {
		if (this.renderMode === RENDER_MODE.BLIT) {
			this._blit2RT(from, data);
		}

		const ropeDataCmp = from.get<RopeDataCmp>(RopeDataCmp);

		if (!ropeDataCmp) {
			throw new Error("Invalid roller instance!");
		}

		let curRope = ropeDataCmp.ropes[ropeDataCmp.ropes.length - 1];

		curRope.pushPoint(data.point, data.normal, true);

		if (curRope.closed) {
			const nextRope = this._getFreeRope();

			nextRope.used = true;
			nextRope.rope.color = ropeDataCmp.color;
			nextRope.rope.join(curRope);

			ropeDataCmp.ropes.push(nextRope.rope);
			this.activeRopesFlat.push(nextRope.rope);
		}
	}

	_blit2RT(from: RollerEntity, data: FaceResultEntry) {
		const ropeDataCmp = from.get<RopeDataCmp>(RopeDataCmp);

		if (!ropeDataCmp) {
			throw new Error("Invalid roller instance!");
		}

		this.rt.push({
			point: data.uv,
			color: ropeDataCmp.color,
			size: 10.2
		});
	}

	_getFreeRope() {
		const free = this.ropePool.filter(e => !e.used)[0];

		if (!free) throw new Error("Rope pool empty!");

		return free;
	}
}
