const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware');
const { Account, Transaction, User } = require('../db');
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

    const { amount, toUsername } = req.body;

    const senderAccount = await Account.findOne({ userId: req.userId }).session(session);
    if (!senderAccount || senderAccount.balance < amount) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Insufficient balance" });
    }

    const recipientUser = await User.findOne({ userName: toUsername });
    if (!recipientUser) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Invalid recipient" });
    }

    const recipientAccount = await Account.findOne({ userId: recipientUser._id }).session(session);
    if (!recipientAccount) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Invalid account" });
    }

    //Update balances
    await Account.updateOne({ userId: req.userId }, { $inc: { balance: -amount } }).session(session);
    await Account.updateOne({ userId: recipientUser._id }, { $inc: { balance: amount } }).session(session);

    //Add payee if not already added
    await User.updateOne(
        { _id: req.userId, payees: { $ne: recipientUser._id } },
        { $push: { payees: recipientUser._id } }
    ).session(session);
    
    //Log both transactions
    await Transaction.create([
        {
            userId: req.userId,
            amount,
            description: `Money sent to ${recipientUser.firstName}`,
            isReceived: false,
            date: Date.now()
        },
        {
            userId: recipientUser._id,
            amount,
            description: `Money received from ${senderAccount.firstName}`,
            isReceived: true,
            date: Date.now()
        }
    ]);

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
  res.json({transactions});
});

module.exports = router;