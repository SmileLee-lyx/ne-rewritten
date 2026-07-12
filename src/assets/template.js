register_notation({
    id: 'omega1',
    name: 'Natural numbers',
    simple_name: 'ω', // optional
    // category_id: optional
    display: (a) => a === Infinity ? 'ω' : '' + a, // plain display

    is_limit: (a) => a === Infinity,
    compare: (a, b) => a > b ? 1 : a === b ? 0 : -1,
    FS: (a, i) => (a === Infinity ? i : a > 0 ? a - 1 : 0),
    init: () => [Infinity, 0], // list of initial expressions
});

register_category({
    id: 'category-user-defined',
    name: 'User defined',
    simple_name: 'User', // optional
});

register_notation({
    id: 'omega2',
    name: 'Natural numbers',
    // simple name omitted
    display: {
        plain: (a) => 'a^' + (a === Infinity ? 'ω' : a),
        html: (a) => 'a<sup>' + (a === Infinity ? 'ω' : a) + '</sup>',
        latex: (a) => 'a^{' + (a === Infinity ? '\\omega' : a) + '}',
        from_display: (str) => str === 'a^ω' ? Infinity : parseInt(str.substring(2))
        // 'from_display' should be inverse of 'plain'
    }, // complex display. all fields except 'plain' are optional.

    display_equiv: {
        // key 'b' is the name of equiv notation
        b: {
            plain: (a) => 'a^' + (a === Infinity ? 'ω' : a),
            html: (a) => 'a<sup>' + (a === Infinity ? 'ω' : a) + '</sup>',
            // no from_display; 'latex' is auto generated from 'html'
        }
    },

    is_limit: (a) => a === Infinity,
    compare: (a, b) => a > b ? 1 : a === b ? 0 : -1,
    FS: (a, i) => (a === Infinity ? i : a > 0 ? a - 1 : 0),
    init: () => [Infinity, 0],
});

function generate_notations(n) {
    return {
        id: 'omega-test-' + n,
        name: n + ' shifted natural numbers',
        simple_name: n + '+ω', // optional
        category_id: 'category-user-defined-generator',
        // this must be compatible with generator id
        display: (a) => a === Infinity ? 'ω' : '' + (a + n),

        is_limit: (a) => a === Infinity,
        compare: (a, b) => a > b ? 1 : a === b ? 0 : -1,
        FS: (a, i) => (a === Infinity ? i : a > 0 ? a - 1 : 0),
        init: () => [Infinity, 0],
    }
}

register_category({
    id: 'category-user-defined-generator',
    name: 'n+ω',
    parent_id: 'category-user-defined', // parent
    generator: { start: 1, initial: 3, create: generate_notations },
});