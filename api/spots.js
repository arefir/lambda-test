"use strict";

const MongoClient = require("mongodb").MongoClient;
const AWS = require("aws-sdk");
const axios = require("axios");
const url = require("url");
const MONGODB_URI =
  "mongodb+srv://arefir:9TyKtv8B5LFW@gmstrial.ozjhp.mongodb.net/travel?retryWrites=true&w=majority";
const API_KEY =
  "yfF5xMOPBL4wu+0QC0elC1tTrMSdTUfiIBdjoUCsThkHNdR7hOjQc0C6rGzWSNS54e2MxKg0mDUvHTd+Vq3ilQ==";

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  // Connect to our MongoDB database hosted on MongoDB Atlas
  const client = await MongoClient.connect(MONGODB_URI);

  // Specify which database we want to use
  const db = await client.db("travel");

  cachedDb = db;
  console.log("Conntected to MongoDB");
  return db;
}

AWS.config.setPromisesDependency(require("bluebird"));

AWS.config.update({
  region: "ap-northeast-2",
});

module.exports.list = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let temp = JSON.stringify(event.queryStringParameters);
  const eventParams = JSON.parse(temp);

  if (
    eventParams != null &&
    eventParams.hasOwnProperty("x") &&
    eventParams.hasOwnProperty("y")
  ) {
    let { x, y } = eventParams;
    x = Number(x);
    y = Number(y);

    try {
      let payload = {
        numOfRows: 1000,
        MobileOS: "WIN",
        MobileApp: "travelHelper",
        mapX: x,
        mapY: y,
        radius: 3000,
        _type: "json",
        serviceKey: API_KEY,
      };

      const params = new url.URLSearchParams(payload);

      const apiRes = await axios.get(
        `https://apis.data.go.kr/B551011/KorWithService1/locationBasedList1?${params}`
      );

      let spots = apiRes.data.response.body.items.item;

      if (eventParams.inclChargers == "true") {
        const db = await connectToDatabase();

        const wcChargers = await db
          .collection("wcchargersnew")
          .find({
            lat: { $gt: y - 0.03, $lt: y + 0.03 },
            lon: { $gt: x - 0.03, $lt: x + 0.03 },
          })
          .toArray();

        await Promise.all(
          await spots.map(async (f) => ({
            ...f,
            wcChargers: filterPlacesByRadius(wcChargers, f.mapy, f.mapx, 0.5),
          }))
        ).then((list) => (spots = list));
      }

      callback(null, {
        statusCode: 200,
        body: JSON.stringify(spots),
      });
    } catch (err) {
      console.log(err);
      callback(null, {
        statusCode: 500,
        body: JSON.stringify({
          message: `Error`,
        }),
      });
    }
  } else {
    callback(null, {
      statusCode: 500,
      body: JSON.stringify({
        message: "No Coordinates provided",
      }),
    });
  }
};

const haversine = (lat1, lon1, lat2, lon2) => {
  // Radius of the Earth in kilometers
  const earthRadius = 6371;

  // Convert latitude and longitude from degrees to radians
  const [rLat1, rLon1, rLat2, rLon2] = [lat1, lon1, lat2, lon2].map(
    (coord) => (coord * Math.PI) / 180
  );

  // Haversine formula
  const dLat = rLat2 - rLat1;
  const dLon = rLon2 - rLon1;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadius * c;

  return distance;
};

const filterPlacesByRadius = (places, centerLat, centerLon, maxDistance) => {
  const filteredPlaces = [];
  for (const place of places) {
    const placeLat = place.lat;
    const placeLon = place.lon;
    const distance = haversine(centerLat, centerLon, placeLat, placeLon);
    if (distance <= maxDistance) {
      filteredPlaces.push(place);
    }
  }
  return filteredPlaces;
};
