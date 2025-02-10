const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFSBucket } = require("mongodb");
const crypto = require("crypto");
const path = require("path");
const stream = require("stream");

const app = express();

const mongoURI = "mongodb://localhost:27017/imageUploadDB";
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const conn = mongoose.connection;
let gridFSBucket;

conn.once("open", () => {
    gridFSBucket = new GridFSBucket(conn.db, { bucketName: "uploads" });
    console.log("MongoDB Connected, GridFSBucket Ready!");
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }

    const filename = crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname);
    const readableStream = new stream.Readable();
    readableStream.push(req.file.buffer);
    readableStream.push(null);

    const uploadStream = gridFSBucket.openUploadStream(filename);
    readableStream.pipe(uploadStream);

    uploadStream.on("finish", () => {
        res.status(201).json({ file: { filename, _id: uploadStream.id } });
    });

    uploadStream.on("error", (err) => {
        res.status(500).json({ error: err.message });
    });
});

app.get("/image/:filename", async (req, res) => {
    try {
        const file = await conn.db.collection("uploads.files").findOne({ filename: req.params.filename });

        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        const readstream = gridFSBucket.openDownloadStream(file._id);
        res.setHeader("Content-Type", file.contentType || "image/jpeg");
        readstream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.listen(3000, () => console.log("Server running on port 3000"));
