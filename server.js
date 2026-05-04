require("dotenv").config();
const express = require("express");
const axios = require("axios");
const PQueue = require("p-queue").default;

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const queue = new PQueue({
  interval: 1000,
  intervalCap: 3
});

const API_URL = "https://pay.onasis.tech/api/stk";

function generateReference(base, index) {
  return `${base}-${Date.now()}-${index}`;
}

app.post("/send-bulk", async (req, res) => {
  const { phones, amount, reference, account_ref, description } = req.body;

  if (!phones || !amount || !reference) {
    return res.status(400).json({ error: "phones, amount, reference required" });
  }

  const results = [];

  const tasks = phones.map((phone, i) =>
    queue.add(async () => {
      try {
        const ref = generateReference(reference, i);

        const response = await axios.post(
          API_URL,
          {
            phone,
            amount: parseInt(amount),
            reference: ref,
            account_ref,
            description
          },
          {
            headers: {
              "x-api-key": process.env.API_KEY,
              "Content-Type": "application/json"
            }
          }
        );

        results.push({
          phone,
          status: "success",
          transaction_id: response.data?.transaction_id
        });
      } catch (err) {
        results.push({
          phone,
          status: "failed",
          error: err.response?.data || err.message
        });
      }
    })
  );

  await Promise.all(tasks);

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
