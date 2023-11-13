"use strict";

const MongoClient = require("mongodb").MongoClient;
const AWS = require("aws-sdk");

// Define our connection string. Info on where to get this will be described below. In a real world application you'd want to get this string from a key vault like AWS Key Management, but for brevity, we'll hardcode it in our serverless function here.
const MONGODB_URI =
  "mongodb+srv://arefir:9TyKtv8B5LFW@gmstrial.ozjhp.mongodb.net/travel?retryWrites=true&w=majority";

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
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
  /* By default, the callback waits until the runtime event loop is empty before freezing the process and returning the results to the caller. Setting this property to false requests that AWS Lambda freeze the process soon after the callback is invoked, even if there are events in the event loop. AWS Lambda will freeze the process, any state data, and the events in the event loop. Any remaining events in the event loop are processed when the Lambda function is next invoked, if AWS Lambda chooses to use the frozen process. */
  context.callbackWaitsForEmptyEventLoop = false;
  console.log(event);
  let temp = JSON.stringify(
    event.queryStringParameters ? event.queryStringParameters : event
  );
  console.log(temp);
  const eventParams = JSON.parse(temp);

  try {
    // Get an instance of our database
    const db = await connectToDatabase();

    let wcChargers = [];
    // console.log(eventParams);
    if (
      eventParams != null &&
      eventParams.hasOwnProperty("x") &&
      eventParams.hasOwnProperty("y")
    ) {
      let { x, y } = eventParams;
      x = Number(x);
      y = Number(y);

      wcChargers = await db
        .collection("wcchargersnew")
        .find({
          lat: { $gt: y - 0.03, $lt: y + 0.03 },
          lon: { $gt: x - 0.03, $lt: x + 0.03 },
        })
        .toArray();
    } else {
      wcChargers = await db
        .collection("wcchargersnew")
        .find({})
        .limit(20)
        .toArray();
    }

    if (wcChargers != []) {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify(wcChargers),
      });
    } else {
      callback(null, {
        statusCode: 404,
        body: JSON.stringify({
          message: "Could not find any wheel chair chargers",
        }),
      });
    }
  } catch (err) {
    console.log(err);
    callback(null, {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error`,
      }),
    });
  }
};
