const mongoose = require("mongoose");
const data = require("./data");
const Listing = require("../models/listing");

const Mongo_URL = "mongodb://127.0.0.1:27017/homigo";

main()
  .then(() => {
    console.log("Connected to the Database Successfully");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(Mongo_URL);
}

// This code is giving error 
// const initDB = async() => { 
// await Listing.deleteMany({}); 
// await Listing.insertMany(data.data); 
// console.log("Data Was Initialised"); 
// }

const initDB = async () => {
  await Listing.deleteMany({});

  const modifiedData = data.data.map((item) => {
    return {
      ...item,
      image: {
        url: item.image.url,
        filename: item.image.filename || "",
      },
      owner: "68ca44544fb4cc96bdfaadea" // fix owner here
    };
  });

  await Listing.insertMany(modifiedData);
  console.log("Data Was Initialised");
};

initDB();
