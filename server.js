import express from "express";
import dotenv from "dotenv";
import { stkPush, stkQuery } from "./mpesa.js";

dotenv.config();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Seeded products
const products = [
    {
        id: 1,
        name: "Laptop",
        price: 50000,
        description: "HP Laptop"
    },
    {
        id: 2,
        name: "Phone",
        price: 20000,
        description: "Android Phone"
    },
    {
        id: 3,
        name: "Keyboard",
        price: 3000,
        description: "Mechanical Keyboard"
    },
    {
        id: 4,
        name: "Mouse",
        price: 1500,
        description: "Wireless Mouse"
    },
    {
        id: 5,
        name: "Monitor",
        price: 12000,
        description: "24-inch Monitor"
    }
];

// Orders stored in memory
const orders = [];

// In-memory store for transaction results
const transactionResults = {};

// -----------------------------------------------
// GEMINI HELPER
// -----------------------------------------------
async function callGemini(prompt) {

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ]
            })
        }
    );

    const raw = await response.text();

    if (!raw) {
        throw new Error("Gemini returned an empty response");
    }

    const data = JSON.parse(raw);

    // Extract the generated text from Gemini's response structure
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Could not extract text from Gemini response");
    }

    return text;
}

// -----------------------------------------------
// PRODUCTS
// -----------------------------------------------

// GET all products
app.get("/products", (req, res) => {
    try {
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

// GET one product
app.get("/products/:id", (req, res) => {

    const product = products.find(
        p => p.id === Number(req.params.id)
    );

    if (!product) {
        return res.status(404).json({
            error: "Product not found"
        });
    }

    res.status(200).json(product);
});

// POST product
app.post("/products", (req, res) => {

    if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
            error: "Request body is missing or not valid JSON"
        });
    }

    const { name, price, description } = req.body;

    if (!name || !price || price <= 0) {
        return res.status(400).json({
            error: "Name and positive price are required"
        });
    }

    const newProduct = {
        id: products.length + 1,
        name,
        price,
        description
    };

    products.push(newProduct);

    res.status(201).json(newProduct);
});

// -----------------------------------------------
// ORDERS
// -----------------------------------------------

// POST order
app.post("/orders", (req, res) => {

    if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
            error: "Request body is missing or not valid JSON"
        });
    }

    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            error: "Order must contain at least one product"
        });
    }

    let total = 0;
    const orderItems = [];

    for (const id of items) {

        const product = products.find(
            p => p.id === Number(id)
        );

        if (!product) {
            return res.status(404).json({
                error: `Product ${id} not found`
            });
        }

        orderItems.push(product);
        total += product.price;
    }

    const order = {
        id: orders.length + 1,
        items: orderItems,
        total
    };

    orders.push(order);

    res.status(201).json(order);
});

// GET order by ID
app.get("/orders/:id", (req, res) => {

    const order = orders.find(
        o => o.id === Number(req.params.id)
    );

    if (!order) {
        return res.status(404).json({
            error: "Order not found"
        });
    }

    res.status(200).json(order);
});

// -----------------------------------------------
// AI ENDPOINTS
// -----------------------------------------------

// POST: Generate product description using Gemini
app.post("/generate-description", async (req, res) => {

    if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
            error: "Request body is missing or not valid JSON"
        });
    }

    const { name, keywords } = req.body;

    if (!name || !keywords) {
        return res.status(400).json({
            error: "Product name and keywords are required"
        });
    }

    const prompt = `Write a short, catchy product description for a product called "${name}". 
    Keywords to include: ${keywords}. 
    Keep it under 50 words, friendly and suitable for an online shop.`;

    try {
        const description = await callGemini(prompt);

        console.log("=== Gemini Description Generated ===");
        console.log("Product  :", name);
        console.log("Keywords :", keywords);
        console.log("Result   :", description);
        console.log("====================================");

        return res.status(200).json({
            product: name,
            description
        });

    } catch (error) {
        console.error("Gemini error:", error.message);
        return res.status(500).json({
            error: "AI service failed to generate description. Please try again."
        });
    }
});

// POST: Generate thank-you message after successful payment
app.post("/thank-you", async (req, res) => {

    if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
            error: "Request body is missing or not valid JSON"
        });
    }

    const { phone, amount, receiptNo } = req.body;

    if (!phone || !amount || !receiptNo) {
        return res.status(400).json({
            error: "Phone, amount and receiptNo are required"
        });
    }

    const prompt = `Write a short, friendly thank-you message for a customer who just made a payment.
    Details:
    - Phone: ${phone}
    - Amount paid: KES ${amount}
    - Receipt number: ${receiptNo}
    - Shop name: DukaConnect
    Keep it warm, personal, and under 60 words.`;

    try {
        const message = await callGemini(prompt);

        console.log("=== Gemini Thank-You Generated ===");
        console.log("Phone     :", phone);
        console.log("Amount    :", amount);
        console.log("Receipt   :", receiptNo);
        console.log("Message   :", message);
        console.log("==================================");

        return res.status(200).json({
            phone,
            amount,
            receiptNo,
            message
        });

    } catch (error) {
        console.error("Gemini error:", error.message);
        return res.status(500).json({
            error: "AI service failed to generate thank-you message. Please try again."
        });
    }
});

// -----------------------------------------------
// MPESA
// -----------------------------------------------

// POST: Initiate STK Push
app.post("/pay", async (req, res) => {

    if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({
            error: "Request body is missing or not valid JSON"
        });
    }

    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({
            error: "Phone and amount are required"
        });
    }

    try {
        const response = await stkPush(phone, amount);

        // Catch Safaricom API-level errors like rate limiting
        if (response.fault || response.errorCode) {
            console.error("Safaricom error:", response.fault?.faultstring || response.errorMessage);
            return res.status(429).json({
                error: response.fault?.faultstring || "Safaricom API error"
            });
        }

        console.log("=== STK Push Initiated ===");
        console.log("Phone            :", phone);
        console.log("Amount           :", amount);
        console.log("CheckoutRequestID:", response.CheckoutRequestID);
        console.log("Waiting for callback...");
        console.log("==========================");

        return res.status(200).json({
            message: "STK Push sent to phone. Enter M-Pesa PIN to complete payment.",
            checkoutRequestId: response.CheckoutRequestID
        });

    } catch (error) {

        console.error("STK Push error:", error.message);

        return res.status(500).json({
            error: error.message
        });
    }
});

// POST: M-Pesa Callback
app.post("/callback", (req, res) => {

    console.log("=== M-Pesa Callback Received ===");

    const body = req.body;
    const stkCallback = body?.Body?.stkCallback;

    if (!stkCallback) {
        console.log("No stkCallback in body:", JSON.stringify(body, null, 2));
        return res.status(200).json({ message: "Received" });
    }

    const {
        MerchantRequestID,
        CheckoutRequestID,
        ResultCode,
        ResultDesc,
        CallbackMetadata
    } = stkCallback;

    console.log("MerchantRequestID :", MerchantRequestID);
    console.log("CheckoutRequestID :", CheckoutRequestID);
    console.log("ResultCode        :", ResultCode);
    console.log("ResultDesc        :", ResultDesc);

    if (ResultCode === 0 && CallbackMetadata) {

        const items = CallbackMetadata.Item;

        const amount    = items.find(i => i.Name === "Amount")?.Value;
        const receiptNo = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;
        const phone     = items.find(i => i.Name === "PhoneNumber")?.Value;
        const date      = items.find(i => i.Name === "TransactionDate")?.Value;

        console.log("=== ✅ Transaction Successful ===");
        console.log("   Amount     :", amount);
        console.log("   Receipt No :", receiptNo);
        console.log("   Phone      :", phone);
        console.log("   Date       :", date);
        console.log("=================================");

        transactionResults[CheckoutRequestID] = {
            status: "success",
            amount,
            receiptNo,
            phone,
            date
        };

    } else {

        console.log("=== ❌ Transaction Failed ===");
        console.log("   Reason:", ResultDesc);
        console.log("=============================");

        transactionResults[CheckoutRequestID] = {
            status: "failed",
            reason: ResultDesc
        };
    }

    return res.status(200).json({ message: "Callback received" });
});

// GET: Check transaction result stored from callback
app.get("/payment-status/:checkoutRequestId", (req, res) => {

    const { checkoutRequestId } = req.params;
    const result = transactionResults[checkoutRequestId];

    if (!result) {
        return res.status(202).json({
            message: "Transaction still pending. Please wait for M-Pesa prompt to complete."
        });
    }

    console.log("=== Payment Status Check ===");
    console.log("CheckoutRequestID :", checkoutRequestId);
    console.log("Result            :", JSON.stringify(result, null, 2));
    console.log("============================");

    return res.status(200).json(result);
});

// -----------------------------------------------
// MISC
// -----------------------------------------------

// TEST 500 ERROR
app.get("/test-error", (req, res) => {

    try {
        throw new Error("Simulated failure");
    } catch (error) {

        console.error(error.message);

        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

// Start server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});