import { Router } from 'express';
import { adminAuth } from '../../middleware/adminAuth';
import * as shamoAdmin from '../../controllers/shamoAdminController';

const router = Router();
router.use(adminAuth);

// Status / active
router.get('/status',            shamoAdmin.getStatus);
router.get('/rounds',            shamoAdmin.listRounds);
router.get('/rounds/:roundId',   shamoAdmin.getRoundDetail);
router.get('/rounds/:roundId/claims', shamoAdmin.getRoundClaims);

// Controls (password required — matches existing admin pattern)
router.post('/start',            shamoAdmin.startRound);
router.post('/end',              shamoAdmin.endRound);
router.post('/schedule',         shamoAdmin.setSchedule);

export default router;