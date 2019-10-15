'use strict'

const express = require('express');
const http = require('http');
const URL = require('url');
const mongoose = require('mongoose');
const request = require('request-promise');
const cheerio = require('cheerio');

const config = require('./conf');
const scraperSchema = require('./scraper-schema');

const app = express();
app.set("port", process.env.PORT || 3000);

// Concurrency of 5 requests 
http.globalAgent.maxSockets = 5;

let mongoCon;

// MongoDB connection
const MongoURI = process.env.MONGO_URL || config.MongoURI;
mongoose.createConnection(MongoURI)
  .then(conn => {
    mongoCon = conn.model('Scraperdata', scraperSchema);
  })
  .catch(err => {
    console.error('err', err);
    process.exit(1);
  })

let scrap = async function (req, res) {
  try {
    let arr = [];
    let uri = 'https://medium.com/';

    let html = await request.get(uri);
    let $ = cheerio.load(html.toString());
    $("a").each((i, link) => {
      let allHref = URL.parse($(link).attr("href"), true);
      let qArr = Object.keys(allHref['query']);
      let url = allHref['href'].split('?')[0];
      arr.push({ url, qArr });
    });
    let urlsArr = arr.map(x => x['url']);
    let urlsSet = new Set(urlsArr);
    let arrObj = [...urlsSet].map(url => {
      return {
        url: url,
        totalRef: arr.filter(e => e['url'] === url).length,
        params: arr.find(e => e['url'] === url).qArr,
      }
    });
    let mongoRes = await mongoCon.collection.insertMany(arrObj);
    res.status(200).jsonp({ "total_URL_count": mongoRes['result']['n'], "scrapData": mongoRes['ops'] });
  } catch (err) {
    console.error(err);
    res.status(500).jsonp({ 'msg': 'internal server error', 'err': err });
  }
};


// Start Harvesting email from Medium.com
app.get('/', scrap);

//Starting Node Server
app.listen(app.get("port"), () => {
  console.log("App is running at port %d", app.get("port"));
  console.log("Let the code harvest all the email from Medium.com and display it.\n");
});

