const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

//middleware
app.use(express.json());
app.use(
  cors({
    origin: [process.env.CLIENT_DOMAIN],
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
    // await client.connect();

    const db = client.db("fabri-quest-db");
    const productsCollection = db.collection("products");
    const usersCollection = db.collection("users");
    const orderCollection = db.collection("orders");

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
    // get  product from db
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.findOne({
        _id: new ObjectId(id),
      });
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
    //payment endpoints
    app.post("/create-checkout-session", async (req, res) => {
      const orderInfo = req.body;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: orderInfo?.buyerName,
                description: orderInfo?.description,
                images: [orderInfo?.image],
              },
              unit_amount: orderInfo?.price * 100,
            },
            quantity: orderInfo?.orderQty,
          },
        ],
        customer_email: orderInfo?.buyer.email,
        mode: "payment",
        metadata: {
          productId: orderInfo?.productId,
          customer: orderInfo?.buyer.email,
          orderQty: orderInfo?.orderQty,
        },
        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/product/${orderInfo?.productId}`,
      });
      res.send({ url: session.url });
    });
    app.post("/payment-success", async (req, res) => {
      const { sessionId } = req.body;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log(session);
      const product = await productsCollection.findOne({
        _id: new ObjectId(session.metadata.productId),
      });
      const order = await orderCollection.findOne({
        transactionId: session.payment_intent,
      });

      if (session.status === "complete" && product && !order) {
        //save order data in db
        const orderInfo = {
          productId: session.metadata.productId,
          transactionId: session.payment_intent,
          buyerName: session.metadata.customer,
          status: "pending",
          paymentStatus: "paid",
          managerDetails: product.managerDetails,
          title: product.title,
          category: product.category,
          orderQty: session.metadata.orderQty,
          price: session.amount_total / 100,
          createdAt: new Date().toISOString(),
        };
        // console.log(orderInfo);
        const result = await orderCollection.insertOne(orderInfo);
        await productsCollection.updateOne(
          {
            _id: new ObjectId(session.metadata.productId),
          },
          { $inc: { quantity: -Number(session.metadata.orderQty) } }
        );
        return res.send({
          transactionId: session.payment_intent,
          orderId: result.insertedId,
        });
      }
      res.send({
        transactionId: session.payment_intent,
        orderId: order,
      });
    });

    //get all order by email
    app.get("/my-orders/:email", async (req, res) => {
      const email = req.params.email;
      const result = await orderCollection.find({ customer: email }).toArray();
      res.send(result);
    });
    //
    app.get("/pending-orders/:email", async (req, res) => {
      const email = req.params.email;
      const result = await orderCollection
        .find({ "managerDetails.email": email })
        .toArray();
      res.send(result);
    });
    //
    app.get("/manage-products/:email", async (req, res) => {
      const email = req.params.email;
      const result = await productsCollection
        .find({ "managerDetails.email": email })
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
