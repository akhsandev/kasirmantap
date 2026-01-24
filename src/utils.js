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

// --- 2. GENERATE BARCODE (DATA URL) ---
export const generateBarcode = (barcode) => {
    try {
        const canvas = document.createElement("canvas");
        // Width 2 agar hasil scan lebih tajam
        JsBarcode(canvas, barcode, { format: "CODE128", displayValue: true, width: 2, height: 50, fontSize: 14 });
        return canvas.toDataURL("image/png");
    } catch (e) {
        console.error("Barcode Error:", e);
        return null;
    }
};

// --- 3. CETAK LABEL BARCODE (FITUR ULTIMATE 58MM) ---
// Fitur baru untuk menempel harga di rak / barang
export const printLabel58mm = (productName, price, barcodeImgUrl, barcodeString) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    
    // CSS KHUSUS 58MM AGAR FULL & RAPI
    // Ukuran kertas diset 50mm x 40mm (Ukuran label standard)
    doc.write(`
        <html>
        <head>
            <style>
                @page { size: 50mm 40mm; margin: 0; } 
                body { 
                    font-family: 'Arial', sans-serif; 
                    width: 48mm; 
                    margin: 0 auto; 
                    padding: 2mm 0;
                    text-align: center;
                }
                .name { font-size: 12px; font-weight: bold; line-height: 1.1; margin-bottom: 2px; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
                .price { font-size: 16px; font-weight: 900; margin-bottom: 2px; }
                img { width: 90%; height: auto; display: block; margin: 0 auto; }
                .code { font-size: 10px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="name">${productName}</div>
            <div class="price">${formatRupiah(price)}</div>
            <img src="${barcodeImgUrl}" />
        </body>
        </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // Hapus iframe setelah 3 detik
    setTimeout(() => { if(document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
};

// --- 4. CETAK STRUK KASIR (PC/BROWSER) - KHUSUS 58MM ---
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
                @page { margin: 0; }
                body { 
                    font-family: 'Arial', sans-serif; 
                    font-size: 11px; 
                    font-weight: bold; 
                    width: 48mm; 
                    margin: 0 auto; 
                    padding: 5px 0; 
                    color: #000;
                    line-height: 1.2;
                }
                .text-center { text-align: center; }
                .flex { display: flex; justify-content: space-between; align-items: flex-start; }
                .line { border-bottom: 1px dashed #000; margin: 5px 0; }
                .title { font-size: 14px; font-weight: 900; }
                .total { font-size: 16px; font-weight: 900; }
                .sm { font-size: 10px; }
            </style>
        </head>
        <body>
            <div class="text-center title">RESKI JAYA</div>
            <div class="text-center sm">${new Date(tx.date).toLocaleString('id-ID')}</div>
            ${tx.customerName ? `<div class="text-center" style="margin-top:2px;">${tx.customerName}</div>` : ''}
            
            <div class="line"></div>
            
            ${tx.items.map(item => `
                <div style="margin-bottom:2px;">${item.name} (${item.unit || 'Pcs'})</div>
                <div class="flex">
                    <span>${item.qty} x ${fmt(item.price).replace('Rp','')}</span>
                    <span>${fmt(item.price * item.qty).replace('Rp','')}</span>
                </div>
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
            
            <div class="text-center" style="margin-top:10px;">Terima Kasih</div>
        </body>
        </html>
    `);
    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { if(document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
};

// --- 5. CETAK BLUETOOTH (RawBT) - BERSIH & AMAN ---
export const printBluetooth = (tx) => {
    const storeName = "RESKI JAYA"; 
    const date = new Date(tx.date).toLocaleString('id-ID');
    const fmt = (n) => new Intl.NumberFormat('id-ID').format(n);
    
    let text = "";
    
    text += `[C][b][h]${storeName}[/h][/b]\n`;
    text += `[C][b]${date}[/b]\n`;
    
    if (tx.customerName) text += `[C][b]Pelanggan: ${tx.customerName}[/b]\n`;
    
    text += `[L]--------------------------------\n`;

    tx.items.forEach(item => {
        text += `[L][b]${item.name} (${item.unit||'Pcs'})[/b]\n`;
        const qtyPrice = `${item.qty}x ${fmt(item.price)}`;
        const totalItem = fmt(item.price * item.qty);
        text += `[L][b]${qtyPrice}[R]${totalItem}[/b]\n`; 
    });

    text += `[L]--------------------------------\n`;

    if (tx.discount > 0) {
        text += `[L][b]Subtotal[R]${fmt(tx.total)}[/b]\n`;
        text += `[L][b]Diskon[R]-${fmt(tx.discount)}[/b]\n`;
        text += `[L]--------------------------------\n`;
    }
    
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

    text += `[L]\n[C][b]Terima Kasih[/b]\n[L]\n`;

    try {
        const base64Data = btoa(unescape(encodeURIComponent(text)));
        window.location.href = `rawbt:data:text/plain;charset=utf-8;base64,${base64Data}`;
    } catch (e) { console.error(e); alert("Gagal print: " + e.message); }
};

// --- 6. EXPORT EXCEL (Database Backup) ---
// Fungsi ini digunakan di ReportsView untuk download laporan Excel
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