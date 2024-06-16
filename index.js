require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
var jwt = require("jsonwebtoken");
const port = process.env.PORT;

// Middleware to parse JSON bodies
app.use(cors());
app.use(express.json());

// Define a simple route
app.get("/", (req, res) => {
  res.send("Hi Developer Server Is Running");
});
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dtcwl7u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.send({ message: "You have no authHeader" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, "secret", function (err, user) {
    if (err) {
      return res.send({ message: "Your token is not valid" });
    } else {
      req.user = user;
      next();
    }
  });
};

async function run() {
  try {
    client.connect();
    const digitalFurnitureDb = client.db("digitalFurnitureDb");
    const productCollection =
      digitalFurnitureDb.collection("productCollection");
    const userCollection = digitalFurnitureDb.collection("userCollection");
    const blogCollection = digitalFurnitureDb.collection("blogCollection");
    const reviewCollection = digitalFurnitureDb.collection("reviewCollection");

    app.post("/jwt", (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, "secret", { expiresIn: "7d" });
      res.send({ token });
    });
    app.get("/states",verifyToken, async (req, res) => {
      const products = await productCollection.estimatedDocumentCount();
      const blogs = await blogCollection.estimatedDocumentCount();
      const reviews = await reviewCollection.estimatedDocumentCount();
      const users = await userCollection.estimatedDocumentCount();
      return res.send({ products, blogs, reviews, users });
    });

    // products curd
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      return res.send(result);
    });
    app.get("/products/categories/:category", async (req, res) => {
      const category = req.params.category;
      if (!category) {
        return res.send({ message: "category Notfound" });
      }
      const query = { category };
      const result = await productCollection.find(query).toArray();
      return res.send(result);
    });
    app.patch("/products/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const product = req.body;
      const result = await productCollection.updateOne(filter, {
        $set: product,
      });
      return res.send(result);
    });
    app.delete("/products/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(filter);
      return res.send(result);
    });
    app.get("/products", async (req, res) => {
      const searchText  = req.query.searchText;
      let products = [];
      if (searchText) {
        products = await productCollection.find({ title: { $regex: searchText, $options: 'i' } }).toArray();
      } else {
        products = await productCollection.find({}).toArray();
      }
      res.send(products);
    });

    app.post("/products", verifyToken, async (req, res) => {
      const product = req.body;
      if (!product) {
        return res.send({ message: "No data for insert" });
      }
      const result = await productCollection.insertOne(product);
      return res.send(result);
    });

    // Blogs curd
    app.get("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const query = { _id: new ObjectId(id) };
      const result = await blogCollection.findOne(query);
      return res.send(result);
    });
    app.get("/blogs/me/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.send({ message: "email not found" });
      }
      const query = { authorEmail: email };
      const result = await blogCollection.find(query).toArray();
      return res.send(result);
    });
    app.patch("/blogs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const blog = req.body;
      const result = await blogCollection.updateOne(filter, {
        $set: blog,
      });
      return res.send(result);
    });
    app.delete("/blogs/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const result = await blogCollection.deleteOne(filter);
      return res.send(result);
    });
    app.get("/blogs", async (req, res) => {
      const query = {};
      const result = await blogCollection.find(query).toArray();
      return res.send(result);
    });
    app.post("/blogs", verifyToken, async (req, res) => {
      const blog = req.body;
      if (!blog) {
        return res.send({ message: "No data for insert" });
      }
      const result = await blogCollection.insertOne(blog);
      return res.send(result);
    });

    // reviews curd
    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.findOne(query);
      return res.send(result);
    });
    app.get("/reviews/me/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.send({ message: "Id invalid" });
      }
      const query = { authorEmail: email };
      const result = await reviewCollection.find(query).toArray();
      return res.send(result);
    });
    app.patch("/reviews/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const review = req.body;
      const result = await reviewCollection.updateOne(filter, {
        $set: review,
      });
      return res.send(result);
    });
    app.delete("/reviews/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(filter);
      return res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const query = {};
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/reviews", verifyToken, async (req, res) => {
      const review = req.body;
      if (!review) {
        return res.send({ message: "No data for insert" });
      }
      const result = await reviewCollection.insertOne(review);
      return res.send(result);
    });

    // users curd
    app.get("/users/get/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      return res.send(result);
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.send({ message: "Email not fond" });
      }
      const query = { email };
      const result = await userCollection.findOne(query);
      return res.send(result);
    });
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const newDoc = req.body;
      const result = await userCollection.updateOne(filter, {
        $set: newDoc,
      });
      return res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.send({ message: "Id invalid" });
      }
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      return res.send(result);
    });

    //verify admin
    app.get("/users", verifyToken, async (req, res) => {
      const query = {};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      if (!user) {
        return res.send({ message: "Id invalid" });
      }
      const query = { email: user.email };
      const exist = await userCollection.findOne(query);
      if (exist) {
        return res.send({ message: "user already exist" });
      }
      const result = await userCollection.insertOne({ ...user, role: "user" });
      return res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Start the server
app.listen(port);
