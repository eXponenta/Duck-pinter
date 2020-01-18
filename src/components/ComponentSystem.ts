export interface IComponentCtr {
	new (target: IEntity): IComponent;
}

export interface IComponent {
	name: string;
	target: IEntity;
	active: boolean;

	update?(delta: number): void;

	onInit?(): void;
	onDestroy?(): void;
	onActivate?(): void;
	onDeactivate?(): void;
}

export interface IEntity {
	components: Map<IComponentCtr, IComponent>;

	addFirst<T extends IComponent>(componentType: IComponentCtr): T;
	add<T extends IComponent>(componentType: IComponentCtr): T;
	get<T extends IComponent>(componentType: IComponentCtr): T | undefined;
	del(componentType: IComponentCtr): boolean;
}

export abstract class Component implements IComponent {
	name: string = "abstractComponent";
	private _active: boolean = true;

	constructor(public target: IEntity) {}

	onActivate?(): void {}
	onDeactivate?(): void {}

	set active(v) {
		if (v === this._active) return;
		this._active = v;

		if (v) {
			this.onActivate && this.onActivate();
		} else {
			this.onDeactivate && this.onDeactivate();
		}
	}

	get active() {
		return this._active;
	}
}

export class Entity implements IEntity {
	private _init: boolean = false;

	components: Map<IComponentCtr, IComponent> = new Map();

	constructor(...components: IComponentCtr[]) {
		components.forEach(ctr => {
			this.add(ctr);
		});

		// call init after adding
		this.components.forEach(e => {
			e.onInit && e.onInit();
		});

		this._init = true;
	}

	addFirst<T extends IComponent>(componentType: IComponentCtr): T {
		// remove existed component with same type
		this.del(componentType);

		const instance = new componentType(this);

		// call init when add, if add after initing by constructor
		this._init && instance.onInit && instance.onInit();

		// get all components with safing order
		const cmp = Array.from(this.components.entries());

		// clear component map
		this.components.clear();

		// add new component
		this.components.set(componentType, instance);

		// restore all saved components
		// added component first on update order now
		cmp.forEach(([type, inst]) => this.components.set(type, inst));

		return instance as T;
	}

	add<T extends IComponent>(componentType: IComponentCtr): T {
		// remove existed component with same type
		this.del(componentType);

		const instance = new componentType(this);

		// call init when add, if add after initing by constructor
		this._init && instance.onInit && instance.onInit();

		this.components.set(componentType, instance);

		return instance as T;
	}

	del(componentType: IComponentCtr): boolean {
		const instance = this.components.get(componentType);

		if (!instance) {
			return false;
		}

		instance.onDestroy && instance.onDestroy();

		this.components.delete(componentType);

		return true;
	}

	get<T extends IComponent>(componentType: IComponentCtr): T | undefined {
		const instance = this.components.get(componentType);

		if (!instance) {
			return undefined;
		}

		return instance as T;
	}

	update(delta: number) {
		// interate and call update for active components
		this.components.forEach(e => {
			e.active && e.update && e.update(delta);
		});
	}
}
