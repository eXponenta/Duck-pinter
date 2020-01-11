import {
  Object3D,
  DirectionalLight,
  AmbientLight,
  Vector3,
  MeshLambertMaterial,
  FrontSide,
  Mesh,
  LineBasicMaterial
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RTBlitter } from "./RTBlitter";
import { Roller2 } from "./Roller2";
import { BaseApp } from "./BaseApp";

import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";

export class App extends BaseApp {
  /**
   *
   * @param {HTMLElement} appEl
   */
  constructor(appEl) {
    super(appEl);

    this.camera.z = 15;
    this.dLite = new DirectionalLight(0xffffff, 1);
    this.dLite.position.set(2, 2, 2);

    this.aLight = new AmbientLight(0x808080, 0.5);

    this.scene.add(this.dLite, this.aLight);

    /**
     * @type {Object3D}
     */
    this.model = undefined;

    this.rt = new RTBlitter(this.renderer, 1024 * 2);
    this.inputAxis = new Vector3();
  }

  init() {
    this._pivot = new Object3D();
    this._roller = new Roller2(this);
    this._orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this._orbit.enableKeys = false;

    this.line = new Mesh(
      new LineGeometry(),
      new LineBasicMaterial({ color: 0x00ff00 })
    );

    this.scene.add(this._pivot);

    this._roller.onSolved = ({ uv }) => {
      this.rt.push({ point: uv });
    };
  }

  postInit() {
    this.bindInput();

    this.runs.update.add(this._orbit);
    this.runs.update.add(this._roller);

    super.postInit();
  }

  /**
   *
   * @param {Scene} gltfScene
   */
  setSurface(gltfScene) {
    const model = gltfScene.children[0];

    if (this.model) {
      this.scene.remove(this.model);
    }

    this.model = model;

    model.material = new MeshLambertMaterial();
    model.material.map = this.rt.texture;
    model.material.side = FrontSide;

    this.scene.add(model);
  }

  async preload(progress) {
    if (progress) {
      this.manager.onProgress = progress;
    }

    const scene = await this.getModel("box");

    this.setSurface(scene.scene);

    const roller = await this.getModel("roller");

    this._roller.view = roller.scene;

    this.scene.add(this._roller.view);

    this._roller.bind(this.model, new Vector3(0, 0, 7));

    this.postInit();
  }

  update(delta) {
    this.dLite.position.copy(this._roller.position);

    const t = this.inputAxis.clone().multiplyScalar(0.01);
    this._roller.move(t);
  }

  bindInput() {
    this.inputAxis.set(0, 0, 0);
    window.addEventListener("keydown", this._keyDown.bind(this));
    window.addEventListener("keyup", this._keyUp.bind(this));
  }

  _keyUp(event) {
    const c = event.which;

    let x = c === 65 || c === 37;
    let z = c === 87 || c === 38;

    x += c === 68 || c === 39;
    z += c === 83 || c === 40;

    if (x !== 0) this.inputAxis.x = 0;
    if (z !== 0) this.inputAxis.z = 0;
  }

  _keyDown(event) {
    const c = event.which;

    let x = c === 65 || c === 37;
    let z = c === 87 || c === 38;

    x -= c === 68 || c === 39;
    z -= c === 83 || c === 40;

    this.inputAxis.x = Math.max(-1, Math.min(1, x + this.inputAxis.x));
    this.inputAxis.z = Math.max(-1, Math.min(1, z + this.inputAxis.z));
  }
}
