'use strict';

const MAX_AMOUNT = Number.MAX_SAFE_INTEGER;
const PTKP = Object.freeze({ TK0: 54000000, TK1: 58500000, TK2: 63000000, TK3: 67500000,
    K0: 58500000, K1: 63000000, K2: 67500000, K3: 72000000 });

function requireNumber(value, label, min = 0, max = MAX_AMOUNT) {
    if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${label}: masukkan angka dalam rentang ${min} sampai ${max}.`);
    }
    return value;
}

function monthsFromYears(years) {
    requireNumber(years, 'Jangka waktu', 0, 100);
    const months = Math.round(years * 12);
    if (months < 1 || Math.abs(years * 12 - months) > 1e-8) {
        throw new Error('Jangka waktu harus lebih dari nol dan berupa jumlah bulan utuh (contoh: 0,5 tahun = 6 bulan).');
    }
    return months;
}

function checkedResult(result) {
    if (Object.values(result).some(value => typeof value === 'number' &&
        (!Number.isFinite(value) || Math.abs(value) > MAX_AMOUNT))) {
        throw new Error('Hasil terlalu besar untuk dihitung dengan rentang angka kalkulator ini. Kurangi nilai, bunga, atau durasi.');
    }
    return result;
}

function calculateROI(capital, finalValue, costs) {
    requireNumber(capital, 'Modal awal');
    requireNumber(finalValue, 'Nilai akhir');
    requireNumber(costs, 'Biaya investasi');
    const invested = capital + costs;
    if (invested === 0) throw new Error('Modal awal + biaya harus lebih dari nol untuk menghitung ROI.');
    const profit = finalValue - invested;
    return checkedResult({ invested, finalValue, profit, roi: profit / invested * 100 });
}

function calculateLoan(principal, annualRate, years) {
    requireNumber(principal, 'Jumlah pinjaman');
    if (principal === 0) throw new Error('Jumlah pinjaman harus lebih dari nol.');
    requireNumber(annualRate, 'Bunga pinjaman');
    const months = monthsFromYears(years);
    const monthlyRate = annualRate / 100 / 12;
    // log1p/expm1 keep very small positive rates stable; 0% has its own limit.
    const monthlyPayment = monthlyRate === 0 ? principal / months :
        principal * monthlyRate / -Math.expm1(-months * Math.log1p(monthlyRate));
    const totalPayment = monthlyPayment * months;
    return checkedResult({ months, monthlyPayment, totalPayment,
        interest: Math.max(0, totalPayment - principal) });
}

function savingsFactors(annualRate, months) {
    requireNumber(annualRate, 'Asumsi imbal hasil', -99.999);
    const monthlyRate = annualRate / 100 / 12;
    const logGrowth = months * Math.log1p(monthlyRate);
    const growth = Math.exp(logGrowth);
    const deposits = monthlyRate === 0 ? months : Math.expm1(logGrowth) / monthlyRate;
    if (!Number.isFinite(growth) || !Number.isFinite(deposits)) {
        throw new Error('Hasil terlalu besar. Kurangi asumsi imbal hasil atau durasi.');
    }
    return { growth, deposits };
}

function calculateCompound(capital, monthlyDeposit, annualRate, years) {
    requireNumber(capital, 'Modal awal');
    requireNumber(monthlyDeposit, 'Setoran bulanan');
    const months = monthsFromYears(years);
    const { growth, deposits } = savingsFactors(annualRate, months);
    const contributed = capital + monthlyDeposit * months;
    const total = capital * growth + monthlyDeposit * deposits;
    const interest = total - contributed;
    return checkedResult({ months, contributed, total, interest,
        gainPercent: contributed === 0 ? null : interest / contributed * 100 });
}

function calculateRetirement(age, retirementAge, target, annualRate, capital) {
    requireNumber(age, 'Usia sekarang', 0, 120);
    requireNumber(retirementAge, 'Usia pensiun', 0, 120);
    if (!Number.isInteger(age) || !Number.isInteger(retirementAge) || retirementAge <= age) {
        throw new Error('Usia harus berupa tahun utuh; usia pensiun harus lebih besar dari usia sekarang.');
    }
    requireNumber(target, 'Target dana');
    requireNumber(capital, 'Tabungan saat ini');
    const months = monthsFromYears(retirementAge - age);
    const { growth, deposits } = savingsFactors(annualRate, months);
    const futureCapital = capital * growth;
    const monthlyDeposit = Math.max(0, target - futureCapital) / deposits;
    const contributed = capital + monthlyDeposit * months;
    const projected = futureCapital + monthlyDeposit * deposits;
    return checkedResult({ months, futureCapital, monthlyDeposit, contributed, projected });
}

function calculateAnnualTax(salary, allowance, contribution, status) {
    requireNumber(salary, 'Gaji bulanan');
    requireNumber(allowance, 'Tunjangan bulanan');
    requireNumber(contribution, 'Iuran bulanan');
    if (!Object.prototype.hasOwnProperty.call(PTKP, status)) throw new Error('Pilih status PTKP yang tersedia.');
    const gross = (salary + allowance) * 12;
    const jobExpense = Math.min(gross * 0.05, 6000000);
    const yearlyContribution = contribution * 12;
    if (yearlyContribution > gross - jobExpense) {
        throw new Error('Iuran tidak boleh melebihi penghasilan setelah biaya jabatan dalam model ini.');
    }
    const net = gross - jobExpense - yearlyContribution;
    const ptkp = PTKP[status];
    const taxable = Math.floor(Math.max(0, net - ptkp) / 1000) * 1000;
    let remaining = taxable;
    let annualTax = 0;
    for (const [width, rate] of [[60000000, 0.05], [190000000, 0.15],
        [250000000, 0.25], [4500000000, 0.30], [Infinity, 0.35]]) {
        const slice = Math.min(remaining, width);
        annualTax += slice * rate;
        remaining -= slice;
        if (remaining <= 0) break;
    }
    return checkedResult({ gross, jobExpense, yearlyContribution, net, ptkp,
        taxable, annualTax, monthlyAverage: annualTax / 12 });
}

function switchTab(tabName) {
    if (!['investasi', 'kredit', 'pensiun', 'pajak', 'bunga'].includes(tabName)) return;
    document.querySelectorAll('.tab').forEach(tab => {
        const selected = tab.dataset.panel === tabName;
        tab.classList.toggle('active', selected);
        tab.setAttribute('aria-pressed', String(selected));
    });
    document.querySelectorAll('.calculator-card').forEach(card => {
        card.classList.toggle('active', card.id === tabName);
    });
}

function formatRupiah(value) {
    return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

function formatPercent(value) {
    return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function readNumber(id) {
    const field = document.getElementById(id);
    const value = Number(field.value);
    field.removeAttribute('aria-invalid');
    if (!field.value.trim() || !Number.isFinite(value) || !field.checkValidity()) {
        const label = document.querySelector(`label[for="${id}"]`).textContent;
        const error = new Error(`${label}: isi angka yang valid sesuai batas kolom.`);
        error.field = field;
        throw error;
    }
    return value;
}

function showResult(name, calculate) {
    const box = document.getElementById('result-' + name);
    box.classList.remove('error');
    try {
        const { rows, note = '' } = calculate();
        // Labels and notes are authored constants; values are formatted numbers only.
        box.innerHTML = rows.map(([label, value]) => `<div class="result-item"><span class="result-label">${label}</span><span class="result-value">${value}</span></div>`).join('') +
            (note ? `<p class="result-note">${note}</p>` : '');
    } catch (error) {
        box.classList.add('error');
        box.textContent = error.message;
        if (error.field) {
            error.field.setAttribute('aria-invalid', 'true');
            error.field.setAttribute('aria-describedby', box.id);
            error.field.focus();
        }
    }
    box.classList.add('show');
}

function hitungInvestasi() {
    showResult('investasi', () => {
        const r = calculateROI(readNumber('inv-modal'), readNumber('inv-akhir'), readNumber('inv-biaya'));
        return { rows: [['Modal + biaya', formatRupiah(r.invested)], ['Nilai akhir', formatRupiah(r.finalValue)],
            ['Laba / rugi', formatRupiah(r.profit)], ['ROI selama periode investasi', formatPercent(r.roi)]] };
    });
}

function hitungKredit() {
    showResult('kredit', () => {
        const r = calculateLoan(readNumber('kredit-jumlah'), readNumber('kredit-bunga'), readNumber('kredit-tahun'));
        return { rows: [['Jumlah cicilan', r.months + ' bulan'], ['Cicilan bulanan', formatRupiah(r.monthlyPayment)],
            ['Total pembayaran', formatRupiah(r.totalPayment)], ['Total bunga', formatRupiah(r.interest)]] };
    });
}

function hitungPensiun() {
    showResult('pensiun', () => {
        const r = calculateRetirement(readNumber('pensiun-usia'), readNumber('pensiun-target'),
            readNumber('pensiun-target-dana'), readNumber('pensiun-return'), readNumber('pensiun-modal'));
        return { rows: [['Jangka waktu', r.months + ' bulan'], ['Proyeksi tabungan awal', formatRupiah(r.futureCapital)],
            ['Setoran bulanan dalam model', formatRupiah(r.monthlyDeposit)], ['Total modal + setoran', formatRupiah(r.contributed)],
            ['Proyeksi dana akhir', formatRupiah(r.projected)]],
            note: r.monthlyDeposit === 0 ? 'Dengan asumsi ini, proyeksi tabungan awal sudah mencapai target. Imbal hasil sebenarnya dapat berbeda.' : 'Setoran dilakukan pada akhir bulan. Imbal hasil sebenarnya dapat berbeda.' };
    });
}

function hitungPajak() {
    showResult('pajak', () => {
        const r = calculateAnnualTax(readNumber('pajak-gaji'), readNumber('pajak-tunjangan'),
            readNumber('pajak-iuran'), document.getElementById('pajak-status').value);
        return { rows: [['Penghasilan bruto setahun', formatRupiah(r.gross)], ['Biaya jabatan setahun', formatRupiah(r.jobExpense)],
            ['Iuran yang dimasukkan setahun', formatRupiah(r.yearlyContribution)], ['PTKP setahun', formatRupiah(r.ptkp)],
            ['PKP setelah pembulatan', formatRupiah(r.taxable)], ['Estimasi PPh 21 setahun', formatRupiah(r.annualTax)],
            ['Rata-rata bulanan (tahunan ÷ 12)', formatRupiah(r.monthlyAverage)]],
            note: 'Rata-rata ini bukan potongan PPh 21 bulanan TER, gaji bersih, atau jumlah yang siap dilaporkan dalam SPT.' };
    });
}

function hitungBungaMajemuk() {
    showResult('bunga', () => {
        const r = calculateCompound(readNumber('bunga-modal'), readNumber('bunga-setoran'),
            readNumber('bunga-rate'), readNumber('bunga-tahun'));
        return { rows: [['Total modal + setoran', formatRupiah(r.contributed)], ['Proyeksi dana akhir', formatRupiah(r.total)],
            ['Selisih dari modal + setoran', formatRupiah(r.interest)], ['Persentase selisih selama periode',
                r.gainPercent === null ? 'Tidak terdefinisi (modal + setoran Rp0)' : formatPercent(r.gainPercent)]],
            note: 'Persentase selisih bukan tingkat imbal hasil tahunan atau ukuran yang memperhitungkan waktu setiap setoran.' };
    });
}
