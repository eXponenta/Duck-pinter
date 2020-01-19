import {
	Box3,
	Vector3,
	Mesh,
	Face3,
	BufferGeometry,
	Geometry,
	Raycaster,
	Triangle,
	Object3D,
	Box3Helper,
	Color,
	Vector2
} from "three";

export interface IFaceData {
	face: Face3;
	faceIndex: number;
	normal: Vector3;
	point?: Vector3;
	distance: number;
	uv?: Vector2;
}

export interface IBoxIntersector {
	intersectsBox(box: Box3, node?: OctNode): boolean;
}

const TMP_V1 = new Vector3();
const TMP_V2 = new Vector3();
const TMP_V3 = new Vector3();
const TMP_T = new Triangle();

function calcUV(result: IFaceData, geometry: Geometry) {
	const f = result.face;

	if (!f) {
		return;
	}

	const vtx = geometry.vertices;
	const uvs = geometry.faceVertexUvs[0];
	const fuv = uvs[result.faceIndex];

	result.uv = new Vector2();

	Triangle.getUV(
		result.point,
		// VTX
		vtx[f.a],
		vtx[f.b],
		vtx[f.c],
		// UVS
		fuv[0],
		fuv[1],
		fuv[2],
		result.uv
	);
}
export class FaceOctree {
	public depth: number = 0;
	public geom: Geometry;

	constructor(public head: OctNode) {}

	raycast(raycaster: Raycaster, results: IFaceData[] = [], firstResult = false) {
		const ray = raycaster.ray;
		const boxes: OctNode[] = [];
		const vtx = this.geom.vertices;
		const targetPoint = new Vector3();

		const res = this.head.traverceNodes(ray, boxes);

		if (!res) return false;

		boxes.reverse();

		let stop = false;

		for (let b of boxes) {
			const cc: Array<IFaceData> = b.content;

			if (!cc || !cc.length) {
				continue;
			}

			for (let e of cc) {
				const a = vtx[e.face.a];
				const b = vtx[e.face.b];
				const c = vtx[e.face.c];

				if (ray.intersectTriangle(a, b, c, false, targetPoint)) {
					const faceData = {
						face: e.face,
						normal: e.normal,
						faceIndex: e.faceIndex,
						point: targetPoint.clone(),
						distance: ray.origin.distanceToSquared(targetPoint)
					};

					calcUV(faceData, this.geom);

					results.push(faceData);

					if (firstResult) {
						stop = true;
						break;
					}
				}
			}

			if (stop) {
				break;
			}
		}

		//console.log("Octree iterations", iterations);

		return results;
	}

	closestPoint(point: Vector3): IFaceData | undefined {
		const method = {
			point: point.clone(),
			intersectsBox(bb: Box3, node: OctNode) {
				return bb.containsPoint(this.point);
			}
		};

		const nodes = this.head.traverceNodes(method);

		if (!nodes.length) {
			return undefined;
		}

		const vtx = this.geom.vertices;
		const result = new Vector3();
		const tris = TMP_T;

		let min = Infinity;
		let minFd: IFaceData = undefined;

		for (let n of nodes) {
			for (let fd of n.content) {
				const a = vtx[fd.face.a];
				const b = vtx[fd.face.b];
				const c = vtx[fd.face.c];

				tris.set(a, b, c);

				const res = tris.closestPointToPoint(point, TMP_V1);

				if (!res) {
					return;
				}

				const delta = res.distanceTo(point);

				if (min > delta) {
					min = delta;
					minFd = fd;
					result.copy(res);
				}
			}

			minFd.point = result;

			calcUV(minFd, this.geom);
		}

		return minFd;
	}

	genNodeLevel(level = 1) {
		const group = new Object3D();
		const head = this.head;
		const fetch = [];
		const q = [...head.children];

		level = Math.min(level, this.depth - 1);

		while (q.length) {
			const top = q.pop();

			if (!top) {
				continue;
			}

			if (top.level === level) {
				fetch.push(top);
			} else if (top.children) {
				q.push(...top.children);
			}
		}

		const h = fetch.map(e => {
			return new Box3Helper(e.bb, new Color(0x00ff00));
		});

		group.add(...h);
		return group;
	}

	static fromMesh(mesh: Mesh, minimalNodeSize = 0.01) {
		let geom: Geometry;

		if (mesh.geometry.type === "BufferGeometry") {
			geom = new Geometry().fromBufferGeometry(mesh.geometry as BufferGeometry);
		} else {
			geom = mesh.geometry as Geometry;
		}

		mesh.updateMatrixWorld(true);
		geom.computeBoundingBox();

		const tmpV = [TMP_V1, TMP_V2, TMP_V3];

		const verts = geom.vertices;
		const faces = geom.faces;
		const bbClone = geom.boundingBox.clone();

		const size = new Vector3();
		bbClone.getSize(size);

		bbClone.expandByScalar(size.length() * 0.025);

		console.log("Total faces:", faces.length);

		const tree = new FaceOctree(new OctNode(bbClone));

		for (let i = 0; i < faces.length; i++) {
			const f = faces[i];

			tmpV[0].copy(verts[f.a]); //.applyMatrix4(mesh.matrixWorld);
			tmpV[1].copy(verts[f.b]); //.applyMatrix4(mesh.matrixWorld);
			tmpV[2].copy(verts[f.c]); //.applyMatrix4(mesh.matrixWorld);

			const bb = new Box3().setFromPoints(tmpV);
			const data = {
				face: f,
				faceIndex: i,
				// transform object space to world space
				normal: f.normal.clone().transformDirection(mesh.matrixWorld)
			};

			const node = tree.head.addNode(bb, data, minimalNodeSize);

			tree.depth = Math.max(tree.depth, node ? node.level + 1 : 0);
		}

		tree.geom = geom;
		return tree;
	}
}

/**
 * @description Leaf for Octree
 */
export class OctNode {
	parent: OctNode = null;
	level: number = 0;
	children: OctNode[] = null;
	content: Array<any> = [];

	constructor(public bb: Box3) {}

	//Method to clone
	clone() {
		let otn = new OctNode(this.bb);
		otn.content = this.content;

		if (this.children !== null) {
			otn.children = [];

			for (let c of this.children) {
				let cn = c.clone();
				cn.parent = otn;
				otn.children.push(cn);
			}
		}

		return otn;
	}

	_rebuildTree(bb: Box3, minsize = 0): OctNode | undefined {
		const center = TMP_V1;
		const size = TMP_V2;

		if (!this.bb.containsBox(bb)) {
			return undefined;
		}

		// Terminate on first vacant cell, regardless of size:
		// ?? why
		//if (this.content === null) {
		//  return this;
		//}

		// check minimal size
		if (minsize > 0) {
			this.bb.getSize(size);

			if (size.length() <= minsize) {
				console.log("Stripped by size:", size.length(), minsize);
				return this;
			}
		}

		// relative self center
		this.bb.getCenter(center);

		const in_first_x_half = bb.max.x < center.x;
		const in_second_x_half = bb.min.x > center.x;

		if (!(in_first_x_half || in_second_x_half)) {
			return this;
		}

		const in_first_y_half = bb.max.y < center.y;
		const in_second_y_half = bb.min.y > center.y;

		if (!(in_first_y_half || in_second_y_half)) {
			return this;
		}

		const in_first_z_half = bb.max.z < center.z;
		const in_second_z_half = bb.min.z > center.z;

		if (!(in_first_z_half || in_second_z_half)) {
			return this;
		}

		const childIndex = ~~in_second_x_half * 4 + ~~in_second_y_half * 2 + ~~in_second_z_half;

		//console.log(childIndex);

		if (!this.children) {
			this.children = [null, null, null, null, null, null, null, null];
		}

		if (!this.children[childIndex]) {
			const node = new OctNode(
				new Box3(
					new Vector3(
						in_first_x_half ? this.bb.min.x : center.x,
						in_first_y_half ? this.bb.min.y : center.y,
						in_first_z_half ? this.bb.min.z : center.z
					),
					new Vector3(
						in_second_x_half ? this.bb.max.x : center.x,
						in_second_y_half ? this.bb.max.y : center.y,
						in_second_z_half ? this.bb.max.z : center.z
					)
				)
			);

			node.parent = this;
			node.level = this.level + 1;

			this.children[childIndex] = node;
		}

		return this.children[childIndex]._rebuildTree(bb, minsize);
	}

	addNode(bb: Box3, content: any = undefined, minsize: number = 0.05) {
		if (!bb) {
			throw Error("bb cant'b null!");
		}

		const otnode = this._rebuildTree(bb, minsize);

		if (content) {
			otnode.content.push(content);
		}

		return otnode;
	}

	traverceNodes(intersector: IBoxIntersector, res: OctNode[] = []) {
		if (!intersector) {
			throw Error("Intersector can't be null!");
		}

		if (!intersector.intersectsBox(this.bb, this)) {
			return undefined;
		}

		res.push(this);

		if (this.children) {
			let childs = this.children;
			for (let child of childs) {
				child && child.traverceNodes(intersector, res);
			}
		}

		return res;
	}

	getMinimalNodes(intersector: IBoxIntersector, nodes: OctNode[] = []) {
		if (!intersector) {
			throw Error("Intersector can't be null!");
		}

		if (!intersector.intersectsBox(this.bb, this)) {
			return null;
		}

		// when childrens empty, this is last node
		if (!this.children) {
			this.content.length && nodes.push(this);
			return nodes;
		}

		for (let child of this.children) {
			child && child.getMinimalNodes(intersector, nodes);
		}

		return nodes;
	}
}
