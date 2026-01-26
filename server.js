const express = require("express");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2; // [NEW] Import Cloudinary
const cors = require("cors");
require("dotenv").config();

const app = express();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* -------------------- MIDDLEWARE -------------------- */
app.use(
  cors({
    origin: ["http://localhost:5173", "https://skybm.onrender.com","https://skybm.in/"], // allow frontend access (lock this later)
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(express.json());

/* -------------------- DB CONNECTION -------------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

/* -------------------- BLOG SCHEMA -------------------- */
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    excerpt: { type: String, required: true },
    featuredImage: String,

    // ✅ IMPORTANT FIX
    publishDate: {
      type: Date,
      required: true,
    },

    slug: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    author: { type: String, default: "Admin" },
    readTime: Number,
    tags: [String],
    content: { type: String, required: true },
  },
  { timestamps: true }
);

const gallerySchema = new mongoose.Schema({
  src: { type: String, required: true },       // Cloudinary Secure URL
  publicId: { type: String, required: true },  // Cloudinary ID (needed for delete)
  alt: { type: String, default: "Event Image" },
  createdAt: { type: Date, default: Date.now }
});

const GalleryImage = mongoose.model("GalleryImage", gallerySchema);

const Blog = mongoose.model("Blog", blogSchema);

/* -------------------- ROUTES -------------------- */

/* Health check */
app.get("/", (req, res) => {
  res.json({ status: "API is running" });
});

// 1. GET ALL IMAGES
app.get("/api/gallery", async (req, res) => {
  try {
    // Sort by newest first
    const images = await GalleryImage.find().sort({ createdAt: -1 });
    res.json(images);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch images" });
  }
});

// 2. SAVE IMAGE (Called after frontend upload)
app.post("/api/gallery", async (req, res) => {
  try {
    const { src, publicId, alt } = req.body;
    
    if (!src || !publicId) {
      return res.status(400).json({ message: "Missing image data" });
    }

    const newImage = new GalleryImage({ src, publicId, alt });
    await newImage.save();
    
    res.status(201).json(newImage);
  } catch (err) {
    res.status(500).json({ message: "Failed to save image" });
  }
});

// 3. DELETE IMAGE (Removes from DB AND Cloudinary)
app.delete("/api/gallery/:id", async (req, res) => {
  try {
    const image = await GalleryImage.findById(req.params.id);
    if (!image) return res.status(404).json({ message: "Image not found" });

    // Step A: Delete from Cloudinary
    await cloudinary.uploader.destroy(image.publicId);

    // Step B: Delete from MongoDB
    await GalleryImage.findByIdAndDelete(req.params.id);

    res.json({ message: "Image deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Delete failed" });
  }
});

/* -------------------- GET ALL BLOGS -------------------- */
app.get("/api/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ publishDate: -1 });
    res.json(blogs);
  } catch {
    res.status(500).json({ message: "Failed to fetch blogs" });
  }
});

/* -------------------- GET BLOG BY SLUG -------------------- */
app.get("/api/blogs/:slug", async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }
    res.json(blog);
  } catch {
    res.status(500).json({ message: "Error fetching blog" });
  }
});

/* -------------------- ADMIN BLOG LIST -------------------- */
app.get("/api/admin/blogs", async (req, res) => {
  try {
    const blogs = await Blog.find({}, { title: 1, slug: 1 }).sort({
      createdAt: -1,
    });
    res.json(blogs);
  } catch {
    res.status(500).json({ message: "Failed to fetch blog list" });
  }
});

/* -------------------- CREATE BLOG -------------------- */
app.post("/api/blogs", async (req, res) => {
  try {
    const {
      title,
      excerpt,
      featuredImage,
      category,
      content,
      slug,
      author,
      readTime,
      tags,
      publishDate, // 👈 coming from Postman / Admin panel
    } = req.body;

    if (!title || !excerpt || !category || !content || !slug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await Blog.findOne({ slug });
    if (exists) {
      return res.status(409).json({ message: "Slug already exists" });
    }

    const newBlog = new Blog({
      title,
      excerpt,
      featuredImage,
      category,
      content,
      slug,
      author,
      readTime,
      tags,
      publishDate: publishDate
        ? new Date(publishDate)
        : new Date(), // ✅ fallback only if not provided
    });

    const savedBlog = await newBlog.save();
    res.status(201).json(savedBlog);
  } catch (err) {
    console.error("Create error:", err.message);
    res.status(500).json({ message: "Failed to create blog" });
  }
});

/* -------------------- DELETE BLOG BY SLUG -------------------- */
app.delete("/api/blogs/slug/:slug", async (req, res) => {
  try {
    const deleted = await Blog.findOneAndDelete({
      slug: req.params.slug,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json({ message: "Blog deleted successfully" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);



// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// require("dotenv").config();

// const app = express();

// /* -------------------- MIDDLEWARE -------------------- */
// app.use(
//   cors({
//     origin: "*", // allow frontend access (lock this later)
//     methods: ["GET", "POST", "PUT", "DELETE"],
//   })
// );
// app.use(express.json());

// /* -------------------- DB CONNECTION -------------------- */
// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => console.log("MongoDB Connected"))
//   .catch((err) => {
//     console.error("MongoDB connection error:", err.message);
//     process.exit(1);
//   });

// /* -------------------- BLOG SCHEMA -------------------- */
// const blogSchema = new mongoose.Schema(
//   {
//     title: { type: String, required: true },
//     excerpt: { type: String, required: true },
//     featuredImage: String,
//     publishDate: { type: Date, default: Date.now },
//     slug: { type: String, required: true, unique: true },
//     category: { type: String, required: true },
//     author: { type: String, default: "Admin" },
//     readTime: Number,
//     tags: [String],
//     content: { type: String, required: true },
//   },
//   { timestamps: true }
// );

// const Blog = mongoose.model("Blog", blogSchema);

// /* -------------------- ROUTES -------------------- */

// /* Health check */
// app.get("/", (req, res) => {
//   res.json({ status: "API is running" });
// });

// /* GET all blogs */
// app.get("/api/blogs", async (req, res) => {
//   try {
//     const blogs = await Blog.find().sort({ publishDate: -1 });
//     res.json(blogs);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch blogs" });
//   }
// });

// /* GET single blog by slug */
// app.get("/api/blogs/:slug", async (req, res) => {
//   try {
//     const blog = await Blog.findOne({ slug: req.params.slug });
//     if (!blog) {
//       return res.status(404).json({ message: "Blog not found" });
//     }
//     res.json(blog);
//   } catch (err) {
//     res.status(500).json({ message: "Error fetching blog" });
//   }
// });

// /* POST create blog */
// app.post("/api/blogs", async (req, res) => {
//   try {
//     const {
//       title,
//       excerpt,
//       featuredImage,
//       category,
//       content,
//       slug,
//       author,
//       readTime,
//       tags,
//     } = req.body;

//     if (!title || !excerpt || !category || !content || !slug) {
//       return res.status(400).json({
//         message: "Missing required fields",
//       });
//     }

//     const existingBlog = await Blog.findOne({ slug });
//     if (existingBlog) {
//       return res.status(409).json({
//         message: "Blog with this slug already exists",
//       });
//     }

//     const newBlog = new Blog({
//       title,
//       excerpt,
//       featuredImage,
//       category,
//       content,
//       slug,
//       author,
//       readTime,
//       tags,
//     });

//     const savedBlog = await newBlog.save();
//     res.status(201).json(savedBlog);
//   } catch (err) {
//     console.error("Blog create error:", err.message);
//     res.status(500).json({ message: "Failed to create blog" });
//   }
// });

// /* DELETE blog (optional admin use) */
// app.delete("/api/blogs/:id", async (req, res) => {
//   try {
//     await Blog.findByIdAndDelete(req.params.id);
//     res.json({ message: "Blog deleted" });
//   } catch (err) {
//     res.status(500).json({ message: "Delete failed" });
//   }
// });

// /* -------------------- SERVER -------------------- */
// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () =>
//   console.log(`Server running on port ${PORT}`)
// );

