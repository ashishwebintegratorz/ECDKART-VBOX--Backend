import { Router } from "express";
import { jwtAuth } from "../middlewares/jwtAuth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { getDrivers, toggleDriverOnlineStatus, markReachedStore } from "../controllers/user.controller.js";

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
            createdAt: user.createdAt,
        },
    });
});

router.get("/drivers", jwtAuth, getDrivers);

router.put("/toggle-online", jwtAuth, requireRole("driver"), toggleDriverOnlineStatus);

router.put("/reached-store", jwtAuth, requireRole("driver"), markReachedStore);

export default router;
