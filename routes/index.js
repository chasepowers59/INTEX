const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');

router.get('/', mainController.getLanding);

// router.get('/events', mainController.getEvents);
router.get('/programs', mainController.getPrograms);
router.get('/donate', mainController.getDonate);
router.post('/donate', mainController.postDonate);
router.get('/thank-you', mainController.getThankYou);

router.get('/about', (req, res) => {
    res.render('about', { user: req.user });
});

router.get('/get-involved', (req, res) => {
    res.render('get_involved', { user: req.user });
});

// Technical Requirements
router.get('/health', (req, res) => {
    res.status(200).send('OK');
});

router.get('/contact', (req, res) => {
    res.render('contact', { user: req.user });
});

router.post('/contact', (req, res) => {
    // Handle contact form submission (mock for now)
    res.redirect('/');
});

router.get('/press', (req, res) => {
    res.render('press', { user: req.user });
});

module.exports = router;
