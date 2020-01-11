import {
  Object3D,
  Mesh,
  Quaternion,
  Vector3,
  Geometry,
  BufferGeometry
} from "three";

import { App } from "./app";
import { ClosestTriangle, DeltaAngle } from "./Utils";

const ANGLE_EPS = 0.0001;
const TOP = new Vector3(0, 1, 0);

const TMP_Q = new Quaternion();
const TMP_V = new Vector3();

export class Roller2 {
  yOffset: number = 0.01;
  linearSpeed: number = 1;
  angularSpeed: number = Math.PI * 2;

  quaternion: Quaternion = new Quaternion();
  lastNormal: Vector3 = new Vector3(0, 1, 0);

  lastYAngle: number = 0;
  targetYAngle: number = 0;

  position: Vector3 = new Vector3(0, 0, 0);
  targetPos: Vector3 = new Vector3(0, 0, 0);

  target: Mesh;
  geom: Geometry;

  onSolved: (props: any) => void | undefined;

  constructor(private app: App, private view: Object3D = undefined) {}

  bind(target: Mesh, from: Vector3) {
    this.target = target;

    if (this.target.geometry.isGeometry) {
      this.geom = this.target.geometry as Geometry;
    } else {
      this.geom = new Geometry();
      this.geom.fromBufferGeometry(this.target.geometry as BufferGeometry);
    }

    const f = this.solvePoint(from);

    this.align(f.face.normal, f.point);
  }

  solvePoint(from: Vector3) {
    const face = ClosestTriangle(this.geom, from, Infinity, false);

    if (!face) {
      return undefined;
    }

    face.face.normal.transformDirection(this.target.matrixWorld);

    this.onSolved && this.onSolved(face);
    return face;
  }

  align(normal: Vector3, pos: Vector3) {
    const r = this.lastNormal.dot(normal) + 1;

    if (Math.abs(r) > ANGLE_EPS) {
      TMP_Q.setFromUnitVectors(this.lastNormal, normal);

      this.quaternion.premultiply(TMP_Q);
      this.lastNormal.copy(normal);
    }

    const da = DeltaAngle(this.lastYAngle, this.targetYAngle);

    if (Math.abs(da) > ANGLE_EPS) {
      this.quaternion.multiply(TMP_Q.setFromAxisAngle(TOP, da));

      this.lastYAngle = this.targetYAngle;
    }

    this.position.copy(pos);
    this.applyView();
  }

  applyView() {
    //this.view.quaternion.copy(this.quat);
    this.view.position.copy(this.position);
  }

  move(delta: Vector3) {
    if (!this.lastNormal || !this.target) return;
    if (delta.length() < 0.01) return;

    this.targetYAngle += this.angularSpeed * Math.sign(delta.x) * 0.01; // * +(Math.abs(delta.z) > 0);

    const aligned = TMP_V.set(0, 0, -delta.z * this.linearSpeed);
    aligned.applyQuaternion(this.quaternion);
    aligned.add(this.position);

    const f = this.solvePoint(aligned);

    this.align(f.face.normal, f.point);
  }

  update(delta: number) {
    this.view.quaternion.slerp(
      this.quaternion,
      this.angularSpeed * delta * 0.001
    );
  }
}
