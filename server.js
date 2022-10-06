const express = require('express');
const bodyParser = require("body-parser");
const {google} = require('googleapis');
const https = require('node:https');

const app = express();
const port = 3000;
var client, googleSheets, spreadsheetId, auth, data, row_length;
var statusCodeArray = {};
var count =1;
var changedLinks = [];
var statusMessage = [];

app.use(bodyParser.urlencoded({extended: true}));

app.get('/', async (req, res) => {
  res.sendFile(__dirname + "/index.html")
})

app.get('/check', async (req, res) => {

  auth = await new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  // Create client instance for auth
  client = await auth.getClient();

  // Instance of Google Sheets API
  googleSheets = google.sheets({ version: "v4", auth: client });

  spreadsheetId = "1ysFPRG67kXbmLU3vXhN-tZJB7h9kxyq5ukH6Hqxo5QY";

  // Read rows from spreadsheet
  const getRows = await googleSheets.spreadsheets.values.get({
    auth,
    spreadsheetId,
    range: "Sheet1!A:A",
  });

  var rowData = getRows['data']['values'];
  statusCodeArray = [];
  callApi(rowData);
  // updateSheet();
  res.send(getRows);
  })


  async function callApi(rowData){
    row_length = rowData.length;
    for(var idx = 1; idx < row_length; idx++){
        var prefix = "https://www.";
        var url = rowData[idx][0].trim();
        if(url === prefix || url.trim() === ""){
          continue;
        }
        if (url.indexOf(prefix) === 0) {
          setStatusOfUrl(url, idx+1, rowData);
        }
        else {
          setStatusOfUrl("https://"+url, idx+1, rowData);
        }
    }
  }

async function setStatusOfUrl(url, idx, rowData) {
    var httpRequest = https.get(url, (response) => {

        data = response.statusCode;
        var rawHeaders = response.rawHeaders;
        var statusMessage = response.statusMessage;
        console.log(url + " in ");
        if(parseInt(data) >= 300 && parseInt(data) < 310){

              var location = rawHeaders[rawHeaders.indexOf("Location") + 1];

              var checkLink1 = url;
              var checkLink2 = location;

              if(location.charAt(location.length - 1) !== "/"){
                checkLink2 += "/";
              }

              if(url.charAt(url.length - 1) !== "/"){
                checkLink1 += "/";
              }

              if(checkLink1.replace('www.','') === checkLink2.replace('www.','')){
                pushDataToArray(data, url, "Not changed", statusMessage);
              }
              else{
                pushDataToArray(data, url, location, statusMessage);
              }
        }
        else{
          pushDataToArray(data, url, "Not changed", statusMessage);
        }
        console.log(url + " out ");
        console.log(count);
        count = count + 1;
        if(count === row_length){
          updateSheet(rowData);
        }
    });

    httpRequest.on('error', (err) => {
          console.log(url + " in ");
          pushDataToArray("None", url, "Not changed", err.message );
          count = count + 1;
          console.log(count);
          console.log(url + " out ");
          if(count === row_length){
            updateSheet(rowData);
          }
    });
}


function pushDataToArray(data, url, link, statusMessage){
  statusCodeArray[url] = [data, link, statusMessage];
}

async function updateSheet(rowData){
  var finalArray = [];
  for(var idx = 1; idx < rowData.length; idx++){
    finalArray.push(statusCodeArray["https://" + rowData[idx]]);
  }
  await googleSheets.spreadsheets.values.update({
    auth,
    spreadsheetId,
    range: "Sheet1!B2:D",
    valueInputOption: "USER_ENTERED",
    resource: { values: finalArray },
  });
  console.log(finalArray);
}


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
