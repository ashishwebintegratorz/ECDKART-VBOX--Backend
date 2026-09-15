import multer from "multer";

const storage = multer.memoryStorage();

// Set 5MB size limit
export const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  }
});
