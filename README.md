# Kalku Finance

A browser-based educational prototype for exploring financial scenarios in Indonesian rupiah.

[Try the demo](https://athaillahbagas.github.io/kalkufinance/) · [Read the case study](https://athaillahbagas.github.io/portfolio/projects/kalku-finance.html)

![Kalku Finance calculator preview](preview.jpg)

## What it does

| Calculator | Question it helps explore | Model |
| --- | --- | --- |
| Investment return | How much did an investment gain after its entered costs? | Net profit divided by total entered investment cost |
| Loan repayment | What monthly payment follows from a fixed rate and term? | Equal monthly payments on a reducing balance |
| Retirement saving | What monthly contribution closes a future funding gap? | Current capital plus end-of-month contributions |
| Annual PPh 21 estimate | What is the simplified annual income tax for a constant salary? | Annual progressive tax after the represented deductions and PTKP |
| Compound interest | How do starting capital and regular contributions accumulate? | Monthly compounding and end-of-month contributions |

## Try it locally

Download this repository and open `index.html` in a modern browser. No installation, account, API key, or server is required. The previous `Kalku Finance.html` address redirects to the same calculator.

Calculations run in the browser. The app has no analytics, database, or network submission of the numbers you enter, and inputs are not saved between visits.

## Assumptions and limits

- Rates and payments stay constant over the modeled period. Loan, retirement, and compound-interest calculations use the entered nominal annual rate divided by 12.
- Values are nominal rupiah. Inflation, investment risk, changing returns, and product-specific fees or penalties are not modeled. Include relevant costs in the ROI cost field; other calculators do not add fees automatically.
- Savings contributions are made at the end of each month. Loan payments are monthly, with no residual balance or balloon payment.
- The tax model is restricted to a resident permanent employee, one employer, and 12 identical monthly pay periods. It excludes THR/bonuses, special incentives, combined spouse income, and deductions not represented by the inputs.
- The displayed monthly tax figure is the annual estimate divided by 12. It is **not** actual monthly TER payroll withholding.
- This is a learning and scenario-exploration tool, not a financial recommendation, tax filing service, or production payroll system. No user adoption or real-world financial impact has been measured.

The annual tax assumptions follow [UU 7/2021](https://www.pajak.go.id/en/node/74838) and [PMK 168/2023](https://stats.pajak.go.id/id/peraturan/petunjuk-pelaksanaan-pemotongan-pajak-atas-penghasilan-sehubungan-dengan-pekerjaan-jasa-1). Recheck applicable rules and personal circumstances before relying on a tax result.

## Verification

Run the dependency-free calculation checks with Node.js:

```sh
node test-calculations.cjs
```

The checks cover representative calculations, zero-interest cases, and invalid inputs. They verify the implemented models rather than the suitability of a financial decision.

## Project scope

Maintained by [Athaillah Bagas](https://github.com/athaillahbagas). The project connects an interest in finance with small, inspectable browser tools. The [case study](https://athaillahbagas.github.io/portfolio/projects/kalku-finance.html) explains the design choices, constraints, and opportunities for further work.
