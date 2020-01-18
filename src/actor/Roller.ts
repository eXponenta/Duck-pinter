import { Object3D, Mesh, Quaternion, Vector3, Vector2, Geometry } from "three";

import { App } from "./../app";
import {
	DeltaAngle,
	FaceResultEntry,
	IFaceGear,
	IFaceDataRequest,
	ISegmentGear,
	ISegmentGearDataRequest
} from "../math/Utils";

const ANGLE_EPS = 0.0001;
const TOP = new Vector3(0, 1, 0);

const TMP_Q = new Quaternion();
const TMP_V = new Vector3();

/**
 * @deprecated
 * @description LEGACY CLASS. Look RollerEntity for new implementation
 */
export class Roller implements IFaceGear, ISegmentGear {
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

	// ISegmentGear
	segmentRequest?: ISegmentGearDataRequest = {
		dir: new Vector3(0, 0, 1),
		skip: true,
		origin: this.position,
		dist: 0.1
	};

	// IFaceGear
	faceRequest?: IFaceDataRequest = { point: undefined, skip: true };

	constructor(private app: App, public view: Object3D = undefined) {}

	bind(target: Mesh, from: Vector3) {
		this.target = target;
	}

	sendFaceRequest(point: Vector3) {
		this.faceRequest.point.copy(point);
		this.faceRequest.skip = false;
	}

	sendLineRequest() {
		this.segmentRequest.skip = false;
		this.segmentRequest.dir.applyQuaternion(this.quaternion);
		this.segmentRequest.origin = this.position;
	}

	// IFaceGear
	onFaceRequestDone(data: FaceResultEntry): void {
		this.align(data.face.normal, data.point);

		this.faceRequest.skip = true;
	}

	onLineRequestDone(data: ISegmentGearDataRequest) {
		this.segmentRequest.skip = false;
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

		this.sendLineRequest();
		// update direction
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

		this.sendFaceRequest(aligned);
	}

	moveByDirection(dir: Vector2) {
		if (dir.length() < 0.5) {
			return;
		}

		this.targetYAngle = Math.PI - Math.atan2(dir.x, -dir.y);

		const aligned = TMP_V.set(0, 0, -this.linearSpeed)
			.applyQuaternion(this.quaternion)
			.add(this.position);

		this.sendFaceRequest(aligned);
	}

	update(delta: number) {
		this.view.quaternion.slerp(this.quaternion, this.angularSpeed * delta * 0.001);
	}
}
