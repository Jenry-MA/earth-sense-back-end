/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const {initializeApp, cert} = require("firebase-admin/app")
const {getFirestore} = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());

initializeApp({
    credential: cert(
      path.resolve(__dirname, "./credentials.json")
    )
  });

const db = getFirestore();

app.post("/api/wet-sensor/create", async (req,res)=>{
    await db.collection("test").doc(req.body.id).create({name: req.body.name});
});

exports.app = functions.https.onRequest(app);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
