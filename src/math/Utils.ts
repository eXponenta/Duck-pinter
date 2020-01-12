import { Geometry, Vector3, Triangle, Vector2, Face3 } from "three";

export interface IFaceDataEntry {
	face: Face3;
	point: Vector3;
	normal: Vector3;
	uv?: Vector2;
	distance: number;
	faceIndex: number;
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

export function ClosestTriangle(geometry: Geometry, point: Vector3, uvs = false, maxDistance: number = Infinity) {
	const vtx = geometry.vertices;
	const fs = geometry.faces;
	const t = new Triangle();
	const closes = new Vector3();

	let found = false;
	let result: IFaceDataEntry = {
		point: new Vector3(),
		face: new Face3(0, 0, 0),
		distance: Infinity,
		faceIndex: 0,
		uv: undefined,
		normal: undefined
	};

	for (let index = 0; index < fs.length; index++) {
		const f = fs[index];

		t.set(vtx[f.a], vtx[f.b], vtx[f.c]);
		t.closestPointToPoint(point, closes);

		const dist = point.distanceTo(closes);

		if (maxDistance < dist) {
			continue;
		}

		if (dist < result.distance) {
			result.distance = dist;
			result.face = f as Face3;
			result.faceIndex = index;
			result.point.copy(closes);

			found = true;
		}
	}

	if (uvs && found) {
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
	}

	if (found) result.normal = result.face.normal;

	return found ? result : null;
}
