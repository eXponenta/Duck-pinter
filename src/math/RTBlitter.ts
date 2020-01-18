import {
	WebGLRenderTarget,
	OrthographicCamera,
	WebGLRenderer,
	Vector2,
	Color,
	Scene,
	Mesh,
	MeshBasicMaterial,
	LinearFilter,
	NearestFilter,
	RGBAFormat,
	PlaneBufferGeometry,
	Texture,
	CanvasTexture
} from "three";

function generateCircleBrush(size = 10) {
	const c = document.createElement("canvas");
	c.width = c.height = size;

	const ctx = c.getContext("2d");

	ctx.fillStyle = "white";
	ctx.imageSmoothingEnabled = true;

	ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
	ctx.fill();

	return new CanvasTexture(c);
}

function generateEmptyBrush() {
	const c = document.createElement("canvas");
	c.width = c.height = 2;

	const ctx = c.getContext("2d");

	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, 2, 2);

	return new CanvasTexture(c);
}

const BRUSH = generateCircleBrush(64);
const EMPTY = generateEmptyBrush();

export interface IPushOpitions {
	point: Vector2;
	size?: number;
	color?: string | number | Color;
	angle?: number;
	brush?: Texture;
}

export class RTBlitter extends WebGLRenderTarget {
	private camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10);
	private scene = new Scene();
	private brushPool: Mesh[] = [];
	private activeBrush = 0;
	private dirty = false;

	constructor(private renderer: WebGLRenderer, size = 1024) {
		super(size, size, {
			minFilter: LinearFilter,
			magFilter: NearestFilter,
			format: RGBAFormat
		});

		const g = new PlaneBufferGeometry(1, 1);

		this.brushPool = Array.from({ length: 10 }, () => {
			let m = new Mesh(
				g,
				new MeshBasicMaterial({
					premultipliedAlpha: false,
					/*
					blending: CustomBlending,
					blendDst: DstColorFactor,
					blendSrc: OneFactor,*/

					transparent: true,
					depthTest: false,
					depthWrite: false
				})
			);
			m.visible = false;
			return m;
		});

		this.camera.position.z = 1;
		this.scene.add(...this.brushPool);
		this.clean();
	}

	clean() {
		this.push({
			point: new Vector2(0.5, 0.5),
			color: 0xffffff,
			size: this.width,
			brush: EMPTY
		});
		this.commit();
	}

	push({ point, size = 10, color = 0xff0000, angle, brush }: IPushOpitions) {
		const brushEl = this.brushPool[this.activeBrush];
		const uv = point.clone();
		const scale = size / 1000;

		(brushEl.material as MeshBasicMaterial).color.set(color as any);
		(brushEl.material as MeshBasicMaterial).map = brush;
		(brushEl.material as MeshBasicMaterial).needsUpdate = true;

		this.texture.transformUv(uv);

		brushEl.visible = true;
		brushEl.scale.set(scale, scale, scale);
		brushEl.position.set(uv.x - 0.5, 0.5 - uv.y, 0);

		this.dirty = true;
		this.activeBrush++;

		if (this.activeBrush >= this.brushPool.length) {
			this.commit();
		}
	}

	commit() {
		if (!this.dirty) {
			return;
		}

		const autoClear = this.renderer.autoClear;

		this.renderer.autoClear = false;
		this.renderer.setRenderTarget(this);

		this.renderer.render(this.scene, this.camera);
		this.renderer.setRenderTarget(null);

		this.renderer.autoClear = autoClear;

		this.brushPool.forEach(e => (e.visible = false));
		this.activeBrush = 0;
		this.dirty = false;
	}
}
