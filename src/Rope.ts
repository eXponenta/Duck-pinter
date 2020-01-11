import {
    Mesh,
    PlaneBufferGeometry,
    MeshPhongMaterial,
    Vector3,
    BufferAttribute,
    BufferGeometry,
    MeshBasicMaterial
} from "three";

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
    public minDistance = 0.5;
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

    rebuild() {
        if (!this._durty) return;

        if (this.points.length < 2) {
            this._durty = false;
            this.visible = false;
            return;
        }

        const p = this.points;
        const attr: BufferAttribute = (this.geometry as BufferGeometry).getAttribute("position");

        const t = new Vector3();
        const o = this.offset;
        const w = this.width * 0.5;
        const from = this._lastUpdateIndex;

        for (let i = from; i < Math.min(p.length, this.section + 1); i += 1) {
            const f = p[i];
            const n = p[i + 1] || f;

            if (n !== f) {
                t.subVectors(n.p, f.p)
                    .normalize()
                    .cross(f.n);
            }

            attr.setXYZ(
                i * 2 + 1,
                f.p.x - w * t.x + o * f.n.x,
                f.p.y - w * t.y + o * f.n.y,
                f.p.z - w * t.z + o * f.n.z
            );
            attr.setXYZ(
                i * 2 + 0,
                f.p.x + w * t.x + o * f.n.x,
                f.p.y + w * t.y + o * f.n.y,
                f.p.z + w * t.z + o * f.n.z
            );

            //todo update vertex normal
        }

        if (this.updateNormals) this.geometry.computeVertexNormals();

        (this.geometry as BufferGeometry).setDrawRange(0, 6 * (p.length - 1));
        attr.needsUpdate = true;

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
            const dist = point.distanceTo(this.points[this.points.length - 1].p);
            if (this.minDistance > dist) return;
        }

        this.points.push(new LinePoint(point.clone(), normal.clone()));
        this._durty = true;

        if (update) {
            this.rebuild();
        }
    }
}
