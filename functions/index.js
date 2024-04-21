/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const {initializeApp, cert} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());

initializeApp({
  credential: cert(path.resolve(__dirname, "./credentials.json")),
});

const db = getFirestore();

app.post("/api/wet-sensor/create", async (req, res) => {
  try {
    // Assuming db is your MongoDB database connection
    await db
        .collection("test")
        .doc(req.body.id)
        .create({name: req.body.name});

    // Send a success response back to the client
    return res.status(201).json({message: "Document created successfully"});
  } catch (error) {
    // If there's any error, send a 500 status with the error message
    return res.status(500).json({error: error.message});
  }
});

app.get("/api/wet-sensor/:id/show", async (req, res) => {
  try {
    // Assuming db is your MongoDB database connection
    const docId = req.params.id; // Extracting id from URL parameters

    // Fetch the document from MongoDB based on the provided id
    const doc = await db.collection("test").doc(docId).get();

    // If the document exists, send its data in the response
    if (doc.exists) {
      return res.json(doc.data());
    } else {
      // If the document doesn't exist, send a 404 status
      return res.status(404).json({error: "Document not found"});
    }
  } catch (error) {
    // If there's any error, send a 500 status with the error message
    return res.status(500).json({error: error.message});
  }
});

exports.app = functions.https.onRequest(app);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
