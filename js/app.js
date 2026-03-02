import { Application } from "@hotwired/stimulus"
import FractionCalculatorController from "./fraction-calculator-controller.js"

const application = Application.start()
application.register("fraction-calculator", FractionCalculatorController)
