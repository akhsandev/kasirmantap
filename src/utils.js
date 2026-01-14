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

// --- 2. GENERATE BARCODE IMAGE ---
export const generateBarcode = (barcode) => {
    try {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, barcode, { 
            format: "CODE128", 
            displayValue: true, 
            height: 40, 
            fontSize: 14 
        });
        return canvas.toDataURL("image/png");
    } catch (e) {
        console.error("Barcode Error:", e);
        return null;
    }
};

// --- 3. CETAK STRUK BROWSER (UNTUK PC/LAPTOP) ---
export const printReceipt = (tx) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    
    // Logika Tampilan Metode Pembayaran
    let paymentMethod = 'TUNAI';
    if (tx.type === 'debt') paymentMethod = 'KASBON';
    else if (tx.type === 'qris') paymentMethod = 'QRIS';
    else if (tx.type === 'transfer') paymentMethod = 'TRANSFER BANK';
    
    const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

    doc.write(`
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; width: 58mm; margin: 0; padding: 10px 0; color: #000; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .line { border-bottom: 1px dashed #000; margin: 5px 0; }
                .flex { display: flex; justify-content: space-between; }
                .item-name { margin-bottom: 2px; }
                .sm { font-size: 10px; }
            </style>
        </head>
        <body>
            <div class="text-center bold">RUKO POS</div>
            <div class="text-center sm">${new Date(tx.date).toLocaleString('id-ID')}</div>
            ${tx.customerName ? `<div class="text-center bold" style="margin-top:5px;">${tx.customerName}</div>` : ''}
            <div class="line"></div>
            ${tx.items.map(item => `
                <div class="item-name">
                    ${item.name} (${item.unit || 'Pcs'}) 
                </div>
                <div class="flex">
                    <span>${item.qty} x ${fmt(item.price).replace('Rp','')}</span>
                    <span>${fmt(item.price * item.qty).replace('Rp','')}</span>
                </div>
            `).join('')}
            <div class="line"></div>
            <div class="flex bold"><span>TOTAL</span><span>${fmt(tx.total)}</span></div>
            ${tx.discount > 0 ? `<div class="flex sm"><span>Diskon</span><span>-${fmt(tx.discount)}</span></div>` : ''}
            <div class="flex bold"><span>TAGIHAN</span><span>${fmt(tx.finalTotal)}</span></div>
            <div class="line"></div>
            
            <div class="flex"><span>Metode</span><span>${paymentMethod}</span></div>
            ${tx.type === 'cash' ? `
                <div class="flex"><span>Bayar</span><span>${fmt(tx.payment)}</span></div>
                <div class="flex"><span>Kembali</span><span>${fmt(tx.change)}</span></div>
            ` : ''}
            
            <div class="line"></div>
            <div class="text-center sm">Terima Kasih</div>
        </body>
        </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
};

// --- 4. CETAK STRUK BLUETOOTH (UNTUK HP ANDROID VIA RAWBT) ---
export const printBluetooth = (tx) => {
    // Format Teks agar rapi (Menggunakan Tag RawBT)
    const storeName = "RUKO POS"; 
    const date = new Date(tx.date).toLocaleString('id-ID');
    const fmt = (n) => new Intl.NumberFormat('id-ID').format(n);
    
    let text = "";
    
    // Header
    text += `[C]<b>${storeName}</b>\n`;
    text += `[C]${date}\n`;
    text += `[L]--------------------------------\n`;
    
    if (tx.customerName) {
        text += `[L]Pelanggan: ${tx.customerName}\n`;
        text += `[L]--------------------------------\n`;
    }

    // Items Loop
    tx.items.forEach(item => {
        text += `[L]<b>${item.name} (${item.unit||'Pcs'})</b>\n`;
        // Format: 2 x 5.000 (Kiri) ....... 10.000 (Kanan)
        const qtyPrice = `${item.qty}x ${fmt(item.price)}`;
        const totalItem = fmt(item.price * item.qty);
        
        // RawBT tag [L]eft dan [R]ight untuk perataan
        text += `[L]${qtyPrice}[R]${totalItem}\n`; 
    });

    text += `[L]--------------------------------\n`;

    // Totals
    text += `[L]TOTAL[R]<b>Rp ${fmt(tx.total)}</b>\n`;
    if (tx.discount > 0) {
        text += `[L]Diskon[R]-Rp ${fmt(tx.discount)}\n`;
        text += `[L]TAGIHAN[R]<b>Rp ${fmt(tx.finalTotal)}</b>\n`;
    }
    
    // Payment Info
    let method = 'TUNAI';
    if (tx.type === 'debt') method = 'KASBON';
    else if (tx.type === 'qris') method = 'QRIS';
    else if (tx.type === 'transfer') method = 'TRANSFER';

    text += `[L]Metode[R]${method}\n`;

    if (tx.type === 'cash') {
        text += `[L]Bayar[R]Rp ${fmt(tx.payment)}\n`;
        text += `[L]Kembali[R]Rp ${fmt(tx.change)}\n`;
    }

    // Footer
    text += `[L]\n`;
    text += `[C]Terima Kasih\n`;
    text += `[C]Simpan struk sebagai bukti\n`;
    text += `[L]\n`;

    // Encode ke Format RawBT (Base64)
    // Skema URL: rawbt:data:text/plain;base64,.....
    try {
        const base64Data = btoa(text);
        const url = `rawbt:data:text/plain;charset=utf-8;base64,${base64Data}`;
        // Redirect ke Aplikasi RawBT
        window.location.href = url;
    } catch (e) {
        alert("Gagal memproses data cetak: " + e.message);
    }
};

// --- 5. BACKUP DATABASE (JSON) ---
export const exportDatabase = async (db) => {
    try {
        const allData = {
            products: await db.products.toArray(),
            transactions: await db.transactions.toArray(),
            customers: await db.customers.toArray(),
            debts: await db.debts.toArray(),
            expenses: await db.expenses.toArray(),
            settings: await db.settings.toArray(),
            users: await db.users.toArray(), // Sertakan user juga
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(allData)], {type: "application/json"});
        saveAs(blob, `RukoPOS_Backup_${new Date().toISOString().slice(0,10)}.json`);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

// --- 6. RESTORE DATABASE (JSON) ---
export const importDatabase = async (db, file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Validasi sederhana
                if (!data.products || !data.transactions) throw new Error("Format file salah!");

                await db.transaction('rw', db.products, db.transactions, db.customers, db.debts, db.expenses, db.settings, db.users, async () => {
                    await db.products.clear();
                    await db.products.bulkAdd(data.products);
                    
                    await db.transactions.clear();
                    await db.transactions.bulkAdd(data.transactions);

                    if(data.customers) { await db.customers.clear(); await db.customers.bulkAdd(data.customers); }
                    if(data.debts) { await db.debts.clear(); await db.debts.bulkAdd(data.debts); }
                    if(data.expenses) { await db.expenses.clear(); await db.expenses.bulkAdd(data.expenses); }
                    if(data.settings) { await db.settings.clear(); await db.settings.bulkAdd(data.settings); }
                    if(data.users) { await db.users.clear(); await db.users.bulkAdd(data.users); }
                });
                resolve(true);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsText(file);
    });
};

// --- 7. EXPORT EXCEL PROFESIONAL (ExcelJS) ---
export const exportToExcel = async (db) => {
    try {
        const transactions = await db.transactions.toArray();
        const expenses = await db.expenses.toArray();

        // Buat Workbook Baru
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Ruko POS';
        workbook.created = new Date();

        // --- SHEET 1: PENJUALAN ---
        const sheetTx = workbook.addWorksheet('Laporan Penjualan');
        
        // Header Kolom
        sheetTx.columns = [
            { header: 'No Ref', key: 'id', width: 10 },
            { header: 'Tanggal', key: 'date', width: 15 },
            { header: 'Jam', key: 'time', width: 10 },
            { header: 'Pelanggan', key: 'cust', width: 20 },
            { header: 'Metode', key: 'type', width: 12 },
            { header: 'Total Belanja', key: 'total', width: 15 },
            { header: 'Diskon', key: 'disc', width: 10 },
            { header: 'Total Akhir', key: 'final', width: 15 },
            { header: 'Modal (HPP)', key: 'cost', width: 15 },
            { header: 'Profit', key: 'profit', width: 15 },
            { header: 'Detail Barang', key: 'items', width: 50 },
        ];

        // Style Header jadi Bold
        sheetTx.getRow(1).font = { bold: true };

        // Isi Data Transaksi
        transactions.forEach(t => {
            let method = 'Tunai';
            if(t.type === 'debt') method = 'Kasbon';
            else if(t.type === 'qris') method = 'QRIS';
            else if(t.type === 'transfer') method = 'Transfer';

            sheetTx.addRow({
                id: t.id,
                date: new Date(t.date).toLocaleDateString('id-ID'),
                time: new Date(t.date).toLocaleTimeString('id-ID'),
                cust: t.customerName || 'Umum',
                type: method,
                total: t.total,
                disc: t.discount,
                final: t.finalTotal,
                cost: t.total_cost || 0,
                profit: t.profit || 0,
                items: t.items.map(i => `${i.name} (${i.qty} ${i.unit||'Pcs'})`).join(', ')
            });
        });

        // --- SHEET 2: PENGELUARAN ---
        const sheetExp = workbook.addWorksheet('Laporan Pengeluaran');
        sheetExp.columns = [
            { header: 'Tanggal', key: 'date', width: 15 },
            { header: 'Keterangan', key: 'desc', width: 40 },
            { header: 'Jumlah', key: 'amount', width: 20 },
        ];
        sheetExp.getRow(1).font = { bold: true };

        expenses.forEach(e => {
            sheetExp.addRow({
                date: new Date(e.date).toLocaleDateString('id-ID'),
                desc: e.desc,
                amount: e.amount
            });
        });

        // Download File
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Laporan_RukoPOS_${new Date().toISOString().slice(0,10)}.xlsx`);
        
        return true;
    } catch (e) {
        console.error("Export Error:", e);
        alert("Gagal Export Excel: " + e.message);
        return false;
    }
};