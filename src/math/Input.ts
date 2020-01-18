import { Vector2 } from "three";

export abstract class AxesInput {
	protected _name: string = "Abstract";
	protected _binded: boolean = false;
	protected _axis: Vector2 = new Vector2();

	public onInputCalled: (from: AxesInput) => void;
	public lerpTime: number = 0.1;
	public dom: HTMLElement;

	public abstract attach(dom: HTMLElement);
	public abstract update(delta: number);
	public abstract dispose();

	protected abstract _bindInput();
	protected abstract _unbindInput();

	protected _callCallback() {
		this.onInputCalled && this.onInputCalled(this);
	}

	get name() {
		return this._name;
	}

	get enable() {
		return this._binded;
	}

	set enable(v) {
		if (v === this._binded) return;

		if (!v) {
			this._unbindInput();
		} else {
			this._bindInput();
		}
	}

	get axis() {
		return this._axis;
	}

	static get supported(): boolean {
		throw new Error("Not supported on BaseClass");
	}
}

const TMP_V = new Vector2();

export class TouchInput extends AxesInput {
	_name = "Touch";
	_lastTouchId: number = -1;
	_startPoint: Vector2 = new Vector2();
	_touchStartBind: any;
	_touchMoveBind: any;
	_touchEndBind: any;

	// in pixels
	public minDistance: number = 30;

	public attach(dom: HTMLElement) {
		this.dom = dom;
		this._bindInput();
	}

	public update(delta: number) {}

	public dispose() {
		this._unbindInput();
	}

	static get supported() {
		return "ontouchstart" in window && navigator.maxTouchPoints > 0;
	}

	_unbindInput() {
		this.dom.removeEventListener("touchstart", this._touchStartBind, { capture: false });
		this.dom.removeEventListener("touchmove", this._touchMoveBind, { capture: false });
		this.dom.removeEventListener("touchend", this._touchEndBind, { capture: false });

		this.axis.set(0, 0);

		this._binded = false;
		this._lastTouchId = -1;
		this._startPoint.set(0, 0);
	}

	_bindInput() {
		if (this._binded) {
			this._unbindInput();
		}

		this._touchStartBind = this._touchStart.bind(this);
		this._touchMoveBind = this._touchMove.bind(this);
		this._touchEndBind = this._touchEnd.bind(this);

		this.dom.addEventListener("touchstart", this._touchStartBind, { capture: false });
		this.dom.addEventListener("touchmove", this._touchMoveBind, { capture: false });
		this.dom.addEventListener("touchend", this._touchEndBind, { capture: false });

		this._binded = true;
	}

	_touchStart(e: TouchEvent) {
		if (this._lastTouchId > 0) {
			return;
		}

		const last = e.changedTouches[0];

		this._lastTouchId = last.identifier;
		this._startPoint.set(last.clientX, last.clientY);

		this._callCallback();
	}

	_touchMove(e: TouchEvent) {
		const last = Array.from(e.changedTouches).find(e => e.identifier === this._lastTouchId);

		if (!last) {
			return;
		}

		TMP_V.set(last.clientX, last.clientY).sub(this._startPoint);

		if (TMP_V.length() > this.minDistance) {
			this._axis.copy(TMP_V).normalize();
		} else {
			this._axis.set(0, 0);
		}
	}

	_touchEnd(e: TouchEvent) {
		const last = Array.from(e.changedTouches).find(e => e.identifier === this._lastTouchId);

		if (!last) {
			return;
		}

		this._lastTouchId = -1;
		this._startPoint.set(0, 0);
		this.axis.set(0, 0);
	}
}

const KEYMAP = {
	87: [0, -1],
	38: [0, -1],
	83: [0, 1],
	40: [0, 1],

	65: [-1, 0],
	37: [-1, 0],
	68: [1, 0],
	39: [1, 0]
};

export class KeyboarInput extends AxesInput {
	_name = "Keyboard";

	_keyUpBind: any;
	_keyDownBind: any;
	_pressedKeys: Set<number> = new Set();
	_targetAxis = new Vector2();
	_lastAxis = new Vector2();
	_needLerp = false;
	_timer = 0;
	_delta = 0;

	public attach(dom: HTMLElement) {
		this._bindInput();
	}

	public update(delta: number) {
		const s = delta * 0.001;

		if (this._needLerp) {
			this._timer += s / this.lerpTime;

			this._axis.lerpVectors(this._lastAxis, this._targetAxis, Math.min(1, this._timer));

			if (this._timer >= 1) {
				this._timer = 0;
				this._needLerp = false;
			}
		}
	}

	public dispose() {
		this._unbindInput();
	}

	protected _bindInput() {
		if (this._binded) {
			this._unbindInput();
		}

		this._keyDownBind = this._keyDown.bind(this);
		this._keyUpBind = this._keyUp.bind(this);

		window.addEventListener("keydown", this._keyDownBind);
		window.addEventListener("keyup", this._keyUpBind);
	}

	protected _unbindInput() {
		window.removeEventListener("keydown", this._keyDownBind);
		window.removeEventListener("keyup", this._keyUpBind);

		this._lastAxis.set(0, 0);
		this._targetAxis.set(0, 0);

		this._axis.set(0, 0);
		this._delta = 0;
		this._needLerp = false;
	}

	static get supported(): boolean {
		return !TouchInput.supported;
	}

	_keyDown(e: KeyboardEvent) {
		if (!KEYMAP[e.keyCode]) {
			return;
		}

		this._pressedKeys.add(e.keyCode);
		this._updateAxis();
	}

	_keyUp(e: KeyboardEvent) {
		if (!KEYMAP[e.keyCode]) {
			return;
		}

		this._pressedKeys.delete(e.keyCode);
		this._updateAxis();
	}

	_updateAxis() {
		let x = 0,
			y = 0;

		this._pressedKeys.forEach(code => {
			x += KEYMAP[code][0];
			y += KEYMAP[code][1];
		});

		this._targetAxis.set(Math.sign(x), Math.sign(y));
		this._lastAxis.copy(this._axis);

		const delta = this._targetAxis.distanceTo(this._axis);

		if (this.lerpTime < 0.01 || delta < 0.01) {
			this._axis.copy(this._targetAxis);
		} else if (delta > 0.01) {
			this._needLerp = true;
			this._delta = delta;
		}

		this._callCallback();
	}
}

/**
 * @class
 * @description Universal input. Implement all supported inputs methods (touch and keyboard) with autoselect
 */

export class UniversalInput extends AxesInput {
	private _methods: AxesInput[] = [new TouchInput(), new KeyboarInput()];
	private _active: AxesInput;
	protected _name = "Universal;";

	public attach(dom: HTMLElement) {
		this._methods.forEach(e => {
			e.attach(dom);
			e.onInputCalled = x => this._called(x);
		});

		this._active = this._methods.find(e => (e.constructor as any).supported);
	}

	public update(delta: number) {
		this._methods.forEach(e => e.update(delta));
	}

	public dispose() {
		this._methods.forEach(e => e.dispose());
	}

	protected _bindInput() {
		this._methods.forEach(e => (e.enable = true));
		this._binded = true;
	}

	protected _unbindInput() {
		this._methods.forEach(e => (e.enable = false));
		this._binded = false;
	}

	private _called(from: AxesInput) {
		this._active = from;
		this._callCallback();
	}

	get axis() {
		return this._active.axis;
	}

	get activeInput() {
		return this._active;
	}

	static get supported() {
		return KeyboarInput.supported || TouchInput.supported;
	}
}
