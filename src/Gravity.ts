import {
  BufferGeometry,
  Geometry,
  Line3,
  Object3D,
  LineBasicMaterial,
  Line
} from "three";

export class Gravity {
  geom: Geometry;
  lines: Line3[] = [];
  _view: Object3D;

  constructor(geom: BufferGeometry | Geometry) {
    if (geom.type !== "Geometry") {
      this.geom = new Geometry().fromBufferGeometry(geom as BufferGeometry);
    } else {
      this.geom = geom as Geometry;
    }

    this.generate();
  }

  generate() {
    const ps = this.geom.vertices;

    this.geom.faces.forEach(face => {
      const vs = [ps[face.a], ps[face.b], ps[face.c]];
      let max = 0,
        v1,
        v2;

      for (let i = 0; i < 3; i++) {
        const a = vs[i];
        const b = vs[(i + 1) % 3];
        const d = a.distanceTo(b);

        if (d > max) {
          max = d;
          v1 = a;
          v2 = b;
        }
      }
      this.lines.push(new Line3(v1, v2));
    });
  }

  get view() {
    if (!this._view) {
      this._view = new Object3D();

      const lm = new LineBasicMaterial({
        color: 0x00ff00,
        depthTest: false,
        depthWrite: false
      });

      this.lines.forEach(e => {
        const lg = new Geometry();

        lg.vertices.push(e.start);
        lg.vertices.push(e.end);

        this._view.add(new Line(lg, lm));
      });
    }

    return this._view;
  }
}
