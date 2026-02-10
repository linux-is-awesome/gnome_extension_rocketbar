/**
 * Minimal type declarations for gi://Graphene (used by Mtk, Meta, Clutter, etc.).
 */
declare module 'gi://Graphene' {

    interface Rect {
        x: number;
        y: number;
        width: number;
        height: number;
        init(x?: number, y?: number, width?: number, height?: number): void;
        contains_point(point: Point): boolean;
        contains_rect(rect: Rect): boolean;
        equal(b: Rect): boolean;
        get_center(): Point;
        get_height(): number;
        get_width(): number;
        inset(r: number, t: number, b: number, l: number): void;
        intersect(b: Rect): boolean;
        normalize(): void;
        offset(dx: number, dy: number): void;
        union(b: Rect): void;
        free(): void;
    }

    interface Point {
        x: number;
        y: number;
        init(x?: number, y?: number): void;
        equal(b: Point): boolean;
        distance(b: Point): number;
        free(): void;
    }

    interface Point3D {
        x: number;
        y: number;
        z: number;
        init(x?: number, y?: number, z?: number): void;
        free(): void;
    }

    interface Size {
        width: number;
        height: number;
        init(width?: number, height?: number): void;
        free(): void;
    }

    interface Matrix {
        init_identity(): void;
        init_from_matrix(src: Matrix): void;
        multiply(b: Matrix): Matrix;
        free(): void;
    }

    interface Vec3 {
        x: number;
        y: number;
        z: number;
        init(x?: number, y?: number, z?: number): void;
        free(): void;
    }

    interface Vec4 {
        x: number;
        y: number;
        z: number;
        w: number;
        init(x?: number, y?: number, z?: number, w?: number): void;
        free(): void;
    }

    interface Euler {
        x: number;
        y: number;
        z: number;
        init(x?: number, y?: number, z?: number): void;
        free(): void;
    }

    class Rect {
        static name: string;
        constructor();
        static alloc(): Rect;
        static init(x: number, y: number, width: number, height: number): Rect;
    }

    class Point {
        static name: string;
        constructor();
        static alloc(): Point;
        static init(x: number, y: number): Point;
    }

    class Point3D {
        static name: string;
        constructor();
        static alloc(): Point3D;
    }

    class Size {
        static name: string;
        constructor();
        static alloc(): Size;
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
    }

    class Vec4 {
        static name: string;
        constructor();
        static alloc(): Vec4;
    }

    class Euler {
        static name: string;
        constructor();
        static alloc(): Euler;
    }

}
