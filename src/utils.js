import JsBarcode from 'jsbarcode';
import ExcelJS from 'exceljs'; 
import { saveAs } from 'file-saver'; 

// --- 1. FORMAT CURRENCY ---
export const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(number);
};

// --- 2. GENERATE BARCODE ---
export const generateBarcode = (barcode) => {
    try {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, barcode, { format: "CODE128", displayValue: true, height: 40, fontSize: 14 });
        return canvas.toDataURL("image/png");
    } catch (e) {
        console.error("Barcode Error:", e);
        return null;
    }
};

// --- 3. CETAK STRUK BROWSER (PC) - VERSI PINTAR ---
export const printReceipt = (tx) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    
    let paymentMethod = 'TUNAI';
    if (tx.type === 'debt') paymentMethod = 'KASBON';
    else if (tx.type === 'qris') paymentMethod = 'QRIS';
    else if (tx.type === 'transfer') paymentMethod = 'TRANSFER';
    
    const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    doc.write(`
        <html>
        <head>
            <style>
                body { 
                    font-family: 'Arial', sans-serif; 
                    font-size: 14px; 
                    font-weight: bold; 
                    width: 58mm; 
                    margin: 0; 
                    padding: 5px 0; 
                    color: #000;
                    line-height: 1.2;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .line { border-bottom: 2px dashed #000; margin: 8px 0; }
                .flex { display: flex; justify-content: space-between; align-items: flex-start; }
                .item-name { margin-bottom: 2px; }
                .title { font-size: 18px; font-weight: 900; }
                .total { font-size: 20px; font-weight: 900; } /* Total Sangat Besar */
                .sm { font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="text-center title">RESKI JAYA</div>
            <div class="text-center sm">${new Date(tx.date).toLocaleString('id-ID')}</div>
            ${tx.customerName ? `<div class="text-center" style="margin-top:5px; font-size:14px;">${tx.customerName}</div>` : ''}
            
            <div class="line"></div>
            
            ${tx.items.map(item => `
                <div class="item-name">
                    ${item.name} (${item.unit || 'Pcs'}) 
                </div>
                <div class="flex">
                    <span>${item.qty} x ${fmt(item.price).replace('Rp','')}</span>
                    <span>${fmt(item.price * item.qty).replace('Rp','')}</span>
                </div>
                <div style="margin-bottom: 5px;"></div>
            `).join('')}
            
            <div class="line"></div>
            
            ${tx.discount > 0 ? `
                <div class="flex"><span>Subtotal</span><span>${fmt(tx.total)}</span></div>
                <div class="flex"><span>Diskon</span><span>-${fmt(tx.discount)}</span></div>
                <div class="line"></div>
            ` : ''}
            
            <div class="flex total"><span>TOTAL</span><span>${fmt(tx.finalTotal)}</span></div>
            
            <div class="line"></div>
            
            <div class="flex"><span>Metode</span><span>${paymentMethod}</span></div>
            ${tx.type === 'cash' ? `
                <div class="flex"><span>Bayar</span><span>${fmt(tx.payment)}</span></div>
                <div class="flex"><span>Kembali</span><span>${fmt(tx.change)}</span></div>
            ` : ''}
            
            <div class="line"></div>
            <div class="text-center" style="margin-top:10px;">Terima Kasih</div>
        </body>
        </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
};

// --- 4. CETAK BLUETOOTH (RawBT) - VERSI PINTAR ---
export const printBluetooth = (tx) => {
    const storeName = "RESKI JAYA"; 
    const date = new Date(tx.date).toLocaleString('id-ID');
    const fmt = (n) => new Intl.NumberFormat('id-ID').format(n);
    
    let text = "";
    
    text += `[C][b][h]${storeName}[/h][/b]\n`;
    text += `[C][b]${date}[/b]\n`;
    
    if (tx.customerName) {
        text += `[C][b]Pelanggan: ${tx.customerName}[/b]\n`;
    }
    
    text += `[L]--------------------------------\n`;

    tx.items.forEach(item => {
        text += `[L][b]${item.name} (${item.unit||'Pcs'})[/b]\n`;
        const qtyPrice = `${item.qty}x ${fmt(item.price)}`;
        const totalItem = fmt(item.price * item.qty);
        text += `[L][b]${qtyPrice}[R]${totalItem}[/b]\n`; 
    });

    text += `[L]--------------------------------\n`;

    // LOGIKA PINTAR BLUETOOTH
    if (tx.discount > 0) {
        text += `[L][b]Subtotal[R]${fmt(tx.total)}[/b]\n`;
        text += `[L][b]Diskon[R]-${fmt(tx.discount)}[/b]\n`;
        text += `[L]--------------------------------\n`;
    }
    
    // TOTAL AKHIR (Besar & Tebal)
    text += `[L][h][b]TOTAL[R]Rp ${fmt(tx.finalTotal)}[/b][/h]\n`;
    
    let method = 'TUNAI';
    if (tx.type === 'debt') method = 'KASBON';
    else if (tx.type === 'qris') method = 'QRIS';
    else if (tx.type === 'transfer') method = 'TRANSFER';

    text += `[L][b]Metode[R]${method}[/b]\n`;

    if (tx.type === 'cash') {
        text += `[L][b]Bayar[R]Rp ${fmt(tx.payment)}[/b]\n`;
        text += `[L][b]Kembali[R]Rp ${fmt(tx.change)}[/b]\n`;
    }

    text += `[L]\n`;
    text += `[C][b]Terima Kasih[/b]\n`;
    text += `[L]\n`;

    try {
        const base64Data = btoa(text);
        window.location.href = `rawbt:data:text/plain;charset=utf-8;base64,${base64Data}`;
    } catch (e) { alert("Gagal print: " + e.message); }
};

// --- 5. EXPORT EXCEL (Database Backup) ---
export const exportDatabase = async (db) => {
    try {
        const allData = {
            products: await db.products.toArray(),
            transactions: await db.transactions.toArray(),
            customers: await db.customers.toArray(),
            debts: await db.debts.toArray(),
            expenses: await db.expenses.toArray(),
            settings: await db.settings.toArray(),
            users: await db.users.toArray(),
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(allData)], {type: "application/json"});
        saveAs(blob, `RukoPOS_Backup_${new Date().toISOString().slice(0,10)}.json`);
        return true;
    } catch (e) { return false; }
};

export const importDatabase = async (db, file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.products) throw new Error("Format salah!");
                await db.transaction('rw', db.products, db.transactions, db.customers, db.debts, db.expenses, db.settings, db.users, async () => {
                    await db.products.clear(); await db.products.bulkAdd(data.products);
                    await db.transactions.clear(); await db.transactions.bulkAdd(data.transactions);
                    if(data.customers) { await db.customers.clear(); await db.customers.bulkAdd(data.customers); }
                    if(data.debts) { await db.debts.clear(); await db.debts.bulkAdd(data.debts); }
                    if(data.expenses) { await db.expenses.clear(); await db.expenses.bulkAdd(data.expenses); }
                    if(data.settings) { await db.settings.clear(); await db.settings.bulkAdd(data.settings); }
                    if(data.users) { await db.users.clear(); await db.users.bulkAdd(data.users); }
                });
                resolve(true);
            } catch (err) { reject(err); }
        };
        reader.readAsText(file);
    });
};

// --- 6. EXPORT EXCEL LAMA (SettingsView) ---
export const exportToExcel = async (db) => {
    try {
        const transactions = await db.transactions.toArray();
        const expenses = await db.expenses.toArray();

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'RESKI JAYA';
        workbook.created = new Date();

        const sheetTx = workbook.addWorksheet('Laporan Penjualan');
        sheetTx.columns = [
            { header: 'No Ref', key: 'id', width: 10 },
            { header: 'Tanggal', key: 'date', width: 15 },
            { header: 'Pelanggan', key: 'cust', width: 20 },
            { header: 'Metode', key: 'type', width: 12 },
            { header: 'Total', key: 'total', width: 15 },
            { header: 'Diskon', key: 'disc', width: 10 },
            { header: 'Final', key: 'final', width: 15 },
            { header: 'Modal', key: 'cost', width: 15 },
            { header: 'Profit', key: 'profit', width: 15 },
            { header: 'Items', key: 'items', width: 50 },
        ];
        sheetTx.getRow(1).font = { bold: true };
        
        transactions.forEach(t => {
            let m = t.type === 'debt' ? 'Kasbon' : (t.type === 'qris' ? 'QRIS' : (t.type==='transfer'?'Transfer':'Tunai'));
            sheetTx.addRow({
                id: t.id, date: new Date(t.date).toLocaleDateString('id-ID'), cust: t.customerName, type: m,
                total: t.total, disc: t.discount, final: t.finalTotal, cost: t.total_cost||0, profit: t.profit||0,
                items: t.items.map(i=>`${i.name} (${i.qty})`).join(', ')
            });
        });

        const sheetExp = workbook.addWorksheet('Laporan Pengeluaran');
        sheetExp.columns = [
            { header: 'Tanggal', key: 'date', width: 15 },
            { header: 'Ket', key: 'desc', width: 40 },
            { header: 'Jumlah', key: 'amount', width: 20 },
        ];
        sheetExp.getRow(1).font = { bold: true };
        expenses.forEach(e => {
            sheetExp.addRow({ date: new Date(e.date).toLocaleDateString('id-ID'), desc: e.desc, amount: e.amount });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Laporan_Lengkap_${new Date().toISOString().slice(0,10)}.xlsx`);
        return true;
    } catch (e) { alert("Gagal Export: " + e.message); return false; }
};

// --- 7. EXPORT EXCEL BARU (ReportsView) ---
export const generateExcelReport = async (sheetName, columns, data, fileName) => {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'RESKI JAYA';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(sheetName);
        sheet.columns = columns;

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        data.forEach(item => { sheet.addRow(item); });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${fileName}_${new Date().toISOString().slice(0,10)}.xlsx`);
        return true;
    } catch (e) {
        console.error("Excel Error:", e);
        alert("Gagal membuat laporan: " + e.message);
        return false;
    }
};