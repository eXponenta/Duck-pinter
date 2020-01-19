import { Mesh, PlaneBufferGeometry, Vector3, BufferAttribute, BufferGeometry, Material, Color } from "three";
import { LinePoint, ILineSegm } from "../math/Utils";

const TMP_T = new Vector3();
const TMP_V1 = new Vector3();

export class Rope extends Mesh {
	private durty = true;
	private lastUpdateIndex = 0;

	public parentRope: Rope;
	public segments: ILineSegm[] = [];
	public offset = 0.01;
	public minDistance = 10;

	constructor(private section: number = 100, private _width = 1, private _color = 0xff0000, private _mat: Material) {
		super(new PlaneBufferGeometry(_width, section * _width, 1, section), _mat);

		const geom = this.geometry as BufferGeometry;
		const colors = new Float32Array(geom.getAttribute("position").count * 3);

		geom.setAttribute("color", new BufferAttribute(colors, 3, true));

		this.rebuild(false);
		this._rebuildColor();
	}

	get width() {
		return this._width;
	}

	set width(v) {
		if (v === this.width || v <= 0) {
			return;
		}

		this._width = v;
		this.rebuild(true);
	}

	get closed() {
		return this.segments.length === this.section;
	}

	set color(v) {
		if (this._color === v) {
			return;
		}

		this._color = v;
		this._rebuildColor();
	}

	get color() {
		return this._color;
	}

	get last() {
		return this.segments[this.segments.length - 1];
	}

	rebuild(force = false) {
		if (!this.durty && !force) {
			return;
		}

		if (this.segments.length < 1) {
			this.durty = false;
			this.visible = false;
			return;
		}

		const g = this.geometry as BufferGeometry;
		const p = this.segments;
		const poss = g.getAttribute("position") as BufferAttribute;
		const normal = g.getAttribute("normal") as BufferAttribute;

		const t = TMP_T;
		const a1 = TMP_V1;
		const o = this.offset;
		const w = this.width * 0.5;
		const from = force ? 0 : this.lastUpdateIndex;

		for (let i = from; i < Math.min(p.length, this.section); i += 1) {
			const f = p[i].a;
			const n = p[i].b;

			if (n !== f) {
				t.subVectors(n.p, f.p)
					.normalize()
					.cross(f.n)
					.multiplyScalar(-w);
			}

			a1.addVectors(f.p, t).addScaledVector(f.n, o);

			poss.setXYZ(i * 2 + 1, a1.x, a1.y, a1.z);

			a1.addScaledVector(t, -2);

			poss.setXYZ(i * 2 + 0, a1.x, a1.y, a1.z);

			//todo update vertex normal
			normal.setXYZ(i * 2 + 0, f.n.x, f.n.y, f.n.z);
			normal.setXYZ(i * 2 + 1, f.n.x, f.n.y, f.n.z);
		}

		g.setDrawRange(0, 6 * (p.length - 1) + 2);

		poss.needsUpdate = true;
		normal.needsUpdate = true;

		this.durty = false;
		this.lastUpdateIndex = this.segments.length - 1;

		this.visible = true;
	}

	join(parent: Rope) {
		const pp = parent.segments;
		const seg = pp[pp.length - 1];

		this.pushPoint(seg.a.p, seg.a.n);
		this.pushPoint(seg.b.p, seg.b.n);

		this.rebuild();

		this.parentRope = parent;
	}

	pushPoint(point: Vector3, normal: Vector3, update = false) {
		const segs = this.segments;

		if (segs.length) {
			const dist = point.distanceTo(this.last.a.p);

			if (this.minDistance > dist && update) {
				this._updateLink(point, normal);
				//this._computeSelfIntersecion();

				return;
			}
		}

		let b = new LinePoint(point, normal);
		let a = this.last ? this.last.b : b.clone();
		let id = this.last ? this.last.id + 1 : 0;

		const seg = {
			a,
			b,
			rope: this,
			id
		};

		this.segments.push(seg);

		if (update) {
			this.durty = true;
			this.rebuild();
		}
	}

	_updateLink(point: Vector3, normal: Vector3) {
		this.last.b.n.copy(normal);
		this.last.b.p.copy(point);

		//we need shift for updating latest 2 points
		this.lastUpdateIndex = Math.min(this.lastUpdateIndex, this.segments.length - 1);
		this.durty = true;

		this.rebuild();
	}

	_rebuildColor() {
		const color = (this.geometry as BufferGeometry).getAttribute("color") as BufferAttribute;
		const c = new Color(this._color);

		for (let i = 0; i < color.count; i++) {
			color.setXYZ(i, c.r, c.g, c.b);
		}

		color.needsUpdate = true;
	}

	clean(requrent: boolean = true) {
		this.segments.length = 0;
		this.durty = true;
		this.lastUpdateIndex = 0;

		this.rebuild(true);

		if (requrent && this.parentRope) {
			this.parentRope.clean(requrent);
		}
	}
}
