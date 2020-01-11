import RESOURCES from "./res.json";
import { Runner } from "@pixi/runner";
import {
  PerspectiveCamera,
  WebGLRenderer,
  LoadingManager,
  TextureLoader,
  WebGLRendererParameters,
  Scene,
  Clock
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export class BaseApp {
  static instance: BaseApp;

  _bindedTick: any;

  runs = {
    update: new Runner("update"),
    init: new Runner("init")
  };

  manager: LoadingManager = new LoadingManager();
  scene: Scene = new Scene();
  clock: Clock = new Clock();

  loaders = {
    model: new GLTFLoader(this.manager),
    texture: new TextureLoader(this.manager)
  };

  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  appEl: HTMLElement;
  width: number = 0;
  height: number = 0;

  constructor(elem: HTMLElement, options: WebGLRendererParameters = {}) {
    this.appEl = elem;
    this.width = elem.clientWidth;
    this.height = elem.clientHeight;

    this.renderer = new WebGLRenderer(options);

    this.camera = new PerspectiveCamera(60, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 4);

    this.scene = new Scene();
    this.scene.add(this.camera);

    this.resize();

    window.addEventListener("resize", () => this.resize());
    elem.appendChild(this.renderer.domElement);

    BaseApp.instance = this;
  }

  init() {
    this.postInit();
  }

  postInit() {
    this.runs.update.add(this);
  }

  tick() {
    const delta = this.clock.getDelta() * 1000;

    if (delta > 0) {
      this.runs.update.emit(delta);
    }

    this.renderer.render(this.scene, this.camera);

    if (!this._bindedTick) this._bindedTick = this.tick.bind(this);

    requestAnimationFrame(this._bindedTick);
  }

  resize() {
    const w = this.appEl.clientWidth;
    const h = this.appEl.clientHeight;

    const r = this.renderer;
    const c = this.camera;

    r.setSize(w, h);
    c.aspect = w / h;
    c.updateProjectionMatrix();
  }

  async getModel(id) {
    const path = RESOURCES.models[id];

    if (!path) throw new Error(`Can't found: ${id}`);

    return new Promise((res, rej) => {
      this.loaders.model.load(path, res, undefined, rej);
    });
  }
}
