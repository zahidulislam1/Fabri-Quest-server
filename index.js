const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

//middleware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jmftqsk.mongodb.net/?appName=Cluster0S`;

// jwt middlewares
// const verifyJWT = async (req, res, next) => {
//   const token = req?.headers?.authorization?.split(' ')[1]
//   console.log(token)
//   if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
//   try {
//     const decoded = await admin.auth().verifyIdToken(token)
//     req.tokenEmail = decoded.email
//     console.log(decoded)
//     next()
//   } catch (err) {
//     console.log(err)
//     return res.status(401).send({ message: 'Unauthorized Access!', err })
//   }}
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("fabri-quest-db");
    const productsCollection = db.collection("products");
    const usersCollection = db.collection("users");

    //save a product data in db
    app.post("/products", async (req, res) => {
      const product = req.body;
      const newProduct = {
        ...product,
        createdAt: new Date().toISOString(),
      };
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });
    //get all products form db
    app.get("/products", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });
    app.get("/latest-products", async (req, res) => {
      const result = await productsCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    //save a user data in db
    app.post("/users", async (req, res) => {
      const userData = req.body;
      userData.created_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      userData.role = "buyer";

      const query = {
        email: userData.email,
      };

      const alreadyExists = await usersCollection.findOne(query);

      if (alreadyExists) {
        const result = await usersCollection.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString(),
          },
        });
        return res.send(result);
      }

      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });

    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
