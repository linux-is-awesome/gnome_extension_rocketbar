declare module 'gi://Mtk' {

    enum RoundingStrategy {
        SHRINK,
        GROW,
        ROUND,
    }
    function rectangle_from_graphene_rect(rect: Graphene.Rect, rounding_strategy: RoundingStrategy): /* dest */ Rectangle
    function x11_errors_deinit(): void
    interface Rectangle {

        // Own fields of Mtk-13.Mtk.Rectangle

        /**
         * X coordinate of the top-left corner
         * @field 
         */
        x: number
        /**
         * Y coordinate of the top-left corner
         * @field 
         */
        y: number
        /**
         * Width of the rectangle
         * @field 
         */
        width: number
        /**
         * Height of the rectangle
         * @field 
         */
        height: number

        // Owm methods of Mtk-13.Mtk.Rectangle

        area(): number
        contains_rect(inner_rect: Rectangle): boolean
        copy(): Rectangle
        could_fit_rect(inner_rect: Rectangle): boolean
        /**
         * Compares the two rectangles
         * @param src2 The second rectangle
         * @returns Whether the two rectangles are equal
         */
        equal(src2: Rectangle): boolean
        free(): void
        /**
         * Similar to [method`Rectangle`.overlap] but ignores the vertical location.
         * @param rect2 The second rectangle
         * @returns Whether the two rectangles overlap horizontally
         */
        horiz_overlap(rect2: Rectangle): boolean
        /**
         * Find the intersection between the two rectangles
         * @param src2 another #MtkRectangle
         * @returns TRUE is some intersection exists and is not degenerate, FALSE   otherwise.
         */
        intersect(src2: Rectangle): [ /* returnType */ boolean, /* dest */ Rectangle]
        /**
         * Similar to [method`Rectangle`.intersect] but doesn't provide
         * the location of the intersection.
         * @param rect2 The second rectangle
         * @returns Whether the two rectangles overlap
         */
        overlap(rect2: Rectangle): boolean
        to_graphene_rect(): Graphene.Rect
        /**
         * Computes the union of the two rectangles
         * @param rect2 another #MtkRectangle
         */
        union(rect2: Rectangle): /* dest */ Rectangle
        /**
         * Similar to [method`Rectangle`.overlap] but ignores the horizontal location.
         * @param rect2 The second rectangle
         * @returns Whether the two rectangles overlap vertically
         */
        vert_overlap(rect2: Rectangle): boolean
    }

    class Rectangle {

        // Own properties of Mtk-13.Mtk.Rectangle

        static name: string

        // Constructors of Mtk-13.Mtk.Rectangle

        /**
         * Creates a new rectangle
         * @constructor 
         * @param params.x X coordinate of the top left corner
         * @param params.y Y coordinate of the top left corner
         * @param params.width Width of the rectangle
         * @param params.height Height of the rectangle
         */
        constructor(params?: {x?: number, y?: number, width?: number, height?: number})
        /**
         * Creates a new rectangle
         * @constructor 
         * @param params.x X coordinate of the top left corner
         * @param params.y Y coordinate of the top left corner
         * @param params.width Width of the rectangle
         * @param params.height Height of the rectangle
         */
        static new(params?: { x?: number, y?: number, width?: number, height?: number }): Rectangle
        static from_graphene_rect(rect: Graphene.Rect, rounding_strategy: RoundingStrategy): /* dest */ Rectangle
    }

}
