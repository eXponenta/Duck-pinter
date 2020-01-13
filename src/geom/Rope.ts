import { Mesh, PlaneBufferGeometry, MeshPhongMaterial, Vector3, BufferAttribute, BufferGeometry } from "three";

const TMP_T = new Vector3();
const TMP_V1 = new Vector3();
const TMP_V2 = new Vector3();

class LinePoint {
	constructor(public p: Vector3, public n: Vector3) {}

	clone() {
		return new LinePoint(this.p.clone(), this.n.clone());
	}
}

export class Rope extends Mesh {
	private points: LinePoint[] = [];
	private _durty = true;
	private _lastUpdateIndex = 0;

	public offset = 0.01;
	public minDistance = 10;
	public updateNormals = false;

	constructor(private section: number = 100, private _width = 1, private _color = 0xff0000) {
		super(
			new PlaneBufferGeometry(_width, section * _width, 1, section),
			new MeshPhongMaterial({ color: _color, wireframe: false })
		);

		this.rebuild();
	}

	get width() {
		return this._width;
	}

	set width(v) {
		if (v === this.width || v <= 0) return;

		this._width = v;
		this._durty = true;
		this._lastUpdateIndex = 0;

		this.rebuild();
	}

	get closed() {
		return this.points.length === this.section + 1;
	}

	set color(v) {
		if (this._color === v) return;

		this._color = v;
		this.material.color.set(v);
	}

	get color() {
		return this._color;
	}

	get last() {
		return this.points[this.points.length - 1];
	}

	rebuild(force = false) {
		if (!this._durty && !force) return;

		if (this.points.length < 2) {
			this._durty = false;
			this.visible = false;
			return;
		}

		const g = this.geometry as BufferGeometry;
		const p = this.points;
		const poss = g.getAttribute("position") as BufferAttribute;
		const normal = g.getAttribute("normal") as BufferAttribute;

		const t = TMP_T;
		const a1 = TMP_V1;
		const o = this.offset;
		const w = this.width * 0.5;
		const from = this._lastUpdateIndex;

		for (let i = from; i < Math.min(p.length, this.section + 1); i += 1) {
			const f = p[i];
			const n = p[i + 1] || f;

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

		this._durty = false;
		this._lastUpdateIndex = this.points.length - 1;

		this.visible = true;
	}

	join(parent: Rope) {
		const pp = parent.points;
		const a = pp[pp.length - 2];
		const b = pp[pp.length - 1];

		this.pushPoint(a.p, a.n);
		this.pushPoint(b.p, b.n);

		this.rebuild();
	}

	pushPoint(point: Vector3, normal: Vector3, update = false) {
		if (this.points.length) {
			const last2 = this.points[this.points.length - 2];
			const dist = point.distanceTo(last2.p);

			if (this.minDistance > dist && update) {
				this._updateLink(point, normal);
				return;
			}
		}

		this.points.push(new LinePoint(point, normal));

		// create link point, used for untiblick
		if (this.points.length === 1) {
			this.points.push(this.points[0].clone());
		}

		if (update) {
			this.rebuild(true);
		}
	}

	_updateLink(point: Vector3, normal: Vector3) {
		this.last.n.copy(normal);
		this.last.p.copy(point);

		// we need shift for updateing lastes 2 points
		this._lastUpdateIndex = Math.min(this._lastUpdateIndex, this.points.length - 2);

		this.rebuild(true);
	}

	clean() {
		this.points.length = 0;
		this._durty = true;
		this._lastUpdateIndex = 0;

		this.rebuild();
	}
}
