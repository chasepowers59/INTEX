const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');

router.get('/', mainController.getLanding);
router.get('/events', mainController.getEvents);
router.get('/donate', mainController.getDonate);
router.post('/donate', mainController.postDonate);

// Technical Requirements
router.get('/health', (req, res) => {
    res.status(200).send('OK');
});

router.get('/teapot', (req, res) => {
    res.status(418).send("I'm a teapot");
});

module.exports = router;
