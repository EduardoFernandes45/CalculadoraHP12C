// Motor RPN e TVM básico
const displayEl = document.getElementById("display");
const modeEl = document.getElementById("mode");

let stack = [0, 0, 0, 0]; // x, y, z, t
let entry = "0";
let entering = false;
let memory = 0;
let fMode = false; // modo 'f' para calcular TVM

const tvm = { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 };

function push(v) {
  stack[3] = stack[2];
  stack[2] = stack[1];
  stack[1] = stack[0];
  stack[0] = v;
}

function popToX() {
  const v = stack[0];
  stack[0] = stack[1];
  stack[1] = stack[2];
  stack[2] = stack[3];
  stack[3] = 0;
  return v;
}

function updateDisplay() {
  displayEl.textContent = entering ? entry : String(stack[0]);
}

function setX(v) {
  stack[0] = v;
  entering = false;
  entry = "0";
  updateDisplay();
}

function enter() {
  const v = Number(entry);
  push(v);
  entering = false;
  entry = "0";
  updateDisplay();
}

function inputDigit(d) {
  if (!entering) {
    entry = d === "." ? "0." : d;
    entering = true;
  } else {
    if (!(d === "." && entry.includes(".")))
      entry = entry === "0" && d !== "" ? d : entry + d;
  }
  updateDisplay();
}

function chs() {
  if (entering) {
    entry = String(-Number(entry));
  } else {
    stack[0] = -stack[0];
  }
  updateDisplay();
}

function doBinary(op) {
  if (entering) enter();
  const x = popToX();
  const y = popToX();
  const res = op(y, x);
  push(res);
  updateDisplay();
}

function doUnary(op) {
  if (entering) {
    const v = op(Number(entry));
    entry = String(v);
    updateDisplay();
    return;
  }
  stack[0] = op(stack[0]);
  updateDisplay();
}

// TVM solver helpers (reuse earlier formulas)
function computeFV(n, r, pv, pmt) {
  if (Math.abs(r) < 1e-12) return -(pv + pmt * n);
  const factor = Math.pow(1 + r, n);
  return -pv * factor - pmt * ((factor - 1) / r);
}
function computePV(n, r, pmt, fv) {
  if (Math.abs(r) < 1e-12) return -(fv + pmt * n);
  const factor = Math.pow(1 + r, n);
  return -(fv + pmt * ((factor - 1) / r)) / factor;
}
function computePMT(n, r, pv, fv) {
  if (Math.abs(r) < 1e-12) return -(fv + pv) / n;
  const factor = Math.pow(1 + r, n);
  return (-(pv * factor + fv) * r) / (factor - 1);
}
function solveForI(n, pv, pmt, fv) {
  let a = -0.999,
    b = 10,
    fa = computeFV(n, a, pv, pmt) - fv,
    fb = computeFV(n, b, pv, pmt) - fv;
  if (fa * fb > 0) return NaN;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    const fm = computeFV(n, m, pv, pmt) - fv;
    if (Math.abs(fm) < 1e-12) return m;
    if (fa * fm <= 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}
function solveForN(r, pv, pmt, fv) {
  let a = 1e-9,
    b = 1000,
    fa = computeFV(a, r, pv, pmt) - fv,
    fb = computeFV(b, r, pv, pmt) - fv;
  if (fa * fb > 0) return NaN;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    const fm = computeFV(m, r, pv, pmt) - fv;
    if (Math.abs(fm) < 1e-9) return m;
    if (fa * fm <= 0) {
      b = m;
      fb = fm;
    } else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

function handleTVM(key) {
  if (!fMode) {
    // armazenar no registrador TVM
    tvm[key] = entering ? Number(entry) : stack[0];
    entering = false;
    entry = "0";
    updateDisplay();
    return;
  }
  // fMode true -> resolver para a variável pressionada
  const n = tvm.n,
    i = tvm.i / 100,
    pv = tvm.pv,
    pmt = tvm.pmt,
    fv = tvm.fv;
  let sol = NaN;
  if (key === "n") sol = solveForN(i, pv, pmt, fv);
  if (key === "i") sol = solveForI(n, pv, pmt, fv);
  if (key === "pv") sol = computePV(n, i, pmt, fv);
  if (key === "pmt") sol = computePMT(n, i, pv, fv);
  if (key === "fv") sol = computeFV(n, i, pv, pmt);
  setX(sol);
}

document.querySelectorAll("button[data-fn]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.getAttribute("data-fn");
    switch (key) {
      case "f":
        fMode = !fMode;
        modeEl.textContent = fMode ? "f" : "RPN";
        return;
      case "g":
        /* placeholder for g */ return;
      case "enter":
        enter();
        return;
      case "dot":
        inputDigit(".");
        return;
      case "chs":
        chs();
        return;
      case "add":
        doBinary((a, b) => a + b);
        return;
      case "sub":
        doBinary((a, b) => a - b);
        return;
      case "mul":
        doBinary((a, b) => a * b);
        return;
      case "div":
        doBinary((a, b) => a / b);
        return;
      case "sqrt":
        doUnary(Math.sqrt);
        return;
      case "1overx":
        doUnary((x) => 1 / x);
        return;
      case "x2":
        doUnary((x) => x * x);
        return;
      case "pow":
        doBinary((a, b) => Math.pow(a, b));
        return; // y x -> y^x
      case "mplus":
        memory += entering ? Number(entry) : stack[0];
        entering = false;
        entry = "0";
        updateDisplay();
        return;
      case "mminus":
        memory -= entering ? Number(entry) : stack[0];
        entering = false;
        entry = "0";
        updateDisplay();
        return;
      case "mr":
        setX(memory);
        return;
      case "clear":
        entering = false;
        entry = "0";
        updateDisplay();
        return;
      case "allclear":
        stack = [0, 0, 0, 0];
        entering = false;
        entry = "0";
        updateDisplay();
        return;
      case "sto":
        /* placeholder: future: store to register */ return;
      case "rcl":
        /* placeholder: future: recall register */ return;
      case "n":
      case "i":
      case "pv":
      case "pmt":
      case "fv":
        handleTVM(key);
        return;
      default:
        // digits
        if (/^[0-9]$/.test(key)) inputDigit(key);
    }
  });
});

// inicializar
updateDisplay();
