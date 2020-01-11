import RESOURCES from "./res.json";

import {
  WebGLRenderTarget,
  OrthographicCamera,
  WebGLRenderer,
  Vector2,
  Color,
  Scene,
  Mesh,
  Sprite,
  MeshBasicMaterial,
  LinearFilter,
  NearestFilter,
  RGBFormat,
  PlaneBufferGeometry,
  Texture,
  TextureLoader,
  CanvasTexture
} from "three";

export interface IPushOpitions {
  point: Vector2;
  size?: number;
  color?: string | number | Color;
  angle?: number;
  brush?: Texture;
}

const canvas = document.createElement("canvas");
canvas.width = canvas.height = 2;
const ctx = canvas.getContext("2d");

ctx.fillStyle = "white";
ctx.fillRect(0, 0, 2, 2);

const NON_BRASH = new CanvasTexture(canvas);

export class RTBlitter extends WebGLRenderTarget {
  camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10);
  scene = new Scene();
  _brush: Sprite | Mesh;
  _brushTex: Texture;

  constructor(private renderer: WebGLRenderer, size = 1024) {
    super(size, size, {
      minFilter: LinearFilter,
      magFilter: NearestFilter,
      format: RGBFormat
    });

    this._brush = new Mesh(
      new PlaneBufferGeometry(1, 1),
      new MeshBasicMaterial({
        color: "#ff0000",
        transparent: true,
        premultipliedAlpha: false
      })
    );

    this.camera.position.z = 1;

    this.scene.add(this._brush);

    this._brushTex = new TextureLoader().load(RESOURCES.brushes.default, t => {
      t.premultiplyAlpha = false;
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
      t.needsUpdate = true;
    });

    this.clean();
  }

  clean() {
    this.push({
      point: new Vector2(0.5, 0.5),
      color: 0xffffff,
      size: this.width,
      brush: NON_BRASH
    });
  }

  push({ point, size = 10, color = 0xff0000, angle, brush }: IPushOpitions) {
    (this._brush.material as MeshBasicMaterial).color.set(color as any);
    (this._brush.material as MeshBasicMaterial).map = brush || this._brushTex;

    const uv = point.clone();
    const scale = size / 1000;
    const autoClear = this.renderer.autoClear;

    this.renderer.autoClear = false;
    this.texture.transformUv(uv);

    this._brush.scale.set(scale, scale, scale);
    this._brush.position.set(uv.x - 0.5, 0.5 - uv.y, 0);

    this.renderer.setRenderTarget(this);
    //debugger;

    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    this.renderer.autoClear = autoClear;
  }
}
