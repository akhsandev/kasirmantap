import Dexie from 'dexie';

export const db = new Dexie("RukoPosDB_v6");

// UPDATE VERSI KE 4 (Tambah tabel 'users')
db.version(4).stores({
    products: '++id, &barcode, name, category, stock', 
    transactions: '++id, date, synced',
    expenses: '++id, date, desc, amount, synced',
    customers: '++id, &name, phone, level', 
    debts: '++id, customerId, date, amount, type, synced',
    settings: 'key',
    users: '++id, &username, pin, role' // Tabel User Baru
});

// Seed Admin Default jika belum ada user
db.on('ready', async () => {
    const count = await db.users.count();
    if (count === 0) {
        await db.users.add({
            username: 'Owner',
            pin: '123456', // PIN DEFAULT
            role: 'admin'
        });
        console.log("Admin Default Dibuat: PIN 123456");
    }
});

export const findProductByAnyBarcode = async (code) => {
    const cleanCode = String(code).trim();
    if (!cleanCode) return null;

    const mainProduct = await db.products.where('barcode').equals(cleanCode).first();
    
    if (mainProduct) {
        return {
            product: mainProduct,
            unit: {
                name: mainProduct.base_unit || 'Pcs',
                conversion: 1,
                price_retail: mainProduct.price,
                price_grosir: mainProduct.price_grosir || mainProduct.price, 
                barcode: mainProduct.barcode
            },
            level: 'base'
        };
    }

    const multiProduct = await db.products
        .filter(p => p.multi_units && p.multi_units.some(u => u.barcode === cleanCode))
        .first();

    if (multiProduct) {
        const specificUnit = multiProduct.multi_units.find(u => u.barcode === cleanCode);
        return {
            product: multiProduct,
            unit: specificUnit,
            level: 'multi'
        };
    }

    return null;
};

export const deductStock = async (productId, qtyKeluar, conversion = 1) => {
    const product = await db.products.get(productId);
    if (!product) return;
    const totalQtyBase = qtyKeluar * conversion;
    const newStock = product.stock - totalQtyBase;
    await db.products.update(productId, { stock: newStock });
};