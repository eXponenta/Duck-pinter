import {
  Object3D,
  Mesh,
  Raycaster,
  Quaternion,
  Vector2,
  Vector3,
  Face3,
  Triangle,
  BufferGeometry
} from "three";
import { App } from "./app";

const TMP_v = new Vector3();
const TMP_v2 = new Vector2();
const TMP_i = [];
const VEC3_D = new Vector3(0, -1, 0);
const VEC3_T = new Vector3(0, 1, 0);
const VEC3_L = new Vector3(-1, 0, 0);
const VEC3_F = new Vector3(0, 0, 1);
const TMP_Q = new Quaternion();

function InterpolateNormal(v: Vector3[], n: Vector3[], point: Vector3, target) {
  Triangle.getBarycoord(point, v[0], v[1], v[2], TMP_v);

  target.set(0, 0, 0);
  target.addScaledVector(n[0], TMP_v.x);
  target.addScaledVector(n[1], TMP_v.y);
  target.addScaledVector(n[2], TMP_v.z);

  return target;
}

function FetchGeometryData(geom: BufferGeometry, face: Face3) {
  const p = geom.attributes["position"];
  const n = geom.attributes["normal"];

  const ps = [];
  const ns = [];
  const idx = [face.a, face.b, face.c];

  idx.forEach(idx => {
    ps.push(new Vector3(p.getX(idx), p.getY(idx), p.getZ(idx)));
    ns.push(new Vector3(n.getX(idx), n.getY(idx), n.getZ(idx)));
  });

  return {
    normals: ns,
    vertex: ps
  };
}

export class Roller extends Object3D {
  app: App;
  raycaster: Raycaster = new Raycaster();
  offset = -0.01;
  castOffset = 10;
  yAngle = Math.PI;
  dir = new Vector3(0, 0, 1);
  target?: Mesh = undefined;
  speed = 1;

  onSolved: (props: any) => void | undefined;
  _view?: Mesh;
  _top = new Vector3(0, 1, 0);
  _aQuat = new Quaternion();
  _lastNormal?: Vector3 = undefined;
  _lastTargetNormal: Vector3 = new Vector3(0, 0, 0);
  _lastPoint: Vector3 = new Vector3();

  constructor(app: App, view: Mesh | undefined, color: number = 0xff0000) {
    super();

    this.app = app;
    this.view = view;
  }

  set view(v: Mesh) {
    if (this._view) {
      this.remove(this._view);
    }

    this._view = v;

    if (v) {
      this.add(v);
      v.matrix.identity();
      v.rotateY(Math.PI);
    }
  }

  get view() {
    return this._view;
  }

  bind(model: Mesh) {
    //model.add(this);
    this.target = model;

    const { normal, point } = this.solvePoint();
    this.align(normal, point, true);

    this.dir.applyQuaternion(this.quaternion);
  }

  get alignQuat() {
    //rd.applyQuaternion(this._aQuat);
    return this._aQuat;
  }

  get left() {
    return VEC3_L.clone().applyQuaternion(this.quaternion);
  }

  get top() {
    this._top.set(0, 1, 0);
    return this._top.applyQuaternion(this.quaternion);
  }

  align(normal, point, force = false) {
    this.quaternion.copy(this.alignQuat);
    this.rotateY(this.yAngle);
    //this._lastTargetNormal.copy(normal);

    this.position.set(
      -normal.x * this.offset + point.x,
      -normal.y * this.offset + point.y,
      -normal.z * this.offset + point.z
    );
  }

  solvePoint(from = undefined) {
    const r = this.raycaster;

    if (!from) {
      from = this.position;
    }

    if (!this._lastNormal) {
      this._lastNormal = this.target.position
        .clone()
        .sub(from)
        .normalize();
    }
    r.set(from, this._lastNormal);

    TMP_i.length = 0;
    const itr = this.raycaster.intersectObject(this.target, true, TMP_i);

    if (itr.length === 0) return undefined;

    itr.sort((a, b) => a.distance - b.distance);

    const { face, point, uv } = itr[0];
    const normal = face.normal
      .clone()
      .transformDirection(this.target.matrixWorld)
      //flip inner
      .multiplyScalar(-1);

    const gd = FetchGeometryData(this.target!.geometry, face);

    const interpolatedNormal = new Vector3();
    InterpolateNormal(gd.vertex, gd.normals, point, interpolatedNormal);

    //normal.multiplyScalar(-1);
    this._lastNormal = normal;
    const data = {
      point,
      uv,
      normal,
      interpolatedNormal,
      data: gd
    };

    this.onSolved && this.onSolved(data);

    this._aQuat.setFromUnitVectors(VEC3_D, this._lastNormal);

    return data;
  }

  move(delta: Vector3) {
    if (!this._lastNormal || !this.target) return;
    if (delta.length() < 0.01) return;

    this.yAngle += delta.x * Math.PI * 2;

    this.rotateY(delta.x * Math.PI * 2);

    const aligned = TMP_v.set(0, 0, delta.z * this.speed).applyQuaternion(
      this.quaternion
    );
    const p = this.position;
    const n = this._lastNormal;

    aligned.x += p.x - n.x * this.castOffset;
    aligned.y += p.y - n.y * this.castOffset;
    aligned.z += p.z - n.z * this.castOffset;

    const { normal, point, interpolatedNormal } = this.solvePoint(aligned);

    this.dir
      .copy(point)
      .sub(this._lastPoint)
      .normalize();

    this._lastPoint.copy(point);
    this.align(normal, point);
  }
  /*
  update(delta: number) {
    if (!this._lastNormal || !this._lastTargetNormal) return;

    const target = this.alignQuat;
    TMP_Q.setFromAxisAngle(VEC3_D, -this.yAngle);
    TMP_Q.premultiply(target);

    this.quaternion.slerp(TMP_Q, 0.001 * Math.PI * delta);
  }*/
}
