import { Geometry, Vector3, Triangle, Vector2, Face3, Plane, Line3 } from "three";
import { Rope } from "../geom/Rope";

export class LinePoint {
	constructor(public p: Vector3, public n: Vector3) {}

	clone() {
		return new LinePoint(this.p.clone(), this.n.clone());
	}
}

export interface ILineSegm {
	a: LinePoint;
	b: LinePoint;
	id: number;
	rope?: Rope;
}

export interface IFaceDataRequest {
	point: Vector3;
	skip: boolean;
}

export interface IFaceGear {
	faceRequest?: IFaceDataRequest;
	onFaceRequestDone(data: FaceResultEntry): void;
}

export interface ISegmentGearDataRequest {
	dir: Vector3;
	origin: Vector3;
	dist: number;
	skip: boolean;
}

export interface ISegmentGear {
	segmentRequest?: ISegmentGearDataRequest;
	onLineRequestDone?(data: ISegmentGearDataRequest);
}

export interface ISegmentResultEntry {
	segment: ILineSegm;
	rope: Rope;
	point: LinePoint;
}

export class FaceResultEntry {
	face: Face3;
	point: Vector3 = new Vector3();
	normal: Vector3 = new Vector3();
	uv: Vector2 = new Vector2();
	distance: number = Infinity;
	faceIndex: number = -1;

	reset() {
		this.face = undefined;
		this.point.set(0, 0, 0);
		this.normal.set(0, 0, 0);
		this.uv.set(0, 0);
		this.distance = Infinity;
		this.faceIndex = -1;
	}
}

export function DeltaAngle(from: number, to: number, grad = false) {
	let d = to - from;

	if (grad) {
		d /= Math.PI / 180;
	}

	while (d < -Math.PI) d += Math.PI;
	while (d > Math.PI) d -= Math.PI;

	if (grad) {
		d *= 180 / Math.PI;
	}

	return d;
}

export interface IClosestOptions {
	geometry: Geometry;
	from: IFaceGear[];
	uvs: boolean;
	maxDistance: number;
	results?: FaceResultEntry[];
}

export interface IClosesSegmentOptions {
	lines: Rope[];
	from: ISegmentGear[];
	results?: ISegmentResultEntry[];
	skipLastSegment: boolean;
}

export function ClosestTriangle(options: IClosestOptions) {
	const { geometry, from, uvs, maxDistance } = options;

	const vtx = geometry.vertices;
	const fs = geometry.faces;
	const t = new Triangle();

	let results: FaceResultEntry[] = options.results;

	if (results) {
		results = Array.from({ length: from.length }, e => new FaceResultEntry());
	}

	let closests = Array.from({ length: from.length }, () => new Vector3());

	//loop over all face
	for (let index = 0; index < fs.length; index++) {
		const f = fs[index];

		//loop over all obj
		for (let k = 0; k < from.length; k++) {
			const result = results[k];
			const entry = from[k];
			const closest = closests[k];

			if (!entry.faceRequest || entry.faceRequest.skip) {
				continue;
			}

			const { point } = entry.faceRequest;

			t.set(vtx[f.a], vtx[f.b], vtx[f.c]);
			t.closestPointToPoint(point, closest);

			const dist = point.distanceTo(closest);

			if (maxDistance < dist) {
				continue;
			}

			if (dist < result.distance) {
				result.distance = dist;
				result.face = f as Face3;
				result.faceIndex = index;
				result.normal.copy(result.face.normal);
				result.point.copy(closest);
			}
		}
	}

	if (uvs) {
		results.forEach(result => {
			const f = result.face;

			if (!f) {
				return;
			}

			const uvs = geometry.faceVertexUvs[0];
			const fuv = uvs[result.faceIndex];

			result.uv = new Vector2();

			Triangle.getUV(
				result.point,
				// VTX
				vtx[f.a],
				vtx[f.b],
				vtx[f.c],
				// UVS
				fuv[0],
				fuv[1],
				fuv[2],
				result.uv
			);
		});
	}

	return results;
}

export function ClosestSegment(options: IClosesSegmentOptions) {
	const { skipLastSegment, lines, from, results } = options;

	for (let r of lines) {
		const s = r.segments;
		const l = !r.closed && skipLastSegment ? s.length - 1 : s.length;

		for (let i = 0; i < l; i++) {
			computeIntr(from, s[i], results);
		}
	}

	return results;
}

const TMP_V1 = new Vector3();
const TMP_V2 = new Vector3();
const TMP_L = new Line3();
const TMP_P = new Plane();

function computeIntr(
	gears: ISegmentGear[],
	segm: ILineSegm,
	results: ISegmentResultEntry[] = []
): ISegmentResultEntry[] {
	const a = segm.a;
	const b = segm.b;
	const l = TMP_L;
	const p = TMP_P;

	// skip link
	const sqLen = a.p.distanceToSquared(b.p);

	TMP_V1.subVectors(b.p, a.p)
		.normalize()
		.cross(a.n);

	p.setFromNormalAndCoplanarPoint(TMP_V1, a.p);

	for (let i = 0; i < gears.length; i++) {
		const { dist, dir, origin } = gears[i].segmentRequest;

		l.start.copy(origin);
		l.end.copy(origin).addScaledVector(dir, dist);

		const test = p.intersectLine(l, TMP_V2);

		if (!test) {
			continue;
		}

		const da = test.distanceToSquared(a.p);
		const db = test.distanceToSquared(b.p);

		if (da > sqLen || db > sqLen) {
			continue;
		}

		TMP_V1.lerpVectors(a.n, b.n, da / sqLen);

		const seg: ISegmentResultEntry = {
			segment: segm,
			rope: segm.rope,
			point: new LinePoint(test.clone(), TMP_V1.clone())
		};

		results.push(seg);
	}

	return results;
}
