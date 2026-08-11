/**
 * Evaluador de fórmulas aritméticas **puro y seguro** (sin `eval`). Soporta
 * `+ - * /`, paréntesis, negación unaria, números y referencias a campos por su
 * nombre. Compartido por la validación (parsear al crear el campo), la
 * proyección (extraer dependencias) y la hidratación (calcular el valor).
 *
 * Gramática:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := NUMBER | IDENT | '(' expr ')' | '-' factor
 */

const TOKEN_RE = /\s*([0-9]*\.?[0-9]+|[a-zA-Z_][a-zA-Z0-9_]*|[()+\-*/])/y;

function tokenize(src) {
  const tokens = [];
  TOKEN_RE.lastIndex = 0;
  let lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(src))) {
    tokens.push(m[1]);
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (src.slice(lastIndex).trim() !== '') {
    throw new Error(`Carácter no válido en la fórmula cerca de "${src.slice(lastIndex).trim()}"`);
  }
  return tokens;
}

const isNumber = (t) => /^[0-9]*\.?[0-9]+$/.test(t);
const isIdent = (t) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t);

/** Parsea la fórmula a un AST. Lanza Error con mensaje claro si es inválida. */
export function parseFormula(src) {
  const tokens = tokenize(String(src ?? ''));
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let node = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      node = { t: 'op', op, l: node, r: parseTerm() };
    }
    return node;
  }
  function parseTerm() {
    let node = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      node = { t: 'op', op, l: node, r: parseFactor() };
    }
    return node;
  }
  function parseFactor() {
    const tok = peek();
    if (tok === undefined) throw new Error('Fórmula incompleta');
    if (tok === '-') {
      next();
      return { t: 'neg', e: parseFactor() };
    }
    if (tok === '(') {
      next();
      const node = parseExpr();
      if (next() !== ')') throw new Error('Falta un paréntesis de cierre');
      return node;
    }
    if (isNumber(tok)) {
      next();
      return { t: 'num', v: Number(tok) };
    }
    if (isIdent(tok)) {
      next();
      return { t: 'ident', name: tok };
    }
    throw new Error(`Token inesperado en la fórmula: "${tok}"`);
  }

  if (tokens.length === 0) throw new Error('La fórmula está vacía');
  const ast = parseExpr();
  if (pos < tokens.length) throw new Error(`Sobra "${tokens.slice(pos).join(' ')}" en la fórmula`);
  return ast;
}

/** Nombres de campo referenciados en la fórmula (únicos). */
export function formulaDependencies(src) {
  const deps = new Set();
  const walk = (n) => {
    if (!n) return;
    if (n.t === 'ident') deps.add(n.name);
    else if (n.t === 'neg') walk(n.e);
    else if (n.t === 'op') {
      walk(n.l);
      walk(n.r);
    }
  };
  walk(parseFormula(src));
  return [...deps];
}

/**
 * Evalúa la fórmula con un `scope` (nombre de campo → número). Los campos
 * ausentes o no numéricos cuentan como 0. La división por cero devuelve null
 * (valor indefinido), que se propaga hacia arriba.
 * @param {string} src
 * @param {Record<string, number>} scope
 * @returns {number|null}
 */
export function evaluateFormula(src, scope = {}) {
  const evalNode = (n) => {
    if (n.t === 'num') return n.v;
    if (n.t === 'ident') {
      const v = Number(scope[n.name]);
      return Number.isFinite(v) ? v : 0;
    }
    if (n.t === 'neg') {
      const e = evalNode(n.e);
      return e == null ? null : -e;
    }
    const l = evalNode(n.l);
    const r = evalNode(n.r);
    if (l == null || r == null) return null;
    switch (n.op) {
      case '+':
        return l + r;
      case '-':
        return l - r;
      case '*':
        return l * r;
      case '/':
        return r === 0 ? null : l / r;
      default:
        return null;
    }
  };
  const result = evalNode(parseFormula(src));
  return result == null || !Number.isFinite(result) ? null : result;
}
