// DAX Formatter and Tokenizer Utility
// Implements SQLBI-style DAX formatting rules and robust tokenization for syntax highlighting.

export interface DaxToken {
  type:
    | "keyword"
    | "function"
    | "measure"
    | "table"
    | "column"
    | "operator"
    | "number"
    | "string"
    | "comment"
    | "punct"
    | "text";
  value: string;
}

export const DAX_FUNCTIONS = new Set([
  // Aggregation
  "SUM", "SUMX", "AVERAGE", "AVERAGEX", "COUNT", "COUNTA", "COUNTROWS", "COUNTBLANK",
  "COUNTX", "DISTINCTCOUNT", "DISTINCTCOUNTNOBLANK", "MIN", "MINX", "MAX", "MAXX",
  "PRODUCT", "PRODUCTX", "MEDIAN", "MEDIANX", "PERCENTILE.EXC", "PERCENTILE.INC",
  "STDEV.P", "STDEV.S", "VAR.P", "VAR.S",

  // Filter & Context Transition
  "CALCULATE", "CALCULATETABLE", "FILTER", "ALL", "ALLEXCEPT", "ALLSELECTED",
  "ALLNOBLANKROW", "KEEPFILTERS", "REMOVEFILTERS", "LOOKUPVALUE", "USERELATIONSHIP",
  "CROSSFILTER", "TREATAS", "EARLIER", "EARLIEST",

  // Table Manipulation
  "SUMMARIZE", "SUMMARIZECOLUMNS", "ADDCOLUMNS", "SELECTCOLUMNS", "VALUES", "DISTINCT",
  "ROW", "TOPN", "GENERATE", "GENERATESERIES", "DATATABLE", "UNION", "INTERSECT",
  "EXCEPT", "NATURALINNERJOIN", "NATURALLEFTOUTERJOIN", "CROSSJOIN",

  // Logical & Conditional
  "IF", "IFERROR", "SWITCH", "TRUE", "FALSE", "AND", "OR", "NOT", "ISBLANK",
  "COALESCE", "BLANK",

  // Information & Inspection
  "ISINSCOPE", "ISFILTERED", "ISCROSSFILTERED", "HASONEVALUE", "HASONEFILTER",
  "SELECTEDVALUE", "ISNUMBER", "ISTEXT", "ISNONTEXT",

  // Mathematical & Division
  "DIVIDE", "ROUND", "ROUNDUP", "ROUNDDOWN", "INT", "ABS", "SQRT", "POWER", "EXP",
  "LN", "LOG", "LOG10", "MOD", "RAND", "RANDBETWEEN", "SIGN",

  // Time Intelligence & Date
  "DATEADD", "DATESYTD", "DATESMTD", "DATESQTD", "TOTALYTD", "TOTALMTD", "TOTALQTD",
  "SAMEPERIODLASTYEAR", "PARALLELPERIOD", "PREVIOUSDAY", "PREVIOUSMONTH", "PREVIOUSQUARTER",
  "PREVIOUSYEAR", "NEXTDAY", "NEXTMONTH", "NEXTQUARTER", "NEXTYEAR", "DATESBETWEEN",
  "DATESINPERIOD", "DATE", "YEAR", "MONTH", "DAY", "TODAY", "NOW", "DATEDIFF",
  "CALENDAR", "CALENDARAUTO", "EDATE", "EOMONTH", "WEEKDAY", "WEEKNUM",

  // Text & String
  "CONCATENATE", "CONCATENATEX", "EXACT", "FIND", "SEARCH", "FORMAT", "LEFT", "RIGHT",
  "MID", "LEN", "LOWER", "UPPER", "TRIM", "REPLACE", "SUBSTITUTE", "REPT", "COMBINEVALUES",

  // Relationship & Parent-Child
  "RELATED", "RELATEDTABLE", "PATH", "PATHCONTAINS", "PATHITEM", "PATHLENGTH",

  // Syntax Keywords
  "VAR", "RETURN", "DEFINE", "MEASURE", "EVALUATE", "ORDER", "BY", "ASC", "DESC"
]);

/**
 * Tokenizes a DAX string into typed tokens for syntax highlighting
 */
export function tokenizeDax(code: string): DaxToken[] {
  if (!code) return [];
  const tokens: DaxToken[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // Single-line comment: // or --
    if (code.slice(i, i + 2) === "//" || code.slice(i, i + 2) === "--") {
      const end = code.indexOf("\n", i);
      const val = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ type: "comment", value: val });
      i += val.length;
      continue;
    }

    // Multi-line comment: /* ... */
    if (code.slice(i, i + 2) === "/*") {
      const end = code.indexOf("*/", i + 2);
      const val = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push({ type: "comment", value: val });
      i += val.length;
      continue;
    }

    // String literal: "..."
    if (code[i] === '"') {
      let j = i + 1;
      while (j < len) {
        if (code[j] === '"') {
          if (j + 1 < len && code[j + 1] === '"') {
            j += 2; // escaped quote
          } else {
            j++;
            break;
          }
        } else {
          j++;
        }
      }
      tokens.push({ type: "string", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Quoted Table: 'Table'[Column] or 'Table'
    if (code[i] === "'") {
      let j = i + 1;
      while (j < len && code[j] !== "'") j++;
      if (j < len) j++; // include closing quote
      const tablePart = code.slice(i, j);
      tokens.push({ type: "table", value: tablePart });
      i = j;

      // Check if immediately followed by [Column]
      if (i < len && code[i] === "[") {
        let k = i + 1;
        while (k < len && code[k] !== "]") k++;
        if (k < len) k++;
        tokens.push({ type: "column", value: code.slice(i, k) });
        i = k;
      }
      continue;
    }

    // Bracketed reference: [Measure] or [Column]
    if (code[i] === "[") {
      let j = i + 1;
      while (j < len && code[j] !== "]") j++;
      if (j < len) j++;
      const val = code.slice(i, j);

      // Check if preceded by an unquoted table identifier (e.g. fact_patient_visit[en])
      const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      if (prev && prev.type === "text" && /^[a-zA-Z_0-9]+$/.test(prev.value.trim())) {
        prev.type = "table";
        tokens.push({ type: "column", value: val });
      } else {
        // Standalone bracket identifier is a Measure!
        tokens.push({ type: "measure", value: val });
      }
      i = j;
      continue;
    }

    // Operators
    const multiOps = ["<=", ">=", "<>", "&&", "||", "==", "+", "-", "*", "/", "^", "=", "<", ">"];
    const matchedOp = multiOps.find((op) => code.startsWith(op, i));
    if (matchedOp) {
      tokens.push({ type: "operator", value: matchedOp });
      i += matchedOp.length;
      continue;
    }

    // Punctuation
    if ("(),;".includes(code[i])) {
      tokens.push({ type: "punct", value: code[i] });
      i++;
      continue;
    }

    // Whitespace
    if (/\s/.test(code[i])) {
      let j = i + 1;
      while (j < len && /\s/.test(code[j])) j++;
      tokens.push({ type: "text", value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Word (identifier, keyword, or number)
    let j = i;
    while (j < len && /[a-zA-Z0-9_\.]/.test(code[j])) j++;
    if (j > i) {
      const val = code.slice(i, j);
      if (/^\d+(\.\d+)?$/.test(val)) {
        tokens.push({ type: "number", value: val });
      } else if (DAX_FUNCTIONS.has(val.toUpperCase())) {
        tokens.push({
          type: ["VAR", "RETURN", "DEFINE", "EVALUATE"].includes(val.toUpperCase())
            ? "keyword"
            : "function",
          value: val.toUpperCase(),
        });
      } else {
        tokens.push({ type: "text", value: val });
      }
      i = j;
      continue;
    }

    // Single character fallback
    tokens.push({ type: "text", value: code[i] });
    i++;
  }

  return tokens;
}

/**
 * Formats raw DAX code with proper indentation, line breaks, and whitespace alignment
 * following professional SQLBI / Tabular programming conventions.
 */
export function formatDax(raw: string, options: { indentSpaces?: number } = {}): string {
  if (!raw || !raw.trim()) return "";
  const INDENT_CHAR = " ".repeat(options.indentSpaces || 4);

  // Normalize newlines
  const code = raw.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Multi-line block functions that warrant newline + indentation for their arguments
  const BLOCK_FUNCTIONS = new Set([
    "CALCULATE",
    "CALCULATETABLE",
    "FILTER",
    "SUMMARIZE",
    "SUMMARIZECOLUMNS",
    "ADDCOLUMNS",
    "SELECTCOLUMNS",
    "SWITCH",
    "IF",
    "AVERAGEX",
    "SUMX",
    "COUNTX",
    "MAXX",
    "MINX",
    "GENERATE",
    "TOPN",
    "INTERSECT",
    "EXCEPT",
    "UNION",
    "KEEPFILTERS",
    "USERELATIONSHIP",
  ]);

  const tokens = tokenizeDax(code);
  let formatted = "";
  let indentLevel = 0;
  let inLineStart = true;

  const appendIndent = (lvl: number) => INDENT_CHAR.repeat(Math.max(0, lvl));

  interface StackEntry {
    isFunction: boolean;
    functionName: string;
    multiLine: boolean;
    indentAtOpen: number;
  }
  const stack: StackEntry[] = [];

  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    const prev = k > 0 ? tokens[k - 1] : null;

    // Discard raw whitespace since we manage indentation programmatically
    if (t.type === "text" && /^\s+$/.test(t.value)) {
      continue;
    }

    // Handle comments
    if (t.type === "comment") {
      if (!inLineStart && !formatted.endsWith("\n")) {
        formatted += " ";
      }
      formatted += t.value.trim() + "\n" + appendIndent(indentLevel);
      inLineStart = true;
      continue;
    }

    // Handle VAR statement
    if (t.type === "keyword" && t.value === "VAR") {
      if (formatted.length > 0 && !formatted.endsWith("\n\n") && !formatted.endsWith("\n")) {
        formatted += "\n\n";
      }
      formatted += appendIndent(indentLevel) + "VAR ";
      inLineStart = false;
      continue;
    }

    // Handle RETURN statement
    if (t.type === "keyword" && t.value === "RETURN") {
      if (!formatted.endsWith("\n\n")) {
        formatted = formatted.trimEnd() + "\n\n";
      }
      formatted += appendIndent(indentLevel) + "RETURN\n" + appendIndent(indentLevel + 1);
      inLineStart = false;
      continue;
    }

    // Open Parenthesis
    if (t.type === "punct" && t.value === "(") {
      const isFunc = prev?.type === "function" || prev?.type === "keyword";
      const funcName = isFunc ? prev.value.toUpperCase() : "";

      // Determine if this parenthesis group contains multiple arguments or nested functions
      let depth = 1;
      let hasCommaOrNested = false;
      for (let scan = k + 1; scan < tokens.length; scan++) {
        if (tokens[scan].type === "punct" && tokens[scan].value === "(") depth++;
        else if (tokens[scan].type === "punct" && tokens[scan].value === ")") {
          depth--;
          if (depth === 0) break;
        } else if (tokens[scan].type === "punct" && tokens[scan].value === "," && depth === 1) {
          hasCommaOrNested = true;
          break;
        } else if (
          tokens[scan].type === "function" &&
          BLOCK_FUNCTIONS.has(tokens[scan].value.toUpperCase())
        ) {
          hasCommaOrNested = true;
        }
      }

      const shouldBreak = isFunc && (BLOCK_FUNCTIONS.has(funcName) || hasCommaOrNested);

      stack.push({
        isFunction: isFunc,
        functionName: funcName,
        multiLine: shouldBreak,
        indentAtOpen: indentLevel,
      });

      formatted += "(";
      if (shouldBreak) {
        indentLevel++;
        formatted += "\n" + appendIndent(indentLevel);
        inLineStart = true;
      } else {
        formatted += " ";
      }
      continue;
    }

    // Close Parenthesis
    if (t.type === "punct" && t.value === ")") {
      const top = stack.pop();
      if (top && top.multiLine) {
        indentLevel = top.indentAtOpen;
        formatted = formatted.trimEnd() + "\n" + appendIndent(indentLevel) + ")";
      } else {
        formatted = formatted.trimEnd() + " )";
      }
      inLineStart = false;
      continue;
    }

    // Comma separator between arguments
    if (t.type === "punct" && t.value === ",") {
      const curr = stack.length > 0 ? stack[stack.length - 1] : null;
      if (curr && curr.multiLine) {
        formatted = formatted.trimEnd() + ",\n" + appendIndent(indentLevel);
        inLineStart = true;
      } else {
        formatted += ", ";
        inLineStart = false;
      }
      continue;
    }

    // Operators (+, -, *, /, =, <, >, etc.)
    if (t.type === "operator") {
      // Keep operators nicely spaced
      formatted = formatted.trimEnd() + ` ${t.value} `;
      inLineStart = false;
      continue;
    }

    // Table followed immediately by Column: e.g. 'Table'[Col] or Table[Col]
    if (t.type === "column" && prev?.type === "table") {
      formatted = formatted.trimEnd() + t.value;
      inLineStart = false;
      continue;
    }

    // Standard spacing before identifier / number / token
    if (
      !inLineStart &&
      !formatted.endsWith(" ") &&
      !formatted.endsWith("(") &&
      !formatted.endsWith("\n")
    ) {
      formatted += " ";
    }

    formatted += t.value;
    inLineStart = false;
  }

  return formatted.trim();
}
