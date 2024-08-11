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
const SSLCommerzPayment = require("sslcommerz-lts");
const uuid = require("uuid");

const storeId = process.env.STORE_ID;
const storePassword = process.env.STORE_PASSWORD;
const isLive = false;

// Middleware to parse JSON bodies
app.use(cors());
app.use(express.json());

// Ensure the 'uploads' directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve the uploads directory as a static folder
app.use("/uploads", express.static(uploadsDir));

// Define a simple route
app.get("/", (req, res) => {
  res.send("Hi Developer Server Is Running");
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5000000,
  },
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

    app.post("/imageUpload", upload.array("images"), async (req, res) => {
      try {
        const images = req?.files?.map(
          (file) => process.env.SERVER_URL + "/uploads/" + file.filename
        );

        res.status(201).json(images);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
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
      const result = await propertyCollection.updateOne(filter, {
        $set: { ...product },
      });
      res.send(result);
    });

    app.delete("/properties/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (!id) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const filter = { _id: new ObjectId(id) };
      const property = await propertyCollection.findOne(filter);
      const filepaths = property?.images?.map(
        (image) => path.join(__dirname, "uploads/") + image.split("/")[4]
      );

      if (filepaths) {
        filepaths.forEach((filepath) => {
          try {
            fs.unlinkSync(filepath);
          } catch (err) {}
        });
      }
      const result = await propertyCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/properties", async (req, res) => {
      try {
        const {
          maxPrice,
          page = 1,
          limit = 10,
          search,
          division,
          district,
          upazila,
          postOffice,
          type,
        } = req.query;
        let query = {};
        if (search) query.title = { $regex: search, $options: "i" };
        if (division) query.division = division;
        if (maxPrice) query.price.$lte = Number(maxPrice);
        if (district) query.district = district;
        if (upazila) query.upazila = upazila;
        if (postOffice) query.postOffice = postOffice;
        if (type) query.type = type;
        
        
        const properties = await propertyCollection
          .find(query)
          .skip((page - 1) * limit)
          .limit(Number(limit)).toArray()

        const totalProperties = await propertyCollection.countDocuments(query);

        res.json({
          properties,
          totalPages: Math.ceil(totalProperties / limit),
          currentPage: Number(page),
        });
      } catch (error) {
        res.status(500).json({ message: "Server Error" });
      }
    });

    app.post("/properties", verifyToken, async (req, res) => {
      try {
        const { amenities, ...other } = req.body;
        const propertyDoc = {
          ...other,
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

    // Payment Api
    app.patch("/payment/:id", async (req, res) => {
      const property = req.body;
      const id = req.params.id;
      const tran_id = uuid.v4();

      const filter = { _id: new ObjectId(id) };
      await propertyCollection.updateOne(filter, {
        $set: {
          ...property,
          tran_id: tran_id,
        },
      });

      const data = {
        total_amount: property.amount,
        currency: "BDT",
        tran_id: tran_id,
        success_url: `${process.env.SERVER_URL}/payment/success?tran_id=${tran_id}`,
        fail_url: `${process.env.SERVER_URL}/payment/fail?tran_id=${tran_id}`,
        cancel_url: `${process.env.SERVER_URL}/payment/cancel?tran_id=${tran_id}`,
        ipn_url: `${process.env.SERVER_URL}/payment/ipn`,
        shipping_method: "Not required",
        product_name: "Online service",
        product_category: "Online service",
        product_profile: "general",
        cus_name: "customer name",
        cus_email: "customer email",
        cus_add1: "customer add1",
        cus_add2: "customer add2",
        cus_city: "customer city",
        cus_state: "customer state",
        cus_postcode: "customer postcode",
        cus_country: "customer country",
        cus_phone: "customer phone",
        cus_fax: "customer fax",
        ship_name: "ship name",
        ship_add1: "ship add1",
        ship_add2: "ship add2",
        ship_city: "ship city",
        ship_state: "ship state",
        ship_postcode: "ship postcode",
        ship_country: "ship country",
        multi_card_name: "mastercard",
        value_a: "ref001_A",
        value_b: "ref002_B",
        value_c: "ref003_C",
        value_d: "ref004_D",
      };

      const sslcommer = new SSLCommerzPayment(storeId, storePassword, isLive);
      let url;
      await sslcommer.init(data).then((res) => {
        url = res.GatewayPageURL;
      });
      res.send({ url });
    });

    app.post("/payment/success", async (req, res) => {
      const { tran_id } = req.query;
      const result = await propertyCollection.updateOne(
        { tran_id },
        {
          $set: {
            paymentStatus: "paid",
            publishStatus: "public",
            paidAt: new Date(),
          },
        }
      );
      if (result.modifiedCount > 0) {
        res.redirect(
          `${process.env.CLIENT_URL}/paymentSuccess?tran_id=${tran_id}`
        );
      }
    });

    app.post("/payment/fail", async (req, res) => {
      const { tran_id } = req.query;
      const result = await propertyCollection.updateOne(
        { tran_id },
        {
          $set: {
            paymentStatus: "due",
            publishStatus: "hide",
            tran_id: "",
            tryToPayAt: new Date(),
          },
        }
      );
      if (result.modifiedCount > 0) {
        res.redirect(`${process.env.CLIENT_URL}/paymentFail`);
      }
    });
    app.post("/payment/cancel", async (req, res) => {
      const { tran_id } = req.query;
      const result = await propertyCollection.updateOne(
        { tran_id },
        {
          $set: {
            paymentStatus: "due",
            publishStatus: "hide",
            tran_id: "",
            tryToPayAt: new Date(),
          },
        }
      );
      if (result.modifiedCount > 0) {
        res.redirect(`${process.env.CLIENT_URL}/paymentCancel`);
      }
    });
    app.get("/property/:tran_id", verifyToken, async (req, res) => {
      const tran_id = req.params.tran_id;
      const query = { tran_id };
      const property = await propertyCollection.findOne(query);
      return res.send(property);
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
