'use strict';

// Run with: node test-calculations.cjs. No packages or network required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'calculator.js'), 'utf8'), context);
let passed = 0;
function test(name, run) {
    try { run(); passed++; console.log('PASS ' + name); }
    catch (error) { console.error('FAIL ' + name); throw error; }
}
function close(actual, expected, tolerance = 1e-8) {
    assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}
function throws(run) { assert.throws(run); }
function compoundByMonth(capital, deposit, annualRate, months) {
    let balance = capital;
    for (let month = 0; month < months; month++) balance = balance * (1 + annualRate / 100 / 12) + deposit;
    return balance;
}

test('ROI includes entered costs in the denominator', () => {
    close(context.calculateROI(10000000, 15000000, 0).roi, 50);
    const r = context.calculateROI(10000000, 15000000, 1000000);
    assert.equal(r.profit, 4000000);
    close(r.roi, 4000000 / 11000000 * 100);
    assert.equal(context.calculateROI(1000, 0, 0).roi, -100);
});
test('ROI rejects a zero denominator, negative values, nonfinite values, and unsafe totals', () => {
    throws(() => context.calculateROI(0, 100, 0));
    throws(() => context.calculateROI(-1, 100, 0));
    throws(() => context.calculateROI(NaN, 100, 0));
    throws(() => context.calculateROI(1, Infinity, 0));
    throws(() => context.calculateROI(Number.MAX_SAFE_INTEGER, 100, 1));
});
test('zero-rate loan divides principal evenly', () => {
    const r = context.calculateLoan(12000000, 0, 1);
    assert.equal(r.monthlyPayment, 1000000);
    assert.equal(r.totalPayment, 12000000);
    assert.equal(r.interest, 0);
});
test('loan payment independently amortizes a reducing balance to zero', () => {
    const r = context.calculateLoan(100000000, 12, 1);
    let balance = 100000000;
    for (let month = 0; month < 12; month++) balance = balance * 1.01 - r.monthlyPayment;
    close(balance, 0, 1e-6);
    close(r.monthlyPayment, 8884878.867834);
});
test('loan handles tiny rates and a six-month term', () => {
    close(context.calculateLoan(12000000, 1e-10, 1).monthlyPayment, 1000000);
    assert.equal(context.calculateLoan(6000000, 0, 0.5).months, 6);
});
test('loan rejects invalid terms, rates, and principal', () => {
    for (const years of [0, -1, 0.1, 101, Infinity, NaN]) throws(() => context.calculateLoan(1000, 8, years));
    throws(() => context.calculateLoan(0, 8, 1));
    throws(() => context.calculateLoan(1000, -1, 1));
});
test('zero-rate savings adds all end-of-month contributions', () => {
    const r = context.calculateCompound(1200, 100, 0, 1);
    assert.equal(r.total, 2400);
    assert.equal(r.interest, 0);
});
test('savings matches an independent monthly balance simulation', () => {
    const r = context.calculateCompound(10000000, 1000000, 12, 10);
    close(r.total, compoundByMonth(10000000, 1000000, 12, 120));
    close(r.contributed, 130000000);
    close(context.calculateCompound(1000, 0, 12, 1).total, 1000 * 1.01 ** 12);
});
test('zero contributions produce zero total and an undefined percentage', () => {
    const r = context.calculateCompound(0, 0, 0, 1);
    assert.equal(r.total, 0);
    assert.equal(r.gainPercent, null);
});
test('negative savings return and tiny positive rates remain finite', () => {
    close(context.calculateCompound(1000, 100, -12, 1).total, compoundByMonth(1000, 100, -12, 12));
    close(context.calculateCompound(1200, 100, 1e-10, 1).total, 2400);
    throws(() => context.calculateCompound(1000, 100, -100, 1));
});
test('savings rejects invalid duration and overflow', () => {
    throws(() => context.calculateCompound(1000, 100, 12, 0));
    throws(() => context.calculateCompound(1000, -100, 12, 1));
    throws(() => context.calculateCompound(1000000, 100, 1e12, 100));
    throws(() => context.calculateCompound(Number.MAX_SAFE_INTEGER, 1, 0, 1));
});
test('zero-rate retirement closes the exact funding gap', () => {
    const r = context.calculateRetirement(30, 31, 2400, 0, 1200);
    assert.equal(r.monthlyDeposit, 100);
    assert.equal(r.projected, 2400);
});
test('retirement and compound savings use identical rates and deposit timing', () => {
    const r = context.calculateRetirement(30, 60, 5000000000, 10, 50000000);
    close(r.projected, 5000000000);
    close(compoundByMonth(50000000, r.monthlyDeposit, 10, 360), 5000000000);
    close(context.calculateCompound(50000000, r.monthlyDeposit, 10, 30).total, 5000000000);
});
test('retirement needs no new deposit when modeled capital meets the target', () => {
    const r = context.calculateRetirement(30, 31, 2400, 0, 3000);
    assert.equal(r.monthlyDeposit, 0);
    assert.equal(r.projected, 3000);
});
test('retirement supports a modeled loss and rejects invalid ages', () => {
    const r = context.calculateRetirement(30, 31, 2400, -12, 1200);
    close(compoundByMonth(1200, r.monthlyDeposit, -12, 12), 2400);
    for (const pair of [[30,30],[31,30],[-1,30],[30.5,60],[0,121],[0,101]]) {
        throws(() => context.calculateRetirement(pair[0], pair[1], 2400, 0, 1200));
    }
});
test('annual tax example: Rp10m/month TK0 gives Rp3m/year', () => {
    const r = context.calculateAnnualTax(10000000, 0, 0, 'TK0');
    assert.equal(r.gross, 120000000);
    assert.equal(r.jobExpense, 6000000);
    assert.equal(r.taxable, 60000000);
    assert.equal(r.annualTax, 3000000);
    assert.equal(r.monthlyAverage, 250000);
});
test('tax below PTKP is zero and qualifying contributions reduce net income', () => {
    assert.equal(context.calculateAnnualTax(4000000, 0, 0, 'TK0').annualTax, 0);
    const r = context.calculateAnnualTax(10000000, 0, 100000, 'TK0');
    assert.equal(r.yearlyContribution, 1200000);
    assert.equal(r.taxable, 58800000);
    assert.equal(r.annualTax, 2940000);
});
test('tax rounds PKP down to full thousands before applying brackets', () => {
    const r = context.calculateAnnualTax(5012345, 0, 0, 'TK0');
    assert.equal(r.net, 57140733);
    assert.equal(r.taxable, 3140000);
    assert.equal(r.annualTax, 157000);
});
test('all eight PTKP options match statutory annual values', () => {
    const expected = { TK0:54000000,TK1:58500000,TK2:63000000,TK3:67500000,K0:58500000,K1:63000000,K2:67500000,K3:72000000 };
    for (const [status, value] of Object.entries(expected)) assert.equal(context.calculateAnnualTax(10000000,0,0,status).ptkp,value);
});
test('progressive tax applies every bracket, including income above Rp5bn', () => {
    assert.equal(context.calculateAnnualTax(26000000, 0, 0, 'TK0').annualTax, 32000000);
    assert.equal(context.calculateAnnualTax(50000000, 0, 0, 'TK0').annualTax, 106000000);
    assert.equal(context.calculateAnnualTax(500000000, 0, 0, 'TK0').annualTax, 1773000000);
});
test('tax rejects unknown status, invalid deductions, and unsafe gross income', () => {
    throws(() => context.calculateAnnualTax(10000000,0,0,'toString'));
    throws(() => context.calculateAnnualTax(10000000,0,-1,'TK0'));
    throws(() => context.calculateAnnualTax(10000000,0,10000000,'TK0'));
    throws(() => context.calculateAnnualTax(Number.MAX_SAFE_INTEGER,0,0,'TK0'));
});

function element(id, value = '') {
    const classes = new Set();
    return { id, value, dataset: {}, attributes: {}, innerHTML: '', textContent: '',
        classList: { add: name => classes.add(name), remove: name => classes.delete(name),
            toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) },
        setAttribute(name, val) { this.attributes[name] = val; },
        removeAttribute(name) { delete this.attributes[name]; },
        focus() { this.focused = true; }, checkValidity: () => true };
}
const fields = {};
const keys = ['investasi','kredit','pensiun','pajak','bunga'];
const tabs = keys.map(key => { const e = element('button-' + key); e.dataset.panel = key; return e; });
const cards = keys.map(key => element(key));
context.document = {
    getElementById(id) { return fields[id] || (fields[id] = element(id)); },
    querySelector() { return { textContent: 'Test input' }; },
    querySelectorAll(selector) { return selector === '.tab' ? tabs : cards; }
};
test('tab selection has no dependency on a global browser event', () => {
    context.switchTab('pensiun');
    for (const tab of tabs) assert.equal(tab.attributes['aria-pressed'], String(tab.dataset.panel === 'pensiun'));
    for (const card of cards) assert.equal(card.classList.contains('active'), card.id === 'pensiun');
});
test('blank input is an accessible error, not an implicit zero', () => {
    context.hitungInvestasi();
    assert.equal(fields['result-investasi'].classList.contains('error'), true);
    assert.equal(fields['inv-modal'].attributes['aria-invalid'], 'true');
    assert.equal(fields['inv-modal'].focused, true);
    assert.match(fields['result-investasi'].textContent, /isi angka/);
});
test('UI recovers after correction and renders zero-rate outputs without NaN/Infinity', () => {
    const values = {'inv-modal':'1000','inv-akhir':'1500','inv-biaya':'0','kredit-jumlah':'12000000','kredit-bunga':'0','kredit-tahun':'1',
        'pensiun-usia':'30','pensiun-target':'31','pensiun-target-dana':'2400','pensiun-return':'0','pensiun-modal':'1200',
        'pajak-gaji':'10000000','pajak-tunjangan':'0','pajak-iuran':'0','pajak-status':'TK0',
        'bunga-modal':'0','bunga-setoran':'0','bunga-rate':'0','bunga-tahun':'1'};
    for (const [id,value] of Object.entries(values)) context.document.getElementById(id).value = value;
    for (const fn of ['hitungInvestasi','hitungKredit','hitungPensiun','hitungPajak','hitungBungaMajemuk']) context[fn]();
    for (const key of keys) {
        assert.equal(fields['result-' + key].classList.contains('error'), false);
        assert.doesNotMatch(fields['result-' + key].innerHTML, /NaN|Infinity/);
        assert.ok(fields['result-' + key].innerHTML.length > 0);
    }
    assert.equal(fields['inv-modal'].attributes['aria-invalid'], undefined);
    assert.match(fields['result-pajak'].innerHTML, /bukan potongan PPh 21 bulanan TER/);
});
test('entry point has named inputs, a valid doctype, and a legacy link', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    for (const match of html.matchAll(/<(?:input|select)[^>]*id="([^"]+)"/g)) assert.ok(html.includes(`for="${match[1]}"`));
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /src="calculator\.js"/);
    const legacy = fs.readFileSync(path.join(__dirname, 'Kalku Finance.html'), 'utf8');
    assert.match(legacy, /http-equiv="refresh"/);
    assert.match(legacy, /href="\.\/index\.html"/);
});

console.log(`\n${passed} checks passed.`);
