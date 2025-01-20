const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(cors());

// mongoDB Connection -----------------------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fisbs9h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    // database collections
    const menuCollection = client.db("bistroBoss").collection("menu");
    const reviewCollection = client.db("bistroBoss").collection("reviews");
    const cartCollection = client.db("bistroBoss").collection("carts");
    const userCollection = client.db("bistroBoss").collection("users");

    // jwt related API
    app.post("/jwt", async (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify token middleware
    const verifyToken = (req, res, next) => {
      console.log("Verify the token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden Access!" });
      }
      const token = req.headers.authorization;
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "Forbidden Access!" });
        }
        console.log("token is verified.")
        req.decoded = decoded;
        next();
      });
    };

    // verify admin middleware
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded?.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: "Forbidden Access!"});
      }
      next();
    }

    // get verified admin
    app.get("/user/admin", verifyToken, async (req, res) => {
      const email = req.query.email;
      console.log(email, req.decoded.email);
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorize Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin;
      if (user) {
        isAdmin = user?.role === "admin";
      }
      res.send({ isAdmin });
    });

    // update a menu item
    app.patch('/menu/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const updateItem = req.body;
      const query = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: updateItem
      }
      const result = await menuCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    // get a menu item
    app.get('/menu/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.findOne(query);
      res.send(result);
    })

    // delete a menu item
    app.delete('/menu/:id', verifyToken, verifyAdmin, async(req,res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    // Add menu item
    app.post("/menu", verifyToken, verifyAdmin, async(req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    })

    // GET menu data API
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // GET reviews data API
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // add item to carts
    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // get all carts data
    app.get("/carts", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { userEmail: email };
      const result = await cartCollection.find(query).toArray();
      console.log("carts data send");
      res.send(result);
    });

    // delete a cart item
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // add new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ loggedin: true });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // make user admin
    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const user = await userCollection.findOne(filter);
      if (user) {
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        console.log(user);
        return res.send(result);
      }
      res.send({ message: "Sorry! No user can be found." });
    });

    // delete a user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
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

// ------------------------X-----------------------

app.get("/", (req, res) => {
  res.send("Bistro Boss Server is Running...");
});

app.listen(port, () => {
  console.log("Server is Running on port: ", port);
});
