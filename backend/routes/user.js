// backend/routes/user.js
const express = require('express');

const router = express.Router();
const zod = require("zod");
const { User, Account, Transaction } = require("../db");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require('../middleware.js');
const { JWT_SECRET } = require("../config");

const signupBody = zod.object({
    userName: zod.string().email(),
	firstName: zod.string(),
	lastName: zod.string(),
	password: zod.string(),
    s_balance: zod.number()
})

router.post("/signup", async (req, res) => {
    const { success } = signupBody.safeParse(req.body)
    if (!success) {
        return res.status(411).json({
            message: "Incorrect inputs"
        })
    }

    const existingUser = await User.findOne({
        userName: req.body.userName
    })

    if (existingUser) {
        return res.status(411).json({
            message: "Email already taken"
        })
    }

    const user = await User.create({
        userName: req.body.userName,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
    })
    const userId = user._id;
    
    await Account.create({
        userId: userId,
        balance: req.body.s_balance
    })

    const token = jwt.sign({
        userId
    }, JWT_SECRET);

    res.json({
        message: "User created successfully",
        token: token
    })
})

const signinBody = zod.object({
    userName: zod.string().email(),
	password: zod.string()
})

router.post("/signin", async (req, res) => {
    const { success } = signinBody.safeParse(req.body)
    if (!success) {
        return res.status(411).json({
            message: "Email already taken / Incorrect inputs"
        })
    }

    const user = await User.findOne({
        userName: req.body.userName,
        password: req.body.password
    });

    if (user) {
        const token = jwt.sign({
            userId: user._id
        }, JWT_SECRET);
  
        res.json({
            token: token
        })
        return;
    }

    
    res.status(411).json({
        message: "Error while logging in"
    })
})

const updateBody = zod.object({
	password: zod.string().optional(),
    firstName: zod.string().optional(),
    lastName: zod.string().optional(),
})

router.put("/", authMiddleware, async (req, res) => {
    const { success } = updateBody.safeParse(req.body)
    if (!success) {
        res.status(411).json({
            message: "Error while updating information"
        })
    }

    await User.updateOne({ _id: req.userId }, req.body);


    res.json({
        message: "Updated successfully"
    })
})

router.get("/bulk", async (req, res) => {
    const filter = req.query.filter || "";

    const users = await User.find({
        $or: [{
            firstName: {
                "$regex": filter
            }
        }, {
            lastName: {
                "$regex": filter
            }
        }]
    })

    res.json({
        user: users.map(user => ({
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            _id: user._id
        }))
    })
})

router.get('/payee', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;

        // Populate full payee info: userName, firstName, lastName
        const user = await User.findById(userId).populate('payees', 'userName firstName lastName');

        if (!user || !user.payees) {
            return res.status(404).json({ message: "User or payees not found" });
        }

        const payeeIds = user.payees.map(u => u._id);

        const accounts = await Account.find({ userId: { $in: payeeIds } });

        const friends = user.payees.map(payee => {
            const account = accounts.find(acc => acc.userId.equals(payee._id));
            return {
                userId: payee._id,
                userName: payee.userName,
                firstName: payee.firstName,
                lastName: payee.lastName,
                accountId: account ? account._id : null
            };
        });

        res.json(friends);
    } catch (err) {
        console.error("Error fetching payees:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


module.exports = router;