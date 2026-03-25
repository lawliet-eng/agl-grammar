/**
 * tree-sitter grammar for AGL (Agent Graph Language)
 *
 * Node types of interest for syntax highlighting:
 *   builtin_call       — print(), len(), push(), str(), readFile(), httpGet(), etc.
 *   call_expression    — user-defined function calls
 *   function_declaration — fn Name(...) { }
 *   let_statement      — let x = ...
 *   identifier         — variables, parameters, function names
 *   builtin_identifier — builtin function names (separate node for theming)
 */

const PREC = {
  CALL:       8,
  UNARY:      7,
  FACTOR:     6,  // * /
  TERM:       5,  // + -
  COMPARISON: 4,  // < > <= >=
  EQUALITY:   3,  // == !=
  ASSIGN:     1,
};

module.exports = grammar({
  name: 'agl',

  extras: $ => [
    /\s+/,
    $.line_comment,
  ],

  // Tells tree-sitter which rule defines "word" tokens so keywords are
  // not matched as identifiers.
  word: $ => $.identifier,

  rules: {

    // ── Top level ───────────────────────────────────────────────────────────

    source_file: $ => repeat($._statement),

    line_comment: $ => token(seq('//', /.*/)),

    // ── Statements ──────────────────────────────────────────────────────────

    _statement: $ => choice(
      $.let_statement,
      $.assign_statement,
      $.index_assign_statement,
      $.dot_assign_statement,
      $.inc_dec_statement,
      $.if_statement,
      $.while_statement,
      $.for_statement,
      $.try_catch_statement,
      $.throw_statement,
      $.function_declaration,
      $.return_statement,
      $.expression_statement,
    ),

    let_statement: $ => seq(
      'let',
      field('name', $.identifier),
      '=',
      field('value', $._expression),
    ),

    assign_statement: $ => prec.right(PREC.ASSIGN, seq(
      field('name', $.identifier),
      '=',
      field('value', $._expression),
    )),

    // arr[i] = value
    index_assign_statement: $ => seq(
      field('object', $._expression),
      '[',
      field('index', $._expression),
      ']',
      '=',
      field('value', $._expression),
    ),

    // map.key = value  or  map["key"] handled above
    dot_assign_statement: $ => seq(
      field('object', $._expression),
      '.',
      field('key', $.identifier),
      '=',
      field('value', $._expression),
    ),

    inc_dec_statement: $ => seq(
      field('name', $.identifier),
      field('operator', choice('++', '--')),
    ),

    expression_statement: $ => $._expression,

    // ── Control flow ────────────────────────────────────────────────────────

    if_statement: $ => seq(
      'if',
      field('condition', $._expression),
      field('consequence', $.block),
      optional(seq(
        'else',
        field('alternative', choice($.block, $.if_statement)),
      )),
    ),

    while_statement: $ => seq(
      'while',
      field('condition', $._expression),
      field('body', $.block),
    ),

    for_statement: $ => seq(
      'for',
      '(',
      field('init', optional($.for_init)),
      ';',
      field('condition', optional($._expression)),
      ';',
      field('post', optional($.for_post)),
      ')',
      field('body', $.block),
    ),

    // Inlined as named nodes so they appear in the CST for tooling.
    for_init: $ => choice(
      $.let_statement,
      $.assign_statement,
      $.inc_dec_statement,
    ),

    for_post: $ => choice(
      $.assign_statement,
      $.inc_dec_statement,
    ),

    try_catch_statement: $ => seq(
      'try',
      field('body', $.block),
      'catch',
      field('error_variable', $.identifier),
      field('handler', $.block),
    ),

    throw_statement: $ => prec.right(seq(
      'throw',
      field('value', $._expression),
    )),

    // ── Functions ───────────────────────────────────────────────────────────

    function_declaration: $ => seq(
      'fn',
      field('name', $.identifier),
      '(',
      field('parameters', optional($.parameter_list)),
      ')',
      field('body', $.block),
    ),

    parameter_list: $ => seq(
      $.identifier,
      repeat(seq(',', $.identifier)),
    ),

    return_statement: $ => prec.right(seq(
      'return',
      optional(field('value', $._expression)),
    )),

    block: $ => seq(
      '{',
      repeat($._statement),
      '}',
    ),

    // ── Expressions ─────────────────────────────────────────────────────────

    _expression: $ => choice(
      $.binary_expression,
      $.unary_expression,
      $.builtin_call,       // ← higher prec than call_expression
      $.call_expression,
      $.index_expression,
      $.dot_expression,
      $._primary,
    ),

    binary_expression: $ => choice(
      prec.left(PREC.EQUALITY,   seq(field('left', $._expression), field('operator', choice('==', '!=')),        field('right', $._expression))),
      prec.left(PREC.COMPARISON, seq(field('left', $._expression), field('operator', choice('<', '>', '<=', '>=')), field('right', $._expression))),
      prec.left(PREC.TERM,       seq(field('left', $._expression), field('operator', choice('+', '-')),           field('right', $._expression))),
      prec.left(PREC.FACTOR,     seq(field('left', $._expression), field('operator', choice('*', '/')),           field('right', $._expression))),
    ),

    unary_expression: $ => prec(PREC.UNARY, seq(
      field('operator', choice('+', '-')),
      field('operand', $._expression),
    )),

    // ── Call expressions ────────────────────────────────────────────────────

    // builtin_call is a *separate node type* from call_expression.
    // Themes/queries can style it independently with:
    //   (builtin_call) @function.builtin
    // or by targeting the child:
    //   (builtin_call name: (builtin_identifier) @function.builtin)
    builtin_call: $ => prec(PREC.CALL + 1, seq(
      field('name', $.builtin_identifier),
      '(',
      field('arguments', optional($.argument_list)),
      ')',
    )),

    // Current built-ins + planned I/O built-ins (section 12.5 of CLAUDE.md).
    // Adding a new builtin here is sufficient for the highlighter to pick it up.
    builtin_identifier: $ => choice(
      // Core
      'print', 'len', 'push', 'str',
      // Filesystem
      'readFile', 'writeFile',
      // Network
      'httpGet', 'httpPost',
      // System
      'exec', 'env',
      // Time
      'now', 'sleep',
    ),

    call_expression: $ => prec.left(PREC.CALL, seq(
      field('function', $._expression),
      '(',
      field('arguments', optional($.argument_list)),
      ')',
    )),

    index_expression: $ => prec.left(PREC.CALL, seq(
      field('object', $._expression),
      '[',
      field('index', $._expression),
      ']',
    )),

    dot_expression: $ => prec.left(PREC.CALL, seq(
      field('object', $._expression),
      '.',
      field('key', $.identifier),
    )),

    argument_list: $ => seq(
      $._expression,
      repeat(seq(',', $._expression)),
    ),

    // ── Primary ─────────────────────────────────────────────────────────────

    _primary: $ => choice(
      $.identifier,
      $.string_literal,
      $.number_literal,
      $.boolean_literal,
      $.nil_literal,
      $.array_literal,
      $.map_literal,
      $.parenthesized_expression,
    ),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    string_literal: $ => seq(
      '"',
      repeat(choice(
        token.immediate(/[^"\\]+/),
        token.immediate(seq('\\', /./)),
      )),
      '"',
    ),

    number_literal: $ => /[0-9]+(\.[0-9]+)?/,

    boolean_literal: $ => choice('true', 'false'),

    nil_literal: $ => 'nil',

    array_literal: $ => seq(
      '[',
      optional(seq(
        $._expression,
        repeat(seq(',', $._expression)),
        optional(','),
      )),
      ']',
    ),

    map_literal: $ => seq(
      '{',
      optional(seq(
        $.map_entry,
        repeat(seq(',', $.map_entry)),
        optional(','),
      )),
      '}',
    ),

    // Map keys are strings or bare identifiers: {"name": x}  or  {name: x}
    map_entry: $ => seq(
      field('key', choice($.string_literal, $.identifier)),
      ':',
      field('value', $._expression),
    ),

    parenthesized_expression: $ => seq(
      '(',
      $._expression,
      ')',
    ),
  },
});
