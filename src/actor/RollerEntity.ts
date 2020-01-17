import { Entity, IComponent, IEntity } from "../components/ComponentSystem";
import { Object3D, Quaternion, Vector3, Vector2 } from "three";
import { DeltaAngle, IFaceGear, FaceResultEntry, IFaceDataRequest } from "../math/Utils";

export class ViewCmp implements IComponent {
	name: string = "view";
	view: Object3D;

	// view anglular interpolation speed.
	angularIntrpSpeed: number = Math.PI * 2;

	constructor(public target: IEntity) {}

	update?(delta: number): void {
		const move = this.target.get<MoveCmp>(MoveCmp);

		if (!move || !this.view) {
			return;
		}

		this.view.position.copy(move.position);
		this.view.quaternion.slerp(move.quaternion, this.angularIntrpSpeed * delta * 0.001);
	}
}

const ANGLE_EPS = 0.0001;
const TOP = new Vector3(0, 1, 0);

const TMP_Q = new Quaternion();
const TMP_V = new Vector3();

export class MoveCmp implements IComponent {
	name: string = "move";

	yOffset: number = 0.01;
	linearSpeed: number = 0.01;

	quaternion: Quaternion = new Quaternion();
	position: Vector3 = new Vector3();

	lastNormal: Vector3 = new Vector3(0, 1, 0);
	targetPos: Vector3 = new Vector3();

	lastYAngle: number = 0;
	targetYAngle: number = 0;

	constructor(public target: IEntity) {}

	update?(delta: number): void {}

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
		//this.applyView();

		//this.sendLineRequest();
		// update direction
	}
}

export class SurfCalcCmp implements IComponent, IFaceGear {
	name: "surfCalc";

	private _move: MoveCmp;

	faceRequest?: IFaceDataRequest = { point: undefined, skip: true };

	constructor(public target: IEntity) {}

	onInit() {
		this._move = this.target.get<MoveCmp>(MoveCmp);
	}

	sendFaceRequest(point: Vector3) {
		this.faceRequest.point.copy(point);
		this.faceRequest.skip = false;
	}
	/*
	sendLineRequest() {
		this.segmentRequest.skip = false;
		this.segmentRequest.dir.applyQuaternion(this.quaternion);
		this.segmentRequest.origin = this.position;
  }*/

	// IFaceGear
	onFaceRequestDone(data: FaceResultEntry): void {
		this._move.align(data.face.normal, data.point);
		this.faceRequest.skip = true;
	}
	/*
	onLineRequestDone(data: ISegmentGearDataRequest) {
		this.segmentRequest.skip = false;
  }*/

	update?(delta: number): void {}
}

export class UserInputCmp {
	name: "userInput";

	private _view: ViewCmp;
	private _move: MoveCmp;
	private _surf: SurfCalcCmp;
	private _lastDir: Vector2 = new Vector2(0, -1);

	constructor(public target: IEntity) {}

	onInit() {
		this._view = this.target.get<ViewCmp>(ViewCmp);
		this._move = this.target.get<MoveCmp>(MoveCmp);
		this._surf = this.target.get<SurfCalcCmp>(SurfCalcCmp);
	}

	update?(delta: number): void {}

	moveByThrustRotate(delta: Vector2) {
		if (delta.length() < 0.01) {
			return;
		}

		this._move.targetYAngle += this._view.angularIntrpSpeed * -delta.x * 0.01; // * +(Math.abs(delta.z) > 0);

		const aligned = TMP_V.set(0, 0, delta.y * this._move.linearSpeed)
			.applyQuaternion(this._move.quaternion)
			.add(this._move.position);

		this._surf.sendFaceRequest(aligned);
	}

	moveByDirection(dir: Vector2) {
		if (dir.length() < 0.5) {
			return;
		}

		const dist = dir.distanceTo(this._lastDir);

		if (dist > 0.0001) {
			const angle = Math.acos(dir.dot(this._lastDir));
			const sign = Math.sign(dir.cross(this._lastDir));

			this._move.targetYAngle += angle * sign;
			this._lastDir.copy(dir);
		}

		const aligned = TMP_V.set(0, 0, -this._move.linearSpeed)
			.applyQuaternion(this._move.quaternion)
			.add(this._move.position);

		this._surf.sendFaceRequest(aligned);
	}
}

export class RollerEntity extends Entity {
	constructor(view: Object3D) {
		super(ViewCmp, MoveCmp, SurfCalcCmp, UserInputCmp);

		const vcmp = this.get<ViewCmp>(ViewCmp);
		vcmp.view = view;
	}
}
