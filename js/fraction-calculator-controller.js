import { Controller } from "@hotwired/stimulus"

const absBigInt = (value) => (value < 0n ? -value : value)

const gcd = (a, b) => {
  let x = absBigInt(a)
  let y = absBigInt(b)
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

const floorDiv = (a, b) => {
  if (a >= 0n) return a / b
  return -(((-a) + b - 1n) / b)
}

const ceilDiv = (a, b) => {
  if (a >= 0n) return (a + b - 1n) / b
  return -((-a) / b)
}

const roundNearest = (a, b) => {
  const sign = a < 0n ? -1n : 1n
  const absA = absBigInt(a)
  const q = absA / b
  const r = absA % b
  const bump = r * 2n >= b ? 1n : 0n
  return sign * (q + bump)
}

class Fraction {
  constructor(numerator, denominator = 1n) {
    if (denominator === 0n) throw new Error("Denominator cannot be zero")
    let n = numerator
    let d = denominator
    if (d < 0n) {
      n = -n
      d = -d
    }
    const divisor = gcd(n, d)
    this.n = n / divisor
    this.d = d / divisor
  }

  add(other) {
    return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d)
  }

  sub(other) {
    return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d)
  }

  mul(other) {
    return new Fraction(this.n * other.n, this.d * other.d)
  }

  div(other) {
    if (other.n === 0n) throw new Error("Division by zero")
    return new Fraction(this.n * other.d, this.d * other.n)
  }

  toFractionString() {
    if (this.d === 1n) return this.n.toString()
    return `${this.n.toString()}/${this.d.toString()}`
  }

  toMixedString() {
    if (this.n === 0n) return "0"
    const sign = this.n < 0n ? "-" : ""
    const absN = absBigInt(this.n)
    const whole = absN / this.d
    const rem = absN % this.d
    if (rem === 0n) return `${sign}${whole.toString()}`
    if (whole === 0n) return `${sign}${rem.toString()}/${this.d.toString()}`
    return `${sign}${whole.toString()} ${rem.toString()}/${this.d.toString()}`
  }

  toDecimalString(maxPlaces = 10) {
    if (this.n === 0n) return "0"
    const sign = this.n < 0n ? "-" : ""
    let absN = absBigInt(this.n)
    const integer = absN / this.d
    let remainder = absN % this.d
    if (remainder === 0n) return `${sign}${integer.toString()}`

    let digits = ""
    for (let i = 0; i < maxPlaces; i += 1) {
      remainder *= 10n
      const digit = remainder / this.d
      remainder = remainder % this.d
      digits += digit.toString()
      if (remainder === 0n) break
    }

    digits = digits.replace(/0+$/, "")
    if (digits.length === 0) return `${sign}${integer.toString()}`
    return `${sign}${integer.toString()}.${digits}`
  }
}

const parseDecimalString = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\s+/g, " ")
  const decimalMatch = normalized.match(/^(\d+(\.\d+)?|\.\d+)$/)
  if (!decimalMatch) throw new Error("Invalid number")

  const unsigned = normalized
  const parts = unsigned.split(".")
  const integerPart = parts[0] ? parts[0] : "0"
  const fractionalPart = parts[1] ? parts[1] : ""
  if (fractionalPart.length === 0) {
    return new Fraction(BigInt(integerPart), 1n)
  }

  const scale = 10n ** BigInt(fractionalPart.length)
  const numerator = BigInt(integerPart) * scale + BigInt(fractionalPart)
  return new Fraction(numerator, scale)
}

const roundFraction = (fraction, denominator, mode) => {
  const scaled = fraction.n * denominator
  let roundedInt
  if (mode === "floor") {
    roundedInt = floorDiv(scaled, fraction.d)
  } else if (mode === "ceil") {
    roundedInt = ceilDiv(scaled, fraction.d)
  } else {
    roundedInt = roundNearest(scaled, fraction.d)
  }
  return new Fraction(roundedInt, denominator)
}

export default class extends Controller {
  static targets = [
    "display",
    "copyBtn",
    "inputLabel",
    "lastOperation",
    "displayExact",
    "tagline",
    "roundDen",
    "roundMode",
    "exactFormat",
    "resultMixed",
    "resultExact",
    "resultDecimal",
    "error"
  ]

  connect() {
    this.resetState()
    this.updateDisplay()
    this.boundKeydown = this.onKeydown.bind(this)
    window.addEventListener("keydown", this.boundKeydown)
    this._shimmerTimer = window.setTimeout(() => this.triggerShimmer(), 500)
    this.setRandomTagline()
  }

  disconnect() {
    if (this.boundKeydown) {
      window.removeEventListener("keydown", this.boundKeydown)
    }
    window.clearTimeout(this._shimmerTimer)
  }

  clearAll() {
    this.resetState()
    this.updateDisplay()
  }

  pressDigit(event) {
    const cluster = event.currentTarget.dataset.fractionCalculatorClusterValue
    const value = event.currentTarget.dataset.fractionCalculatorValueValue
    this.applyDigit(cluster, value)
  }

  backspace(event) {
    const cluster = event.currentTarget.dataset.fractionCalculatorClusterValue
    this.applyBackspace(cluster)
  }

  setOperator(event) {
    const operator = event.currentTarget.dataset.fractionCalculatorOperatorValue
    if (!this.hasAnyValue(this.state.a)) {
      this.setError("Enter a value for A first.")
      return
    }
    this.state.operator = operator
    this.state.active = "b"
    this.state.inputCluster = "whole"
    this.clearError()
    this.updateDisplay()
  }

  calculate() {
    try {
      let operator = this.state.operator
      let a = this.buildFraction(this.state.a)
      let b

      if (!operator) {
        if (!this.state.lastOperation) {
          this.setError("Select an operation.")
          return
        }
        operator = this.state.lastOperation.operator
        b = this.cloneFraction(this.state.lastOperation.b)
      } else {
        if (!this.hasAnyValue(this.state.b)) {
          this.setError("Enter a value for B.")
          return
        }
        b = this.buildFraction(this.state.b)
      }

      const exact = this.applyOperatorWith(operator, a, b)
      const denom = BigInt(this.roundDenTarget.value)
      const mode = this.roundModeTarget.value
      const rounded = roundFraction(exact, denom, mode)

      this.resultMixedTarget.textContent = rounded.toMixedString()
      this.resultExactTarget.textContent = exact.toFractionString()
      this.resultDecimalTarget.textContent = exact.toDecimalString(10)
      if (this.hasDisplayExactTarget) {
        const useFraction = !this.hasExactFormatTarget || this.exactFormatTarget.value !== "decimal"
        this.displayExactTarget.textContent = useFraction
          ? exact.toMixedString()
          : exact.toDecimalString(10)
        this.displayExactTarget.classList.remove("d-none")
      }

      this.state = {
        active: "a",
        operator: null,
        a: this.fractionToParts(rounded),
        b: this.blankParts(),
        inputCluster: "whole",
        lastOperation: {
          operator,
          b: this.cloneFraction(b)
        }
      }

      this.displayTarget.textContent = rounded.toMixedString()
      if (this.hasLastOperationTarget) {
        const opSymbol = this.operatorSymbol(operator)
        this.lastOperationTarget.textContent = `${a.toMixedString()} ${opSymbol} ${b.toMixedString()} =`
        this.lastOperationTarget.classList.remove("d-none")
        if (this.hasInputLabelTarget) this.inputLabelTarget.classList.add("d-none")
      }
      this.clearError()
    } catch (error) {
      this.setError(error.message || "Invalid input")
      this.clearOutputs(false)
    }
  }

  resetState() {
    this.state = {
      active: "a",
      operator: null,
      a: this.blankParts(),
      b: this.blankParts(),
      inputCluster: "whole",
      hasInteracted: false,
      lastOperation: null
    }
    this.clearOutputs()
    if (this.hasLastOperationTarget) this.lastOperationTarget.textContent = ""
    if (this.hasLastOperationTarget) this.lastOperationTarget.classList.add("d-none")
    if (this.hasInputLabelTarget) this.inputLabelTarget.classList.remove("d-none")
    if (this.hasDisplayExactTarget) {
      this.displayExactTarget.textContent = ""
      this.displayExactTarget.classList.add("d-none")
    }
  }

  blankParts() {
    return { sign: 1, whole: "", numer: "", denom: "" }
  }

  currentOperand() {
    return this.state.active === "a" ? this.state.a : this.state.b
  }

  hasAnyValue(parts) {
    return parts.whole.length > 0 || parts.numer.length > 0 || parts.denom.length > 0
  }

  buildFraction(parts) {
    if (!this.hasAnyValue(parts)) return new Fraction(0n, 1n)

    const hasNumer = parts.numer.length > 0
    const hasDenom = parts.denom.length > 0
    if (hasNumer !== hasDenom) throw new Error("Enter both numerator and denominator")

    let total = new Fraction(0n, 1n)
    if (parts.whole.length > 0) {
      total = total.add(parseDecimalString(parts.whole))
    }
    if (hasNumer) {
      const denom = BigInt(parts.denom)
      if (denom === 0n) throw new Error("Denominator cannot be zero")
      total = total.add(new Fraction(BigInt(parts.numer), denom))
    }

    if (parts.sign < 0) {
      total = new Fraction(-total.n, total.d)
    }

    return total
  }

  applyOperator(a, b) {
    switch (this.state.operator) {
      case "add":
        return a.add(b)
      case "sub":
        return a.sub(b)
      case "mul":
        return a.mul(b)
      case "div":
        return a.div(b)
      default:
        return a.add(b)
    }
  }

  applyOperatorWith(operator, a, b) {
    switch (operator) {
      case "add":
        return a.add(b)
      case "sub":
        return a.sub(b)
      case "mul":
        return a.mul(b)
      case "div":
        return a.div(b)
      default:
        return a.add(b)
    }
  }

  cloneFraction(fraction) {
    return new Fraction(fraction.n, fraction.d)
  }

  copyResult() {
    const clone = this.displayTarget.cloneNode(true)
    clone.querySelectorAll(".display-cursor").forEach(el => el.remove())
    const text = clone.textContent.trim()
    if (!text || text === "--") return
    navigator.clipboard.writeText(text).then(() => {
      if (!this.hasCopyBtnTarget) return
      const btn = this.copyBtnTarget
      btn.querySelector("i").className = "bi bi-clipboard-check"
      window.setTimeout(() => {
        btn.querySelector("i").className = "bi bi-clipboard"
      }, 1500)
    })
  }

  triggerShimmer() {
    const container = this.displayTarget.closest(".mobile-display")
    if (!container) return
    container.classList.remove("is-shimmer")
    // Force reflow to restart animation
    void container.offsetWidth
    container.classList.add("is-shimmer")
    window.setTimeout(() => container.classList.remove("is-shimmer"), 3000)
  }

  fractionToParts(fraction) {
    if (fraction.n === 0n) return this.blankParts()
    const sign = fraction.n < 0n ? -1 : 1
    const absN = absBigInt(fraction.n)
    const whole = absN / fraction.d
    const rem = absN % fraction.d
    return {
      sign,
      whole: whole === 0n ? "" : whole.toString(),
      numer: rem === 0n ? "" : rem.toString(),
      denom: rem === 0n ? "" : fraction.d.toString()
    }
  }

  formatParts(parts) {
    if (!this.hasAnyValue(parts)) return "0"
    const sign = parts.sign < 0 ? "-" : ""
    const whole = parts.whole
    const numer = parts.numer
    const denom = parts.denom

    if (numer.length > 0 && denom.length === 0) {
      return `${sign}${whole || "0"} ${numer}/`
    }
    if (denom.length > 0 && numer.length === 0) {
      return `${sign}${whole || "0"} 0/${denom}`
    }
    if (numer.length > 0 && denom.length > 0) {
      if (whole.length > 0) return `${sign}${whole} ${numer}/${denom}`
      return `${sign}${numer}/${denom}`
    }
    return `${sign}${whole}`
  }

  updateDisplay() {
    const showCursor = this.state.hasInteracted
    const aText = this.state.active === "a" && showCursor
      ? this.formatPartsWithCursor(this.state.a, this.state.inputCluster)
      : this.formatParts(this.state.a)
    if (!this.state.operator) {
      this.displayTarget.innerHTML = this.renderDisplay(aText)
      return
    }
    const operatorSymbol = this.operatorSymbol(this.state.operator)
    const bText = this.state.active === "b" && showCursor
      ? this.formatPartsWithCursor(this.state.b, this.state.inputCluster)
      : (this.hasAnyValue(this.state.b) ? this.formatParts(this.state.b) : "_")
    this.displayTarget.innerHTML = this.renderDisplay(`${aText} ${operatorSymbol} ${bText}`)
  }

  formatPartsWithCursor(parts, cluster) {
    const cursor = "{CURSOR}"
    const sign = parts.sign < 0 ? "-" : ""
    const whole = parts.whole
    const numer = parts.numer
    const denom = parts.denom
    const hasFraction = numer.length > 0 || denom.length > 0

    if (cluster === "whole") {
      const wholeText = whole.length > 0 ? whole : ""
      const base = `${sign}${wholeText}${cursor}`
      if (!hasFraction) return base || cursor
      const frac = `${numer || "0"}/${denom || ""}`
      return `${base} ${frac}`
    }

    const wholePrefix = whole.length > 0 ? `${sign}${whole} ` : sign
    if (cluster === "numer") {
      const numerText = numer.length > 0 ? numer : ""
      const denomText = denom.length > 0 ? denom : ""
      return `${wholePrefix}${numerText}${cursor}/${denomText}`
    }

    if (cluster === "denom") {
      const numerText = numer.length > 0 ? numer : ""
      const denomText = denom.length > 0 ? denom : ""
      return `${wholePrefix}${numerText}/${denomText}${cursor}`
    }

    return this.formatParts(parts)
  }

  renderDisplay(text) {
    const escaped = this.escapeHtml(text)
    return escaped.replace(
      "{CURSOR}",
      "<span class=\"display-cursor\">_</span>"
    )
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }

  applyDigit(cluster, value) {
    this.state.inputCluster = cluster
    const operand = this.currentOperand()
    if (cluster === "whole") {
      if (value === "+/-") {
        operand.sign *= -1
        this.clearError()
        this.updateDisplay()
        return
      }
      if (value === "." && operand.whole.includes(".")) return
      operand.whole += value
    } else if (cluster === "numer") {
      operand.numer += value
    } else if (cluster === "denom") {
      operand.denom += value
    }

    this.state.hasInteracted = true
    this.clearError()
    this.updateDisplay()
  }

  applyBackspace(cluster) {
    this.state.inputCluster = cluster
    const operand = this.currentOperand()
    if (cluster === "whole") {
      operand.whole = operand.whole.slice(0, -1)
    } else if (cluster === "numer") {
      operand.numer = operand.numer.slice(0, -1)
    } else if (cluster === "denom") {
      operand.denom = operand.denom.slice(0, -1)
    }
    this.state.hasInteracted = true
    this.clearError()
    this.updateDisplay()
  }

  onKeydown(event) {
    const { key } = event
    if (key === "Tab" || key === " ") {
      event.preventDefault()
      this.cycleInputCluster(event.shiftKey)
      this.state.hasInteracted = true
      this.updateDisplay()
      return
    }

    if (key >= "0" && key <= "9") {
      this.applyDigit(this.state.inputCluster, key)
      return
    }

    if (key === ".") {
      this.applyDigit("whole", ".")
      this.state.inputCluster = "whole"
      return
    }

    if (key === "Backspace") {
      this.applyBackspace(this.state.inputCluster)
      return
    }

    if (key === "+") {
      this.setOperatorValue("add")
      return
    }
    if (key === "-") {
      this.setOperatorValue("sub")
      return
    }
    if (key === "*") {
      this.setOperatorValue("mul")
      return
    }
    if (key === "/") {
      if (this.state.inputCluster === "numer") {
        this.state.inputCluster = "denom"
        this.state.hasInteracted = true
        this.updateDisplay()
      } else {
        this.setOperatorValue("div")
      }
      return
    }

    if (key === "=" || key === "Enter" || key === "NumpadEnter") {
      this.state.hasInteracted = true
      this.calculate()
      return
    }

    if (key === "c" || key === "C") {
      this.clearAll()
    }
  }

  setOperatorValue(operator) {
    if (!this.hasAnyValue(this.state.a)) {
      this.setError("Enter a value for A first.")
      return
    }
    this.state.operator = operator
    this.state.active = "b"
    this.state.inputCluster = "whole"
    this.clearError()
    this.updateDisplay()
  }

  cycleInputCluster(reverse = false) {
    const order = ["whole", "numer", "denom"]
    const index = order.indexOf(this.state.inputCluster)
    const nextIndex = reverse
      ? (index - 1 + order.length) % order.length
      : (index + 1) % order.length
    this.state.inputCluster = order[nextIndex]
  }

  operatorSymbol(operator) {
    switch (operator) {
      case "add":
        return "+"
      case "sub":
        return "-"
      case "mul":
        return "×"
      case "div":
        return "÷"
      default:
        return "+"
    }
  }

  clearOutputs(clearError = true) {
    this.resultMixedTarget.textContent = "--"
    this.resultExactTarget.textContent = "--"
    this.resultDecimalTarget.textContent = "--"
    if (clearError) this.clearError()
  }

  setError(message) {
    this.errorTarget.textContent = message
    this.errorTarget.classList.remove("d-none")
  }

  clearError() {
    this.errorTarget.textContent = ""
    this.errorTarget.classList.add("d-none")
  }

  setRandomTagline() {
    if (!this.hasTaglineTarget) return
    const taglines = [
      "Snap to the nearest 1/16 like it’s 1998.",
      "Zero floats, zero regrets.",
      "Because 3/8 is a lifestyle, not a suggestion.",
      "Square, plumb, and rational.",
      "Precision for the impatient.",
      "Kerf happens.",
      "Right angles and right answers.",
      "No decimals were harmed in this calculation."
    ]
    const choice = taglines[Math.floor(Math.random() * taglines.length)]
    this.taglineTarget.textContent = choice
  }
}
