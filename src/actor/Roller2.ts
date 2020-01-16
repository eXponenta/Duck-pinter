import { Object3D, Mesh, Quaternion, Vector3, Vector2, Geometry } from "three";

import { App } from "./../app";
import { DeltaAngle, FaceDataEntry } from "../math/Utils";

const ANGLE_EPS = 0.0001;
const TOP = new Vector3(0, 1, 0);

const TMP_Q = new Quaternion();
const TMP_V = new Vector3();

export interface IFaceDataRequest {
	point: Vector3;
	skip: boolean;
}

export interface IFaceGear {
	faceRequest?: IFaceDataRequest;
	onFaceRequestDone(data: FaceDataEntry): void;
}

export class Roller2 implements IFaceGear {
	yOffset: number = 0.01;
	linearSpeed: number = 0.01;
	angularSpeed: number = Math.PI * 2;

	quaternion: Quaternion = new Quaternion();
	lastNormal: Vector3 = new Vector3(0, 1, 0);

	lastYAngle: number = 0;
	targetYAngle: number = 0;
	lastDir: Vector2 = new Vector2(0, -1);

	position: Vector3 = new Vector3(0, 0, 0);
	targetPos: Vector3 = new Vector3(0, 0, 0);

	target: Mesh;
	geom: Geometry;

	// IFaceGear
	faceRequest?: IFaceDataRequest = { point: undefined, skip: true };

	constructor(private app: App, public view: Object3D = undefined) {}

	bind(target: Mesh, from: Vector3) {
		this.target = target;
	}

	sendRequest(point: Vector3) {
		this.faceRequest.point.copy(point);
		this.faceRequest.skip = false;
	}
	// IFaceGear
	onFaceRequestDone(data: FaceDataEntry): void {
		this.align(data.face.normal, data.point);

		this.faceRequest.skip = true;
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

	moveByThrustRotate(delta: Vector2) {
		if (delta.length() < 0.01) {
			return;
		}

		this.targetYAngle += this.angularSpeed * -delta.x * 0.01; // * +(Math.abs(delta.z) > 0);

		const aligned = TMP_V.set(0, 0, delta.y * this.linearSpeed)
			.applyQuaternion(this.quaternion)
			.add(this.position);

		this.sendRequest(aligned);
	}

	moveByDirection(dir: Vector2) {
		if (dir.length() < 0.5) {
			return;
		}

		this.targetYAngle = Math.PI - Math.atan2(dir.x, -dir.y);

		const aligned = TMP_V.set(0, 0, -this.linearSpeed)
			.applyQuaternion(this.quaternion)
			.add(this.position);

		this.sendRequest(aligned);
	}

	update(delta: number) {
		this.view.quaternion.slerp(this.quaternion, this.angularSpeed * delta * 0.001);
	}
}
