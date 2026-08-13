const express = require('express');
const { getGenes } = require('../controllers/geneController');

const router = express.Router();

router.get('/', getGenes);

module.exports = router;
