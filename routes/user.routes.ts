import { Router } from "express";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

import { me, updateProfile, getAllUsers, blockUser } from "../controllers/user.controller.js";

const router = Router();

router.get("/me", jwtAuth, (req, res) => {
    const user = (req as any).user;
    return res.json({
        user: {
            id: user._id.toString(),
            phone: user.phone,
            name: user.name,
            role: user.role,
            isVerified: user.isVerified,
            isBlocked: user.isBlocked,
            createdAt: user.createdAt,
        },
    });
});

router.put("/profile", jwtAuth, updateProfile);

// Admin Routes
router.get("/all", jwtAuth, requireRole("admin"), getAllUsers);
router.put("/block/:id", jwtAuth, requireRole("admin"), blockUser);

export default router;
