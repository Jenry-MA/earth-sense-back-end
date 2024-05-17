/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const path = require("path");
const { setDefaultOptions, fromUnixTime, format } = require("date-fns");
const { es } = require("date-fns/locale");

const app = express();

app.use(cors());

initializeApp({
  credential: cert(path.resolve(__dirname, "./credentials.json")),
});

const db = getFirestore();

// default setting for date-fns
setDefaultOptions({ locale: es });

/**
 * routes temperature sensor
 */

app.post("/api/temperature-sensor/create", async (req, res)=>{
  try {
    const response = await db.collection("temperature")
        .doc()
        .create(req.body);

    return res.status(200).json({
      "message": "ok",
      "data": response,
    });
  } catch (error) {
    return res.status(500).json({
      "message": "error",
      "error": error,
    });
  }
});

app.get("/api/temperature-sensor/index", async (req, res) => {
  try {
    let query = db
        .collection("temperature")
        .orderBy("date_time", "desc");

    if (req.query.start && req.query.end) {
      const start = req.query.start;
      const end = req.query.end;

      query = query
          .where("date_time", ">=", start)
          .where("date_time", "<=", end);
    }

    const querySnapshot = await query.get();
    const docs = querySnapshot.docs;

    const response = docs.map((doc) => {
      const data = doc.data();
      const humanDateTime = format(
          fromUnixTime(data.date_time), "MM/dd/yyyy H:mm:ss",
      );

      return {
        id: doc.id,
        date_time: data.date_time,
        human_date_time: humanDateTime,
        heat_index_c: data.heat_index_c,
        humidity: data.humidity,
        temperature_c: data.temperature_c,
      };
    });

    return res.status(200).json({
      message: "ok",
      data: response,
    });
  } catch (error) {
    return res.status(500).json({
      message: "error",
      error: error.message, // Include error message for better debugging
    });
  }
});

exports.app = functions.https.onRequest(app);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
