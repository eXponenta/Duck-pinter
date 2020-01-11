import {
  Mesh,
  PlaneBufferGeometry,
  MeshPhongMaterial,
  Vector3,
  BufferAttribute,
  BufferGeometry
} from "three";

class LinePoint {
  constructor(public p: Vector3, public n: Vector3) {}

  clone() {
    return new LinePoint(this.p.clone(), this.n.clone());
  }
}

export class Rope extends Mesh {
  private points: LinePoint[] = [];
  private _durty = false;
  private offset = 0.01;

  constructor(
    private section: number = 100,
    private _width = 1,
    private _color = 0xff0000
  ) {
    super(
      new PlaneBufferGeometry(_width, section * _width, 1, section),
      new MeshPhongMaterial({ color: _color })
    );
  }

  get width() {
    return this._width;
  }

  set width(v) {
    if (v === this.width || v <= 0) return;

    this._width = v;
    this._durty = true;
    this.rebuild();
  }

  rebuild() {
    if (!this._durty || this.points.length < 2) return;

    const p = this.points;
    const attr: BufferAttribute = (this
      .geometry as BufferGeometry).getAttribute("position");

    const t = new Vector3();
    const o = this.offset;
    const w = this.width * 0.5;

    for (let i = 0; i < Math.min(p.length, this.section); i += 1) {
      const f = p[i];
      const n = p[i + 1] || f;

      if (n !== f) {
        t.subVectors(n.p, f.p)
          .normalize()
          .cross(f.n);
      }

      attr.setXYZ(
        i * 2,
        f.p.x + t.x * w + f.n.x * o,
        f.p.y + t.y * w + f.n.y * o,
        f.p.z + t.z * w + f.n.z * o
      );
      attr.setXYZ(
        i * 2 + 1,
        f.p.x - t.x * w + f.n.x * o,
        f.p.y - t.y * w + f.n.y * o,
        f.p.z - t.z * w + f.n.z * o
      );
    }

    (this.geometry as BufferGeometry).setDrawRange(0, p.length + 1);
    attr.needsUpdate = true;

    this._durty = false;
  }

  pushPoint(point: Vector3, normal: Vector3) {
    this.points.push(new LinePoint(point.clone(), normal.clone()));
  }
}
