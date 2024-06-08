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

    const currentDate = new Date();
    const unixDate = Math.floor(currentDate.getTime() / 1000); // get datetime in seconds and remove fractional part


    //create obj for save in bd
    const body = {
      ...req.body,
      date_time: unixDate
    };

    const response = await db.collection("temperature")
        .add(body);

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
      const start = Number(req.query.start);
      const end = Number(req.query.end);

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

    const values = getMaxValuesPerHour(response)

    const data = {
      message: "ok",
      data: response,
      label: label,
      values: values.temperature_c,
      temperature_c: values.temperature_c,
      heat_index_c: values.heat_index_c,
      humidity: values.humidity
    };

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      message: "error",
      error: error.message, // Include error message for better debugging
    });
  }
});


app.get("/api/temperature-sensor/current-temperature", async (req, res) => {
  try {
    let query = db
        .collection("temperature")
        .orderBy("date_time", "desc")
        .limit(1);

    const querySnapshot = await query.get();
    const docs = querySnapshot.docs;

    if (docs.length > 0) {
      const doc = docs[0];
      const data = doc.data();
      const humanDateTime = format(
        fromUnixTime(data.date_time), "MM/dd/yyyy H:mm:ss"
      );

      const response = {
        id: doc.id,
        date_time: data.date_time,
        human_date_time: humanDateTime,
        heat_index_c: data.heat_index_c,
        humidity: data.humidity,
        temperature_c: data.temperature_c,
      };

      return res.status(200).json(response);
    } else {
      return res.status(404).json({ message: "No temperature data found" });
    }
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

function getMaxValuesPerHour(records) {
  // Init obj for set max values per hour
  const maxValuesPerHour = {
      temperature_c: {},
      humidity: {},
      heat_index_c: {}
  };

  // for each records
  records.forEach(record => {
      const dateTime = new Date(record.date_time * 1000); // Convertir a milisegundos

      // Ajustar la hora a la zona horaria de Guatemala (GMT-06:00)
      const guatemalaOffset = -6 * 60; // -6 horas en minutos
      const utcMinutes = dateTime.getUTCMinutes() + dateTime.getUTCHours() * 60;
      const guatemalaTimeInMinutes = utcMinutes + guatemalaOffset;
      const guatemalaHour = Math.floor(guatemalaTimeInMinutes / 60) % 24;

      // Inner function for update obj in the specific property
      const updateMaxValue = (parameter, value) => {
          if (!maxValuesPerHour[parameter][guatemalaHour]) {
              maxValuesPerHour[parameter][guatemalaHour] = parseFloat(value);
          } else {
              maxValuesPerHour[parameter][guatemalaHour] = Math.max(maxValuesPerHour[parameter][guatemalaHour], parseFloat(value));
          }
      };

      // using inner function
      updateMaxValue('temperature_c', record.temperature_c);
      updateMaxValue('humidity', record.humidity);
      updateMaxValue('heat_index_c', record.heat_index_c);
  });

  // Init obj for put existing values and if no exit put 0
  const maxValuesArray = {
      temperature_c: [],
      humidity: [],
      heat_index_c: []
  };

  for (let hour = 0; hour < 24; hour++) {
      maxValuesArray.temperature_c.push(maxValuesPerHour.temperature_c[hour] !== undefined ? maxValuesPerHour.temperature_c[hour] : 0);
      maxValuesArray.humidity.push(maxValuesPerHour.humidity[hour] !== undefined ? maxValuesPerHour.humidity[hour] : 0);
      maxValuesArray.heat_index_c.push(maxValuesPerHour.heat_index_c[hour] !== undefined ? maxValuesPerHour.heat_index_c[hour] : 0);
  }

  return maxValuesArray;
}


exports.app = functions.https.onRequest(app);

