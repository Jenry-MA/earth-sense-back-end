/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
const functions = require("firebase-functions")
const { initializeApp, cert } = require( "firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const path  = require("path");
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

    let label = [];
    if (req.query.start && req.query.end) {
      label = getHoursOfDay(req.query.start);
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

    const values = getMaxTemperaturesPerHour(response)

    const data = {
      message: "ok",
      data: response,
      label: label,
      values: values
    };

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      message: "error",
      error: error.message, // Include error message for better debugging
    });
  }
});

function getHoursOfDay(unixTimestamp) {
  const startDate = new Date(
      unixTimestamp * 1000); // Convertir UNIX a milisegundos
  const hoursOfDay = [];

  // Establecer la hora en 00:00:00
  startDate.setUTCHours(0, 0, 0, 0);

  // Iterar desde la medianoche hasta justo antes de la siguiente medianoche
  for (let hour = 0; hour < 24; hour++) {
    const currentHour = new Date(
        startDate.getTime() + hour * 60 * 60 * 1000); // Agregar cada hora
    const formattedHour = currentHour
        .toISOString().substr(11, 5); // Formato "HH:MM"
    hoursOfDay.push(formattedHour);
  }

  return hoursOfDay;
}

function getMaxTemperaturesPerHour(records) {
  // Objeto para almacenar las máximas temperaturas por hora
  const maxTemperaturesPerHour = {};

  // Iterar sobre cada registro
  records.forEach(record => {
      // Obtener la hora del registro
      const dateTime = new Date(parseInt(record.date_time) * 1000); // Convertir a milisegundos
      const hour = dateTime.getHours();
      
      // Verificar si ya existe una entrada para esta hora en maxTemperaturesPerHour
      if (!maxTemperaturesPerHour[hour]) {
          // Si no existe, crear una nueva entrada con la temperatura del registro
          maxTemperaturesPerHour[hour] = parseFloat(record.temperature_c);
      } else {
          // Si ya existe, actualizar la temperatura si el registro actual es mayor
          maxTemperaturesPerHour[hour] = Math.max(maxTemperaturesPerHour[hour], parseFloat(record.temperature_c));
      }
  });

  // Crear un array con las máximas temperaturas por hora asegurando que todas las horas estén presentes
  const maxTemperaturesArray = [];
  for (let hour = 0; hour < 24; hour++) {
      if (maxTemperaturesPerHour[hour] !== undefined) {
          maxTemperaturesArray.push(maxTemperaturesPerHour[hour]);
      } else {
          maxTemperaturesArray.push(0);
      }
  }
  
  return maxTemperaturesArray;
}


exports.app = functions.https.onRequest(app);

