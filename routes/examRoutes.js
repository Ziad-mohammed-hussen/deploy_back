const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');

router.post('/', examController.createExam);
router.get('/', examController.getInstructorExams);
router.get('/:id', examController.getExamById);

module.exports = router;
