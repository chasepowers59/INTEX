const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');

router.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// router.get('/events', mainController.getEvents);
router.get('/programs', mainController.getPrograms);
router.get('/donate', mainController.getDonate);
router.post('/donate', mainController.postDonate);

router.get('/about', (req, res) => {
    res.render('about', { user: req.session.user });
});

router.get('/get-involved', (req, res) => {
    res.render('get_involved', { user: req.session.user });
});

// Technical Requirements
router.get('/health', (req, res) => {
    res.status(200).send('OK');
});

router.get('/contact', (req, res) => {
    res.render('contact', { user: req.session.user });
});

router.post('/contact', (req, res) => {
    // Handle contact form submission (mock for now)
    res.redirect('/');
});

router.get('/press', (req, res) => {
    res.render('press', { user: req.session.user });
});

router.get('/teapot', (req, res) => {
    res.status(418).send("I'm a teapot");
});

module.exports = router;
