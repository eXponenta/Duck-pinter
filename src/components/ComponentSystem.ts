export interface IEntity {
	components: Map<IComponentCtr, IComponent>;

	add(componentType: IComponentCtr);
	get<T extends IComponent>(componentType: IComponentCtr): T | undefined;
	del(componentType: IComponentCtr);
}

interface IComponentCtr {
	new (target: IEntity): IComponent;
}

export class Entity implements IEntity {
	private initDone: boolean = false;

	components: Map<IComponentCtr, IComponent> = new Map();

	constructor(...components: IComponentCtr[]) {
		components.forEach(ctr => {
			this.add(ctr);
		});

		// call init after adding
		this.components.forEach(e => {
			e.onInit && e.onInit();
		});

		this.initDone = true;
	}

	add(componentType: IComponentCtr) {
		const instance = new componentType(this);

		// call init when add, if add after initing by constructor
		this.initDone && instance.onInit && instance.onInit();

		this.components.set(componentType, instance);
		return instance;
	}

	del(componentType: IComponentCtr) {
		const instance = this.components.get(componentType);
		if (!instance) {
			return;
		}

		instance.onDestroy && instance.onDestroy();
		this.components.delete(componentType);
	}

	get<T extends IComponent>(componentType: IComponentCtr): T | undefined {
		const instance = this.components.get(componentType);
		if (!instance) {
			return undefined;
		}

		return instance as T;
	}

	update(delta: number) {
		this.components.forEach(e => {
			e.update && e.update(delta);
		});
	}
}

export interface IComponent {
	name: string;
	target: IEntity;

	update?(delta: number): void;

	onInit?(): void;
	onDestroy?(): void;
}
