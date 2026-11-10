const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const Shop = require("../src/models/Shop");

const collectionNames = ["products", "customers", "transactions"];
const normalizedName = (value) => String(value || "").trim().toLocaleLowerCase("en-IN");
const normalizedPhone = (value) => String(value || "").replace(/\D/g, "");
const toId = (value) => new mongoose.Types.ObjectId(value);

const readMapping = async () => {
  const file = process.env.TENANT_MIGRATION_MAP;
  if (!file) throw new Error("Set TENANT_MIGRATION_MAP to a reviewed JSON ownership mapping file");
  const mapping = JSON.parse(await fs.readFile(path.resolve(file), "utf8"));
  for (const collection of collectionNames) {
    if (!mapping[collection] || typeof mapping[collection] !== "object") {
      throw new Error(`Mapping must include an object for ${collection}`);
    }
  }
  return mapping;
};

const prepareUpdates = async (mapping) => {
  const plans = {};
  const duplicatePhoneKeys = new Set();
  const duplicateIdempotencyKeys = new Set();
  const allocatedPayments = new Map();
  const transactionOwners = new Map();
  const transactionCollection = mongoose.connection.collection("transactions");
  const transactionCursor = transactionCollection.find(
    {},
    { projection: { _id: 1, shopId: 1, type: 1, allocations: 1 } }
  );
  for await (const transaction of transactionCursor) {
    const shopId =
      transaction.shopId || mapping.transactions[String(transaction._id)];
    if (!shopId) {
      throw new Error("Transactions contain a record without an explicit shop ownership mapping");
    }
    if (!mongoose.isObjectIdOrHexString(String(shopId))) {
      throw new Error("Transaction ownership mapping contains an invalid Shop ObjectId");
    }
    transactionOwners.set(String(transaction._id), {
      shopId: String(shopId),
      type: transaction.type,
    });
    for (const allocation of transaction.allocations || []) {
      if (!Number.isFinite(allocation.amount) || allocation.amount <= 0) {
        throw new Error("A legacy payment contains an invalid allocation amount");
      }
      const key = String(allocation.saleId);
      allocatedPayments.set(
        key,
        (allocatedPayments.get(key) || 0) + allocation.amount
      );
    }
  }

  const productOwners = new Map();
  const customerOwners = new Map();
  for (const name of collectionNames) {
    const collection = mongoose.connection.collection(name);
    plans[name] = [];
    const cursor = collection.find({});
    for await (const doc of cursor) {
      const mappedShopId = mapping[name][String(doc._id)];
      const shopIdValue = doc.shopId ? String(doc.shopId) : mappedShopId;
      if (!shopIdValue) {
        throw new Error(`${name} contains a record without an explicit shop ownership mapping`);
      }
      if (!mongoose.isObjectIdOrHexString(shopIdValue)) {
        throw new Error(`${name} ownership mapping contains an invalid Shop ObjectId`);
      }
      const shopId = toId(shopIdValue);
      if (!(await Shop.exists({ _id: shopId }))) {
        throw new Error(`${name} ownership mapping refers to a Shop that does not exist`);
      }

      const update = { shopId };
      if (name === "products") {
        update.nameNormalized = normalizedName(doc.name);
        if (!update.nameNormalized) throw new Error("Products must have a non-empty name");
        productOwners.set(String(doc._id), String(shopId));
      }
      if (name === "customers") {
        update.nameNormalized = normalizedName(doc.name);
        update.phoneNormalized = normalizedPhone(doc.phone);
        if (
          !update.nameNormalized ||
          update.phoneNormalized.length < 7 ||
          update.phoneNormalized.length > 20
        ) {
          throw new Error("Legacy customer names and phone numbers must be valid");
        }
        customerOwners.set(String(doc._id), String(shopId));
        const key = `${shopId}:${update.phoneNormalized}`;
        if (duplicatePhoneKeys.has(key)) {
          throw new Error("Customer phone numbers would not be unique within a Shop");
        }
        duplicatePhoneKeys.add(key);
      }
      if (name === "transactions") {
        if (
          doc.customerId &&
          customerOwners.get(String(doc.customerId)) !== String(shopId)
        ) {
          throw new Error("A transaction's customer must belong to the same Shop");
        }
        for (const item of doc.items || []) {
          if (productOwners.get(String(item.productId)) !== String(shopId)) {
            throw new Error("A transaction's products must belong to the same Shop");
          }
        }
        for (const allocation of doc.allocations || []) {
          const sale = transactionOwners.get(String(allocation.saleId));
          if (!sale || sale.type !== "SALE" || sale.shopId !== String(shopId)) {
            throw new Error("Payment allocations must refer to a sale in the same Shop");
          }
        }
        if (doc.idempotencyKey) {
          const key = `${shopId}:${doc.idempotencyKey}`;
          if (duplicateIdempotencyKeys.has(key)) {
            throw new Error("Idempotency keys would not be unique within a Shop");
          }
          duplicateIdempotencyKeys.add(key);
        }
        if (doc.type === "SALE" && doc.initialAmountPaid === undefined) {
          const allocated = allocatedPayments.get(String(doc._id)) || 0;
          if (!Number.isFinite(doc.amountPaid)) {
            throw new Error("A legacy sale has an invalid recorded paid amount");
          }
          const initial = Number((doc.amountPaid - allocated).toFixed(2));
          if (initial < 0) {
            throw new Error("Payment allocations exceed a legacy sale's recorded paid amount");
          }
          update.initialAmountPaid = initial;
        }
      }
      plans[name].push({ _id: doc._id, update });
    }
  }
  return plans;
};

const applyPlan = async (plans) => {
  for (const [name, records] of Object.entries(plans)) {
    const collection = mongoose.connection.collection(name);
    for (let offset = 0; offset < records.length; offset += 500) {
      const batch = records.slice(offset, offset + 500);
      if (!batch.length) continue;
      await collection.bulkWrite(
        batch.map(({ _id, update }) => ({
          updateOne: { filter: { _id }, update: { $set: update } },
        })),
        { ordered: true }
      );
    }
  }

  const customers = mongoose.connection.collection("customers");
  const transactions = mongoose.connection.collection("transactions");
  const customerIndexes = await customers.indexes();
  const transactionIndexes = await transactions.indexes();
  const oldPhoneIndex = customerIndexes.find(
    (index) => index.unique && Object.keys(index.key).join(",") === "phone"
  );
  const oldIdempotencyIndex = transactionIndexes.find(
    (index) => index.unique && Object.keys(index.key).join(",") === "idempotencyKey"
  );
  if (oldPhoneIndex) await customers.dropIndex(oldPhoneIndex.name);
  if (oldIdempotencyIndex) await transactions.dropIndex(oldIdempotencyIndex.name);
  await customers.createIndex(
    { shopId: 1, phoneNormalized: 1 },
    {
      name: "shopId_1_phoneNormalized_1",
      unique: true,
      partialFilterExpression: {
        shopId: { $type: "objectId" },
        phoneNormalized: { $type: "string" },
      },
    }
  );
  await transactions.createIndex(
    { shopId: 1, idempotencyKey: 1 },
    {
      name: "shopId_1_idempotencyKey_1",
      unique: true,
      partialFilterExpression: {
        shopId: { $type: "objectId" },
        idempotencyKey: { $type: "string" },
      },
    }
  );
}

const main = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  const mapping = await readMapping();
  await mongoose.connect(uri);
  try {
    const plans = await prepareUpdates(mapping);
    const counts = Object.fromEntries(
      Object.entries(plans).map(([name, records]) => [name, records.length])
    );
    if (!process.argv.includes("--apply")) {
      console.log("Dry run only. Ownership mapping validated; no records changed.", counts);
      console.log("Back up the database, then rerun with --apply to write the mapping.");
      return;
    }
    await applyPlan(plans);
    console.log("Tenant ownership mapping and tenant indexes applied.", counts);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("Tenant migration stopped:", error.message);
  process.exitCode = 1;
});
