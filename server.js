const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

//database connection establish
mongoose.connect(
  "mongodb+srv://hitesh:hitesh123@cluster1.wllylgx.mongodb.net/mydb?retryWrites=true&w=majority",
  
);
const db = mongoose.connection;
const User = mongoose.model("User", {
  username: String,
  password: String,
});
const Document = mongoose.model("Document", {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  content: String,
});


//this is a endpoint to create a new user 
app.post("/create-user", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  res.json({ message: "User created successfully" });
});

//this endpoint is for login 
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ userId: user._id }, "1h16nJ8R");
    res.json({ userId: user._id, token });
  } else {
    res.status(401).json({ message: "Invalid username or password" });
  }
});

//authentication
app.get("/protected-route", authenticateToken, (req, res) => {
  res.json({ message: "Protected route accessed successfully" });
});
function authenticateToken(req, res, next) {
  const token =
    req.headers.authorization && req.headers.authorization.split(" ")[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token,(err, user) => {
    if (err) {
      return res.sendStatus(403);
    }

    req.user = user;
    next();
  });
}

//this endpoint is for saving the document
app.post("/save-document", async (req, res) => {
    const { userId, title, content } = req.body;
  
    try {
       {
        // If a document doesn't exist, create a new one
        const newDocument = new Document({ userId, title, content });
        await newDocument.save();
        console.log("New document created successfully");
      }
  
      res.json({ message: "Document saved successfully" });
    } catch (error) {
      console.error("Error saving document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

// this endpoint is for updating the file
app.get('/user-documents/:userId', async (req, res) => {
    const userId = req.params.userId;
  
    try {
      
      const documents = await Document.find({ userId });
  
      // Mapping each document to include ID, title, and content
      const documentsWithDetails = documents.map((document) => ({
        _id: document._id,
        title: document.title,
        content: document.content,
      }));
  
      res.json(documentsWithDetails);
    } catch (error) {
      console.error('Error retrieving user documents:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
//this end point is for getting document details
app.get("/document-details/:documentId", async (req, res) => {
  const documentId = req.params.documentId;

  try {
    // Retrieve detailed document content and title based on the document ID
    const detailedDocument = await Document.findById(documentId);

    if (detailedDocument) {
      res.json({
        title: detailedDocument.title,
        content: detailedDocument.content,
      });
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  } catch (error) {
    console.error("Error retrieving document details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// this endpoint is for deleting a document
app.delete("/delete-document/:documentId", async (req, res) => {
  const documentId = req.params.documentId;

  try {
    // Finding and deleting the document based on the document ID
    const deletedDocument = await Document.findByIdAndDelete(documentId);

    if (deletedDocument) {
      console.log("Document deleted successfully");
      res.json({ message: "Document deleted successfully" });
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}); 

//socket connection 
const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("join", (userId) => {
    // Join a room based on user ID
    socket.join(userId);

    socket.on("text-update", (data) => {
      // the text is updated only to the user's room
      io.to(userId).emit("text-update", data);
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected");
    });
  });
});

//staring the server
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
