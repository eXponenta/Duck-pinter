import { Object3D, Vector3 } from "three";

//const TOP = new Vector3(0,1,0);
const TMP_V = new Vector3(0, 1, 0);

export class CameraMachine {
	targetDistance: number = 3;
	speed: number = 0.001;
	tangent: number = Math.PI / 12;
	target: Object3D;

	constructor(private _camera: Object3D) {}

	update(delta: number) {
		TMP_V.set(0, Math.cos(this.tangent), Math.sin(this.tangent))
			.applyQuaternion(this.target.quaternion)
			.multiplyScalar(this.targetDistance)
			.add(this.target.position);

		this._camera.position.lerp(TMP_V, delta * this.speed);
		this._camera.lookAt(this.target.position);
	}
}
