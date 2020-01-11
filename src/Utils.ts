import { Geometry, Vector3, Triangle, Vector2, Face3 } from "three";

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

export function ClosestTriangle(
  geometry: Geometry,
  point: Vector3,
  maxDistance: number = Infinity,
  cull: boolean = true
) {
  const vtx = geometry.vertices;
  const fs = geometry.faces;
  const t = new Triangle();
  const closes = new Vector3();

  let found = false;
  let result = {
    point: new Vector3(),
    uv: new Vector2(),
    face: new Face3(0, 0, 0),
    distance: Infinity,
    faceIndex: 0
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

  if (found) {
    const f = result.face;
    const uvs = geometry.faceVertexUvs[0];
    const fuv = uvs[result.faceIndex];

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

    return result;
  }

  return null;
}