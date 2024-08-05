require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve static files

// Define a simple route
app.get("/", (req, res) => {
  res.send("Hi Developer Server Is Running");
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage: storage,fileFilter: (req, file, cb)=>{
  const supportImages= /jpg | png/;
  const extension= path.extname(file.originalname)
  if(supportImages.test(extension)){
    cb(null, true)
  }else{
    cb(new Error('please give Jpg / png file '))
  }
},
limits:{
  fileSize:5000000
}
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
    return res.status(401).send({ message: "No authorization header" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, "secret", (err, user) => {
    if (err) {
      return res.status(401).send({ message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    const bariVaraDB = client.db("bariVaraDB");
    const propertyCollection = bariVaraDB.collection("propertyCollection");
    const userCollection = bariVaraDB.collection("userCollection");

    app.post("/jwt", (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, "secret", { expiresIn: "7d" });
      res.send({ token });
    });

    app.get("/states", verifyToken, async (req, res) => {
      const properties = await propertyCollection.estimatedDocumentCount();
      const users = await userCollection.estimatedDocumentCount();
      res.send({ properties, users });
    });

    // Properties CRUD
    app.get("/properties/email", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Please login then try" });
      }
      const query = { owner: email };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/properties/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
    });

    app.patch("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const filter = { _id: new ObjectId(id) };
      const product = req.body;
      const result = await propertyCollection.updateOne(filter, { $set: product });
      res.send(result);
    });

    app.delete("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const filter = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/properties", async (req, res) => {
      try {
        const { division, district, upazila, postOffice, type } = req.query;
        let query = {};
        if (division) query.division = division;
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;
        if (postOffice) query.postOffice = postOffice;
        if (type) query.type = type;
        
        const result = await propertyCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    app.post("/properties", verifyToken, upload.array("images", 6), async (req, res) => {
      try {
        const { amenities, ...other } = req.body;
        const images = req.files.map((file) => file.path);
        const propertyDoc = {
          ...other,
          images,
          amenities: amenities.split(",").map((amenity) => amenity.trim()),
        };

        const result = await propertyCollection.insertOne(propertyDoc);
        res.status(201).json(result);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Users CRUD
    app.get("/users/get/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      if (!email) {
        return res.status(400).send({ message: "Email not found" });
      }
      const query = { email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const filter = { _id: new ObjectId(id) };
      const newDoc = req.body;
      const result = await userCollection.updateOne(filter, { $set: newDoc });
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const filter = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const query = {};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      if (!user) {
        return res.status(400).send({ message: "Invalid data" });
      }
      const query = { email: user.email };
      const exist = await userCollection.findOne(query);
      if (exist) {
        return res.status(400).send({ message: "User already exists" });
      }
      const result = await userCollection.insertOne({ ...user, role: "user" });
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
