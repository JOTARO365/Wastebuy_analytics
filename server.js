import express from "express";
import axios from "axios";


const app = express();
const port = 3000;

app.use(express.static('public'))


app.get('/', (req, res) => {
    res.render('index.ejs');
})


app.get('/material-information', async (req, res) => {
    try {

    } catch (error) {

    };
    res.render('material-information.ejs' );
})

app.get('/Report-50-Districts', (req, res) => {
    try {

    } catch (error) {

    };
    res.render('Report-50-Districts.ejs');
})

app.get('/Report-Carbon-Credit', (req, res) => {
    try {

    } catch (error) {

    };
    res.render('Report-Carbon-Credit.ejs');
})

app.get('/Report-Customer-Details-materials', (req, res) => {
    try {

    } catch (error) {

    };
    res.render('Report-Customer-Details-materials.ejs');
})

app.listen(port ,  () => {
    console.log(`listening on Port : ${port}`) 
})