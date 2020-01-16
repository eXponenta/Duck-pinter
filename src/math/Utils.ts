import { Geometry, Vector3, Triangle, Vector2, Face3, Object3D } from "three";
import { IFaceGear } from "../actor/Roller2";

export class FaceDataEntry {
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
	results?: FaceDataEntry[];
}

export function ClosestTriangle(options: IClosestOptions) {
	const { geometry, from, uvs, maxDistance } = options;

	const vtx = geometry.vertices;
	const fs = geometry.faces;
	const t = new Triangle();

	let results: FaceDataEntry[] = options.results;

	if (results) {
		results = Array.from({ length: from.length }, e => new FaceDataEntry());
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
