import { Router } from "express";
import { addProduct,getAllProducts,deleteProduct } from "../controllers/product.controller.js";
import { upload } from "../middlewares/multer.js";

const router = Router();

// multiple images → array("images", maxCount)
router.post("/add", upload.array("images", 5), addProduct);

//get all products
router.get("/all", getAllProducts);
router.delete("/:productId", deleteProduct);

export default router;
