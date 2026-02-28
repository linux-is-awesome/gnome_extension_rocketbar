/**
 * Type declarations for gi://Graphene (used by Mtk, Meta, Clutter, Gtk, etc.).
 * Aligned with the Graphene C API / GObject Introspection (GIR).
 * Types: Rect, Point, Point3D, Size, Vec2, Matrix, Vec3, Vec4, Euler, Box, Quad.
 */
declare module 'gi://Graphene' {

    // --- Rect ---
    interface Rect {
        readonly origin: Point;
        readonly size: Size;
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;

        init(x?: number, y?: number, width?: number, height?: number): Rect;
        init_from_rect(src: Rect): Rect;

        get_x(): number;
        get_y(): number;
        get_width(): number;
        get_height(): number;
        get_area(): number;
        get_center(): Point;
        get_top_left(): Point;
        get_top_right(): Point;
        get_bottom_right(): Point;
        get_bottom_left(): Point;
        get_vertices(): [Point, Point, Point, Point];

        contains_point(point: Point): boolean;
        contains_rect(rect: Rect): boolean;
        equal(b: Rect): boolean;

        /** Inset by d_x (horizontal) and d_y (vertical). Modifies in place. */
        inset(d_x: number, d_y: number): void;
        /** Inset by d_x and d_y; returns new Rect. */
        inset_r(d_x: number, d_y: number): Rect;
        offset(dx: number, dy: number): void;
        offset_r(dx: number, dy: number): Rect;
        normalize(): void;
        normalize_r(): Rect;
        expand(point: Point): void;
        scale(s_x: number, s_y: number): void;
        round(): void;
        round_extents(): void;
        round_to_pixel(): void;

        /** Returns the union of this rect and b (C API uses out param). */
        union(b: Rect): Rect;
        /** Returns [true, result_rect] if intersection exists, [false, result_rect] otherwise. */
        intersection(b: Rect): [boolean, Rect];

        interpolate(b: Rect, factor: number): Rect;

        free(): void;
    }

    // --- Vec2 (2D vector; used with Point) ---
    interface Vec2 {
        readonly x: number;
        readonly y: number;

        init(x?: number, y?: number): Vec2;
        init_from_vec2(src: Vec2): Vec2;
        init_from_float(src: number[]): Vec2;
        get_x(): number;
        get_y(): number;
        add(b: Vec2): Vec2;
        subtract(b: Vec2): Vec2;
        multiply(b: Vec2): Vec2;
        divide(b: Vec2): Vec2;
        scale(factor: number): Vec2;
        dot(b: Vec2): number;
        length(): number;
        normalize(): Vec2;
        equal(b: Vec2): boolean;
        near(b: Vec2, epsilon: number): boolean;
        interpolate(b: Vec2, factor: number): Vec2;
        free(): void;
    }

    // --- Point ---
    interface Point {
        x: number;
        y: number;

        init(x?: number, y?: number): Point;
        init_from_point(src: Point): Point;
        init_from_vec2(v: Vec2): Point;
        get_x(): number;
        get_y(): number;
        to_vec2(): Vec2;
        equal(b: Point): boolean;
        near(b: Point, epsilon?: number): boolean;
        distance(b: Point): number;
        interpolate(b: Point, factor: number): Point;
        free(): void;
    }

    // --- Point3D ---
    interface Point3D {
        readonly x: number;
        readonly y: number;
        readonly z: number;

        init(x?: number, y?: number, z?: number): Point3D;
        init_from_point3d(src: Point3D): Point3D;
        get_x(): number;
        get_y(): number;
        get_z(): number;
        equal(b: Point3D): boolean;
        near(b: Point3D, epsilon: number): boolean;
        cross(b: Point3D): Point3D;
        dot(b: Point3D): number;
        distance(b: Point3D): number;
        interpolate(b: Point3D, factor: number): Point3D;
        free(): void;
    }

    // --- Size ---
    interface Size {
        width: number;
        height: number;

        init(width?: number, height?: number): Size;
        init_from_size(src: Size): Size;
        get_width(): number;
        get_height(): number;
        equal(b: Size): boolean;
        free(): void;
    }

    // --- Matrix ---
    interface Matrix {
        init_identity(): Matrix;
        init_from_float(v: number[]): Matrix;
        init_from_vec4(v0: Vec4, v1: Vec4, v2: Vec4, v3: Vec4): Matrix;
        init_from_matrix(src: Matrix): Matrix;
        init_from_2d(xx: number, yx: number, xy: number, yy: number, x_0: number, y_0: number): Matrix;
        init_perspective(fovy: number, aspect: number, z_near: number, z_far: number): Matrix;
        init_ortho(left: number, right: number, top: number, bottom: number, z_near: number, z_far: number): Matrix;
        init_look_at(eye: Point3D, center: Point3D, up: Vec3): Matrix;
        init_frustum(left: number, right: number, bottom: number, top: number, z_near: number, z_far: number): Matrix;
        init_scale(s_x: number, s_y: number, s_z: number): Matrix;
        init_translate(p: Point3D): Matrix;
        init_rotate(angle: number, axis: Vec3): Matrix;
        init_skew_x_y(skew_x: number, skew_y: number): Matrix;

        is_identity(): boolean;
        is_2d(): boolean;
        is_backface_visible(): boolean;
        is_singular(): boolean;
        determinant(): number;

        get_row(index: number): Vec4;
        get_value(row: number, col: number): number;
        to_float(): number[];
        to_2d(): [number, number, number, number, number, number];

        multiply(b: Matrix): Matrix;
        transform_vec4(v: Vec4): Vec4;
        transform_vec3(v: Vec3): Vec3;
        transform_point(p: Point): Point;
        transform_point3d(p: Point3D): Point3D;
        transform_rect(r: Rect): Rect;
        transform_bounds(b: Box): Box;

        free(): void;
    }

    // --- Vec3 ---
    interface Vec3 {
        readonly x: number;
        readonly y: number;
        readonly z: number;

        init(x?: number, y?: number, z?: number): Vec3;
        init_from_vec3(src: Vec3): Vec3;
        init_from_float(src: number[]): Vec3;
        get_x(): number;
        get_y(): number;
        get_z(): number;

        add(b: Vec3): Vec3;
        subtract(b: Vec3): Vec3;
        multiply(b: Vec3): Vec3;
        divide(b: Vec3): Vec3;
        scale(factor: number): Vec3;
        negate(): Vec3;
        dot(b: Vec3): number;
        cross(b: Vec3): Vec3;
        length(): number;
        normalize(): Vec3;
        equal(b: Vec3): boolean;
        near(b: Vec3, epsilon: number): boolean;
        interpolate(b: Vec3, factor: number): Vec3;

        free(): void;
    }

    // --- Vec4 ---
    interface Vec4 {
        readonly x: number;
        readonly y: number;
        readonly z: number;
        readonly w: number;

        init(x?: number, y?: number, z?: number, w?: number): Vec4;
        init_from_vec4(src: Vec4): Vec4;
        init_from_float(src: number[]): Vec4;
        init_from_vec3(src: Vec3, w: number): Vec4;
        get_x(): number;
        get_y(): number;
        get_z(): number;
        get_w(): number;
        get_xyz(): Vec3;

        add(b: Vec4): Vec4;
        subtract(b: Vec4): Vec4;
        multiply(b: Vec4): Vec4;
        divide(b: Vec4): Vec4;
        scale(factor: number): Vec4;
        dot(b: Vec4): number;
        negate(): Vec4;
        equal(b: Vec4): boolean;
        near(b: Vec4, epsilon: number): boolean;
        interpolate(b: Vec4, factor: number): Vec4;

        free(): void;
    }

    // --- Euler ---
    enum EulerOrder {
        DEFAULT,
        XYZ,
        YXZ,
        ZXY,
        ZYX,
        YZX,
        XZY,
    }

    interface Euler {
        readonly x: number;
        readonly y: number;
        readonly z: number;

        init(x?: number, y?: number, z?: number): Euler;
        init_from_euler(src: Euler): Euler;
        init_from_matrix(m: Matrix): Euler;
        init_from_vec3(v: Vec3, order: EulerOrder): Euler;
        get_alpha(): number;
        get_beta(): number;
        get_gamma(): number;
        get_order(): EulerOrder;
        reorder(order: EulerOrder): Euler;
        equal(b: Euler): boolean;
        free(): void;
    }

    // --- Box (axis-aligned bounding box) ---
    interface Box {
        init(min?: Point3D, max?: Point3D): Box;
        init_from_points(points: Point3D[]): Box;
        init_from_vec3(min: Vec3, max: Vec3): Box;
        init_from_box(src: Box): Box;
        get_min(): Point3D;
        get_max(): Point3D;
        get_vertices(): Point3D[];
        get_center(): Point3D;
        get_size(): Vec3;
        contains_point(point: Point3D): boolean;
        contains_box(box: Box): boolean;
        equal(b: Box): boolean;
        expand(point: Point3D): void;
        expand_vec3(vec: Vec3): void;
        union(b: Box): Box;
        intersection(b: Box): [boolean, Box];
        free(): void;
    }

    // --- Quad (four-vertex quadrilateral) ---
    interface Quad {
        init(p1?: Point, p2?: Point, p3?: Point, p4?: Point): Quad;
        init_from_rect(r: Rect): Quad;
        init_from_points(points: [Point, Point, Point, Point]): Quad;
        get_point(index: number): Point;
        get_vertices(): [Point, Point, Point, Point];
        contains_point(p: Point): boolean;
        equal(b: Quad): boolean;
        free(): void;
    }

    // --- Class constructors and static methods ---
    class Rect {
        static name: string;
        constructor();
        static alloc(): Rect;
        static init(x: number, y: number, width: number, height: number): Rect;
        static zero(): Rect;
    }

    class Vec2 {
        static name: string;
        constructor();
        static alloc(): Vec2;
        static init(x: number, y: number): Vec2;
        static zero(): Vec2;
        static one(): Vec2;
    }

    class Point {
        static name: string;
        constructor();
        static alloc(): Point;
        static init(x: number, y: number): Point;
        static zero(): Point;
    }

    class Point3D {
        static name: string;
        constructor();
        static alloc(): Point3D;
        static init(x: number, y: number, z: number): Point3D;
        static zero(): Point3D;
    }

    class Size {
        static name: string;
        constructor();
        static alloc(): Size;
        static init(width: number, height: number): Size;
        static zero(): Size;
    }

    class Matrix {
        static name: string;
        constructor();
        static alloc(): Matrix;
        static identity(): Matrix;
    }

    class Vec3 {
        static name: string;
        constructor();
        static alloc(): Vec3;
        static init(x: number, y: number, z: number): Vec3;
        static zero(): Vec3;
        static one(): Vec3;
        static x_axis(): Vec3;
        static y_axis(): Vec3;
        static z_axis(): Vec3;
    }

    class Vec4 {
        static name: string;
        constructor();
        static alloc(): Vec4;
        static init(x: number, y: number, z: number, w: number): Vec4;
        static zero(): Vec4;
        static one(): Vec4;
    }

    class Euler {
        static name: string;
        constructor();
        static alloc(): Euler;
        static init(x: number, y: number, z: number): Euler;
    }

    class Box {
        static name: string;
        constructor();
        static alloc(): Box;
        static init(min: Point3D | null, max: Point3D | null): Box;
        static infinite(): Box;
        static empty(): Box;
    }

    class Quad {
        static name: string;
        constructor();
        static alloc(): Quad;
        static init(p1: Point | null, p2: Point | null, p3: Point | null, p4: Point | null): Quad;
    }

}
