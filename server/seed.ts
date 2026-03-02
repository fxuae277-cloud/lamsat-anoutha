import { db } from "./db";
import { branches, warehouses, categories, products, inventory, users, cities, locations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function bootstrapOwner() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) return;

  console.log("No users found. Creating bootstrap owner...");

  let [branch] = await db.select().from(branches).limit(1);
  if (!branch) {
    [branch] = await db.insert(branches).values({
      name: "الفرع الرئيسي",
      address: "",
      isMain: true,
    }).returning();
  }

  const hashed = await hashPassword("Owner@12345");
  await db.insert(users).values({
    username: "owner",
    password: hashed,
    name: "المالك",
    role: "owner",
    branchId: branch.id,
    terminalName: "POS-1",
    isActive: true,
  });

  console.log("Bootstrap owner created: username=owner, password=Owner@12345");
}

export async function seedDatabase() {
  await bootstrapOwner();
  await bootstrapLocations();

  const existingBranches = await db.select().from(branches);
  if (existingBranches.length > 1) return;

  console.log("Seeding database...");

  let b1 = existingBranches.find(b => b.isMain);
  if (!b1) {
    [b1] = await db.insert(branches).values({ name: "لمسة أنوثة إكسسوارات لوى", address: "ولاية لوى، الشارع العام", isMain: true }).returning();
  }
  const [b2] = await db.insert(branches).values({ name: "لمسة أنوثة شناص", address: "ولاية شناص، بجوار المركز الصحي", isMain: false }).returning();
  const [b3] = await db.insert(branches).values({ name: "لمسة أنوثة (الفرع الثالث)", address: "", isMain: false }).returning();

  const [wMain] = await db.insert(warehouses).values({ name: "المخزن الرئيسي", branchId: b1.id, isMain: true }).returning();
  const [w1] = await db.insert(warehouses).values({ name: "مخزن فرع لوى", branchId: b1.id, isMain: false }).returning();
  const [w2] = await db.insert(warehouses).values({ name: "مخزن فرع شناص", branchId: b2.id, isMain: false }).returning();
  const [w3] = await db.insert(warehouses).values({ name: "مخزن الفرع الثالث", branchId: b3.id, isMain: false }).returning();

  await db.insert(cities).values([
    { name: "لوى", branchId: b1.id },
    { name: "صحار", branchId: b1.id },
    { name: "شناص", branchId: b2.id },
    { name: "صحم", branchId: b2.id },
    { name: "مسقط", branchId: b1.id },
    { name: "بركاء", branchId: b3.id },
  ]);

  const existingUsers = await db.select().from(users);
  if (existingUsers.length <= 1) {
    const seedUsers = [
      { username: "mariam", password: await hashPassword("owner123"), name: "مريم", role: "owner", branchId: b1.id, terminalName: "POS-1" },
      { username: "ahmed", password: await hashPassword("owner123"), name: "أحمد", role: "owner", branchId: b1.id, terminalName: "POS-2" },
      { username: "fatma", password: await hashPassword("cashier123"), name: "فاطمة", role: "cashier", branchId: b1.id, terminalName: "POS-1" },
      { username: "noura", password: await hashPassword("cashier123"), name: "نورة", role: "cashier", branchId: b2.id, terminalName: "POS-1" },
      { username: "huda", password: await hashPassword("cashier123"), name: "هدى", role: "cashier", branchId: b3.id, terminalName: "POS-1" },
    ];
    await db.insert(users).values(seedUsers);
  }

  const [c1] = await db.insert(categories).values({ name: "عقود" }).returning();
  const [c2] = await db.insert(categories).values({ name: "أساور" }).returning();
  const [c3] = await db.insert(categories).values({ name: "خواتم" }).returning();
  const [c4] = await db.insert(categories).values({ name: "حلقان" }).returning();
  const [c5] = await db.insert(categories).values({ name: "أطقم" }).returning();

  const productList = [
    { barcode: "893456789001", name: "عقد ذهبي وردي", categoryId: c1.id, price: "12.000" },
    { barcode: "893456789002", name: "إسورة لؤلؤ زراعي", categoryId: c2.id, price: "8.500" },
    { barcode: "893456789003", name: "حلق ألماس صناعي", categoryId: c4.id, price: "5.000" },
    { barcode: "893456789004", name: "طقم زفاف ناعم", categoryId: c5.id, price: "45.000" },
    { barcode: "893456789005", name: "خاتم فضة 925", categoryId: c3.id, price: "15.000" },
    { barcode: "893456789006", name: "سلسال فراشة", categoryId: c1.id, price: "6.500" },
    { barcode: "893456789007", name: "إسورة جلد مطرز", categoryId: c2.id, price: "4.200" },
    { barcode: "893456789008", name: "عقد قلب كريستال", categoryId: c1.id, price: "9.800" },
  ];

  const insertedProducts = await db.insert(products).values(productList).returning();

  for (const p of insertedProducts) {
    await db.insert(inventory).values([
      { productId: p.id, warehouseId: wMain.id, quantity: Math.floor(Math.random() * 100) + 50 },
      { productId: p.id, warehouseId: w1.id, quantity: Math.floor(Math.random() * 30) + 5 },
      { productId: p.id, warehouseId: w2.id, quantity: Math.floor(Math.random() * 20) + 2 },
    ]);
  }

  await bootstrapLocations();
  console.log("Database seeded successfully!");
}

export async function bootstrapLocations() {
  const allBranches = await db.select().from(branches);
  for (const branch of allBranches) {
    const existing = await db.select().from(locations).where(eq(locations.branchId, branch.id));
    if (existing.length === 0) {
      await db.insert(locations).values([
        { branchId: branch.id, code: "showroom", name: "صالة العرض", active: true },
        { branchId: branch.id, code: "backstore", name: "المخزن", active: true },
      ]);
      console.log(`Created showroom + backstore locations for branch: ${branch.name}`);
    }
  }
}
