import dotenv from "dotenv";
dotenv.config();

/**
 * D1: Get OAuth Token
 */
export async function getMpesaAccessToken() {

    const auth = Buffer
        .from(`${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`)
        .toString("base64");

    const response = await fetch(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
            method: "GET",
            headers: {
                Authorization: `Basic ${auth}`
            }
        }
    );

    // Read raw text first
    const raw = await response.text();

    console.log("Access Token raw response:", raw);
    console.log("HTTP status:", response.status);

    if (!raw) {
        throw new Error(`Safaricom returned an empty response. HTTP status: ${response.status}`);
    }

    const data = JSON.parse(raw);

    return data.access_token;
}

/**
 * Timestamp helper (YYYYMMDDHHMMSS)
 */
function getTimestamp() {

    const date = new Date();

    return (
        date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0") +
        String(date.getHours()).padStart(2, "0") +
        String(date.getMinutes()).padStart(2, "0") +
        String(date.getSeconds()).padStart(2, "0")
    );
}

/**
 * D2: STK Push
 */
export async function stkPush(phone, amount) {

    // verify env variables are loaded
    console.log("ENV CHECK:", {
        CONSUMER_KEY: process.env.CONSUMER_KEY,
        CONSUMER_SECRET: process.env.CONSUMER_SECRET,
        BUSINESS_SHORT_CODE: process.env.BUSINESS_SHORT_CODE,
        PASSKEY: process.env.PASSKEY,
        CALLBACK_URL: process.env.CALLBACK_URL
    });

    const token = await getMpesaAccessToken();
    const timestamp = getTimestamp();

    const password = Buffer
        .from(
            `${process.env.BUSINESS_SHORT_CODE}${process.env.PASSKEY}${timestamp}`
        )
        .toString("base64");

    const payload = {
        BusinessShortCode: process.env.BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: process.env.BUSINESS_SHORT_CODE,
        PhoneNumber: phone,
        CallBackURL: process.env.CALLBACK_URL,
        AccountReference: "DUKA",
        TransactionDesc: "Payment"
    };

    const response = await fetch(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
    );

    // Read raw text first
    const raw = await response.text();

    console.log("STK Push raw response:", raw);
    console.log("HTTP status:", response.status);

    if (!raw) {
        throw new Error(`Safaricom returned an empty response. HTTP status: ${response.status}`);
    }

    return JSON.parse(raw);
}

/**
 * D3: STK Query (Transaction Status)
 */
export async function stkQuery(checkoutRequestId) {

    const token = await getMpesaAccessToken();
    const timestamp = getTimestamp();

    const password = Buffer
        .from(
            `${process.env.BUSINESS_SHORT_CODE}${process.env.PASSKEY}${timestamp}`
        )
        .toString("base64");

    const payload = {
        BusinessShortCode: process.env.BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
    };

    const response = await fetch(
        "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
    );

    //Read raw text first
    const raw = await response.text();

    console.log("STK Query raw response:", raw);
    console.log("HTTP status:", response.status);

    if (!raw) {
        throw new Error(`Safaricom returned an empty response. HTTP status: ${response.status}`);
    }

    return JSON.parse(raw);
}
