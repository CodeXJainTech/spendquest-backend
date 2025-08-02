const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware');
const { Account, Transaction, User } = require('../db'); // ✅ Include User model

const router = express.Router();

router.get("/balance", authMiddleware, async (req, res) => {
    const account = await Account.findOne({
        userId: req.userId
    });

    res.json({
        balance: account.balance
    })
});

router.post("/transfer", authMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    const { amount, to } = req.body;

    const account = await Account.findOne({ userId: req.userId }).session(session);

    if (!account || account.balance < amount) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Insufficient balance" });
    }

    const toAccount = await Account.findOne({ userId: to }).session(session);
    if (!toAccount) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Invalid account" });
    }

    // 💸 Update balances
    await Account.updateOne({ userId: req.userId }, { $inc: { balance: -amount } }).session(session);
    await Account.updateOne({ userId: to }, { $inc: { balance: amount } }).session(session);

    // 🤝 Add payee if not already added
    await User.updateOne(
        { _id: req.userId, payees: { $ne: to } }, // only if not already added
        { $push: { payees: to } }
    ).session(session);
    await Transaction.create({
        userId: req.userId,
        amount: amount,
        description: "Money transfered from Ramesh to suresh",
        isReceived: false,
        date: Date.now()
    })
    await session.commitTransaction();
    res.json({ message: "Transfer successful" });
});


router.post('/transactions', authMiddleware, async (req, res) => {
  const value = req.body.amount;

  if (req.body.isReceived) {
    await Account.updateOne({ userId: req.userId }, { $inc: { balance: +value } });
  } else {
    await Account.updateOne({ userId: req.userId }, { $inc: { balance: -value } });
  }

  await Transaction.create({
    userId: req.userId,
    amount: value,
    description: req.body.description,
    isReceived: req.body.isReceived,
    date: Date.now()
  });

  res.json("Transaction added, account updated");
});


router.get('/transactions', authMiddleware, async(req,res) => {
  const userId = req.userId;
  const transactions = await Transaction.find({ userId }).sort({ date: -1 });
  res.json(transactions);
});

module.exports = router;