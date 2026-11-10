const mongoose = require("mongoose");

const runInTransaction = async (operation) => {
  const session = await mongoose.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = runInTransaction;
